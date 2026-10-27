# Flipperboard Serial Connector

Deze applicatie leest **seriële berichten** van een Arduino en stuurt de scores door naar de **Flipperboard API**.
Zo komen de scores die op de Arduino worden berekend automatisch in de online scorelijst.

Er zijn twee manieren om deze app te draaien — kies er één:

| | |
|---|---|
| 🟢 **BINARY** (aanbevolen) | Kant-en-klaar programma downloaden. Geen installatie nodig. |
| 🔵 **NODE** | Draaien vanuit de broncode. Nodig als je zelf aan `app.js` wilt sleutelen. |

Alle voorbeelden hieronder tonen beide varianten, steeds gelabeld met
**BINARY** of **NODE**, zodat je precies weet welke regel bij jou hoort.

---

## 🟢 BINARY — kant-en-klaar programma (geen Node.js nodig)

1. Ga naar **Releases** van dit project en download het bestand voor jouw
   besturingssysteem (bijv. `flipper-serial-windows-x64.exe`,
   `flipper-serial-macos-arm64`, `flipper-serial-linux-x64`).
2. macOS/Linux: maak het bestand uitvoerbaar (eenmalig):

   ```bash
   chmod +x flipper-serial-macos-arm64
   ```

Dat is alles — geen `npm install`, geen Node.js. Ga verder naar **▶️ Applicatie starten** hieronder.

---

## 🔵 NODE — draaien vanuit de broncode

1. Zorg dat **Node.js** is geïnstalleerd. Controleer dit met:

   ```bash
   node -v
   npm -v
   ```

2. Ga in de map waar je `package.json` en `app.js` hebt staan.
3. Installeer de benodigde libraries:

   ```bash
   npm install
   ```

Ga verder naar **▶️ Applicatie starten** hieronder.

---

## ▶️ Applicatie starten

1. Sluit je Arduino aan via USB.
2. Weet je jouw poortnaam niet? Laat de app het uitzoeken:

   ```bash
   # BINARY (macOS/Linux)
   ./flipper-serial-macos-arm64 --list

   # BINARY (Windows)
   flipper-serial-windows-x64.exe --list

   # NODE
   node app.js --list
   ```

3. Start de applicatie met die poort:

   ```bash
   # BINARY (macOS/Linux)
   ./flipper-serial-macos-arm64 --port /dev/tty.usbserial-1410

   # BINARY (Windows)
   flipper-serial-windows-x64.exe --port COM9

   # NODE
   node app.js --port COM9
   ```

   Alle opties (poort, baudrate, machine ID) staan achter `--help`. Vergeet
   je `--port`, dan toont de app automatisch de hulptekst en de beschikbare
   poorten.
4. Je ziet in de terminal iets zoals:

   ```
   [INFO] Opening serial port COM9 @ 9600
   [INFO] ✅ Seriële poort geopend
   [INFO] App gestart. Typ 'u' + ENTER om poort tijdelijk te sluiten voor Arduino uploads.
   [INFO]              Typ 'l' + ENTER om beschikbare poorten te tonen.
   [INFO]              Typ CTRL + 'c' om applicatie te sluiten.
   ```

---

## 🎮 Arduino berichten

De Arduino moet een bericht sturen via `Serial.println` in de vorm:

* Alleen naam + score:

  ```cpp
  Serial.println("Steven,125000");
  ```

* Of met machine ID erbij:

  ```cpp
  Serial.println("Steven,125000,team_1_flipper");
  ```

De app verstuurt dit automatisch naar de API als JSON.

---

## 🛠️ Problemen oplossen

* ❓ **Welke poort moet ik gebruiken?** → start de app met `--list`
  (BINARY: `./flipper-serial-macos-arm64 --list`, NODE: `node app.js --list`)
  om alle aangesloten poorten te tonen.
* ❌ **Ongeldig bericht** → de app geeft tips in de terminal.
* 🔓 **Arduino kan niet uploaden** → typ `u` in de terminal, dan sluit de app de poort 15 seconden.
* 🌐 **Geen internet** → de app blijft luisteren en geeft een foutmelding.

---

<details>
<summary>🔧 Developer docs: hoe een release werkt</summary>

### Een nieuwe release uitbrengen

Push een tag die begint met `serial-v` (bijv. `serial-v1.1.0`) — de GitLab
CI bouwt dan automatisch BINARY-bestanden voor Linux (x64/arm64), macOS
(Intel/Apple Silicon) en Windows, en publiceert ze als GitLab Release met
een changelog van de commits sinds de vorige `serial-v*` tag die iets in
deze map hebben aangepast.

```bash
git tag serial-v1.1.0
git push origin serial-v1.1.0
```

De `serial-v*` tagpatroon moet protected staan (Settings > Repository >
Protected tags) — anders draait de pipeline niet, want de CI-runner pakt
alleen protected refs op.

### Lokaal builden

```bash
npm run build:release
```

Vereist [Bun](https://bun.sh). Zie `scripts/build-release.sh` — de
belangrijkste kanttekening daar: serialport's native addon kiest zijn
binary dynamisch op basis van het platform, wat Bun's bundler niet kan
volgen bij een cross-platform build. Het script patcht dat tijdelijk naar
een statische require per target, zodat de juiste binary alsnog wordt
meegebundeld.

### CI-configuratie

`.gitlab-ci.yml` (root) + `.gitlab/ci/serial-to-http-release.yml`:
- `build-serial-to-http` draait automatisch bij wijzigingen onder deze map
  op een protected ref, en bouwt + uploadt de binaries naar de generic
  package registry (niet als CI-artifact — die zijn samen te groot voor
  deze instance).
- `release-serial-to-http` draait alleen op een `serial-v*` tag en maakt
  de GitLab Release aan met changelog + downloadlinks.

</details>

---

Geschreven door: Steven en Alexander Slaa
