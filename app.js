// ============================================
// Node.js applicatie die scores ontvangt via de
// seriële poort (Arduino) en doorstuurt naar een API.
//
// Studenten hoeven alleen een regel tekst te sturen via Serial.println:
//   "Naam,Score"
//   of
//   "Naam,Score,MachineId"
//
// Voorbeeld Arduino:
//   Serial.println("Steven,125000");
//   Serial.println("Steven,125000,team_1_flipper");
//
// Deze app zet dit om naar JSON en POST het naar de server.
//
// Auteur: Steven Slaa
// ============================================

import { SerialPort } from "serialport";              // voor seriële communicatie
import { ReadlineParser } from "@serialport/parser-readline"; // om regels te lezen
import readline from "readline";                     // om commando’s van toetsenbord te lezen
import path from "path";                             // om de commandonaam in de hulptekst te bepalen

// === Vaste instellingen ===
const API_URL = "https://flipperboard.ti.datalabrotterdam.nl/api/scores"; // API waar scores naartoe gaan
const DEFAULT_BAUD_RATE = 9600; // baudrate, zelfde als Arduino Serial.begin()
const DEFAULT_MACHINE_ID = "team_1_flipper"; // standaard machine ID als die niet wordt meegestuurd
const RELEASE_WINDOW_MS = 15000; // tijd dat poort dicht gaat bij 'u'-commando (voor uploaden code)

// Hoe roep je deze app aan? "node app.js" vanuit broncode, of de binary
// zelf (bijv. "./flipper-serial-linux-x64") als gedownloade release.
const invokedFile = path.basename(process.argv[1] || "flipper-serial");
const COMMAND = invokedFile.endsWith(".js")
  ? "node app.js"
  : process.platform === "win32" ? invokedFile : `./${invokedFile}`;

// === Log functies (handig voor nette output) ===
const info = (msg) => console.log("[INFO]", msg);
const warn = (msg) => console.warn("[WARN]", msg);
const error = (msg) => console.error("[ERROR]", msg);

// === Instellingen (gevuld door main() na het lezen van de CLI-argumenten) ===
let SERIAL_PORT;
let BAUD_RATE;
let MACHINE_ID;

// === Variabelen voor seriële poort ===
let port;
let parser;
let isReleasing = false; // geeft aan of we de poort bewust sluiten voor upload

// ============================================
// CLI: argumenten lezen en --help / --list
// ============================================

function printHelp() {
  console.log(`
Flipperboard Serial Connector

Leest scores van een Arduino via de seriële poort en stuurt ze naar de
Flipperboard API.

Gebruik:
  ${COMMAND} [opties]

Opties:
  -p, --port <naam>     Seriële poort, bijv. COM9 (Windows) of
                         /dev/tty.usbserial-XXXX (macOS) / /dev/ttyUSB0 (Linux)
                         (of zet de SERIAL_PORT omgevingsvariabele)
  -b, --baud <rate>     Baudrate, zelfde als Arduino Serial.begin() (standaard: ${DEFAULT_BAUD_RATE})
  -m, --machine <id>    Machine ID als de Arduino er geen meestuurt (standaard: ${DEFAULT_MACHINE_ID})
  -l, --list            Toon beschikbare seriële poorten en stop
  -h, --help            Toon deze hulptekst en stop

Voorbeelden:
  ${COMMAND} --list
  ${COMMAND} --port COM9
  ${COMMAND} --port /dev/tty.usbserial-1410 --baud 9600

Terwijl de app draait:
  Typ 'u' + ENTER    Poort ${RELEASE_WINDOW_MS / 1000}s vrijgeven (voor Arduino upload)
  Typ 'l' + ENTER    Beschikbare seriële poorten opnieuw tonen
  CTRL + C           Applicatie afsluiten
`);
}

async function listPorts() {
  const ports = await SerialPort.list();

  if (ports.length === 0) {
    warn("Geen seriële poorten gevonden. Is de Arduino aangesloten via USB?");
    return;
  }

  info("Beschikbare seriële poorten:");
  for (const p of ports) {
    const extra = [p.manufacturer, p.serialNumber].filter(Boolean).join(", ");
    console.log(`  ${p.path}${extra ? "  (" + extra + ")" : ""}`);
  }
}

// Simpele argument-parser, geen extra dependency nodig voor dit CLI-tje.
function parseArgs(argv) {
  const args = { port: null, baud: null, machine: DEFAULT_MACHINE_ID };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "-l" || arg === "--list") return { list: true };
    if (arg === "-p" || arg === "--port") args.port = argv[++i];
    else if (arg === "-b" || arg === "--baud") args.baud = argv[++i];
    else if (arg === "-m" || arg === "--machine") args.machine = argv[++i];
    else {
      error(`Onbekende optie: ${arg}`);
      return { help: true, invalid: true };
    }
  }

  return args;
}

// === Functie om opnieuw te proberen als de poort wegvalt ===
function scheduleReconnect() {
  if (isReleasing) return; // niet opnieuw openen tijdens upload
  const delay = 2000 + Math.random() * 3000; // wacht 2-5 seconden
  info(`Probeer opnieuw te verbinden over ${Math.round(delay)}ms...`);
  setTimeout(openPort, delay);
}

// === Functie om de seriële poort te openen ===
async function openPort() {
  if (port && port.isOpen) return; // al open, niks doen

  info(`Opening serial port ${SERIAL_PORT} @ ${BAUD_RATE}`);

  // Maak de seriële poort aan
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE, autoOpen: false });

  // Parser zorgt dat we volledige regels krijgen (gescheiden door \n)
  parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  // Als er data binnenkomt → roep onLine() aan
  parser.on("data", onLine);

  // Handige events
  port.on("open", () => info("✅ Seriële poort geopend"));
  port.on("error", (err) => warn("Serial error: " + err.message));
  port.on("close", () => {
    warn("Seriële poort gesloten");
    scheduleReconnect(); // probeer opnieuw te verbinden
  });

  // Probeer de poort te openen
  port.open(async (err) => {
    if (err) {
      warn("Kan poort niet openen: " + err.message);
      await listPorts();
      scheduleReconnect();
    }
  });
}

// === Handler voor ontvangen regels ===
async function onLine(raw) {
  const line = raw.trim(); // verwijder spaties en newline
  info("Ontvangen: " + line);

  // Splits de regel op komma's
  const parts = line.split(",").map((p) => p.trim());

  // Controleer of er 2 of 3 velden zijn
  if (parts.length !== 2 && parts.length !== 3) {
    badFormat(line, `Verwacht 2 of 3 velden, vond ${parts.length}`);
    return;
  }

  // Haal velden uit de array
  const [player_name, scoreStr, machine_id = MACHINE_ID] = parts;
  const score = parseInt(scoreStr, 10);

  // Validatie
  if (!player_name) return badFormat(line, "Naam is leeg");
  if (isNaN(score)) return badFormat(line, `Score is geen getal ('${scoreStr}')`);
  if (!machine_id) return badFormat(line, "Machine ID is leeg");

  // Bouw JSON object
  const payload = { player_name, score, machine_id };

  // Verstuur naar API
  await sendPayload(payload);
}

// === Als de invoer fout is, toon uitleg en voorbeelden ===
function badFormat(line, reason) {
  warn(`❌ Ongeldig bericht: ${reason} — "${line}"`);
  warn("Correcte voorbeelden:");
  warn("  Steven,125000");
  warn("  Steven,125000,team_1_flipper");
}

// === Functie om data naar de API te sturen ===
async function sendPayload(payload) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      info(`✅ Score verzonden: ${JSON.stringify(payload)}`);
    } else {
      const text = await res.text();
      error(`❌ Server error: ${res.status} ${text}`);
    }
  } catch (err) {
    error("❌ Netwerkfout bij verzenden: " + err.message);
  }
}

// === CLI commando's (van toetsenbord, terwijl de app draait) ===
function startKeyboardCommands() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", async (cmd) => {
    const command = cmd.trim().toLowerCase();

    if (command === "u") {
      // 'u' = release poort tijdelijk voor upload
      if (!port || !port.isOpen) {
        info("Poort is al gesloten.");
        return;
      }
      info(`🔓 Poort vrijgegeven voor ${RELEASE_WINDOW_MS / 1000}s (Arduino upload).`);
      isReleasing = true;
      port.close(() => {
        setTimeout(() => {
          isReleasing = false;
          openPort(); // daarna poort weer openen
        }, RELEASE_WINDOW_MS);
      });
    } else if (command === "l") {
      await listPorts();
    }
  });
}

// === Start de app ===
async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    if (args.invalid) process.exitCode = 1;
    return;
  }
  if (args.list) return listPorts();

  SERIAL_PORT = args.port || process.env.SERIAL_PORT;
  BAUD_RATE = parseInt(args.baud || process.env.BAUD_RATE || DEFAULT_BAUD_RATE, 10);
  MACHINE_ID = args.machine;

  if (!SERIAL_PORT || isNaN(BAUD_RATE)) {
    if (!SERIAL_PORT) error("Geen seriële poort opgegeven. Gebruik --port <naam> of zet de SERIAL_PORT omgevingsvariabele.");
    if (isNaN(BAUD_RATE)) error(`Ongeldige baudrate: '${args.baud}'`);
    printHelp();
    await listPorts();
    process.exitCode = 1;
    return;
  }

  startKeyboardCommands();
  await openPort();
  info("App gestart. Typ 'u' + ENTER om poort tijdelijk te sluiten voor Arduino uploads.");
  info("             Typ 'l' + ENTER om beschikbare poorten te tonen.");
  info("             Typ CTRL + 'c' om applicatie te sluiten.");
}

main();
