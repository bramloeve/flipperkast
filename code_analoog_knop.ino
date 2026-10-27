#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Servo.h>

// Servo's
Servo servo1;
Servo servo2;

// OLED display
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// MPU6050
const int MPU = 0x68;

// Knoppen
const int button1 = 2;
const int button2 = 3;

// IR-sensoren
const int irSensorPin1 = 4; // punten
const int irSensorPin2 = 5; // reset

// Score
int score = 0;

// Gegevens voor verzenden
String naam = "bram";
String machine = "flipper";

// Statussen
bool vorigeStatus1 = false;
bool vorigeStatus2 = false;
bool tiltActief = false;

// Score verzenden
void zendScore(String naam, long score, String machine) {
  Serial.print(naam);
  Serial.print(",");
  Serial.print(score);
  Serial.print(",");
  Serial.println(machine);
}


// Normale scoreweergave
void updateDisplay() {

  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(WHITE);

  // lijn printen
  for (int x = 0; x < SCREEN_WIDTH; x++) {
    display.drawPixel(x, 0, WHITE);
  }

  display.setCursor(0, 15);
  display.print("Score:");

  display.setCursor(0, 40);
  display.print(score);

  display.display();
}

// Tilt melding
void toonTilt() {

  display.clearDisplay();

  display.setTextSize(3);
  display.setTextColor(WHITE);
  display.setCursor(15, 10);
  display.print("TILT!");

  display.setTextSize(1);
  display.setCursor(5, 50);
  display.print("Sensoren geblokkeerd");

  display.display();
}

void setup() {

  Serial.begin(9600);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    while (true);
  }

  // I2C starten
  Wire.begin();

  // MPU6050 activeren
  Wire.beginTransmission(MPU);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission(true);

  // Servo's
  servo1.attach(9);
  servo2.attach(10);

  servo1.write(0);
  servo2.write(90);

  // Knoppen
  pinMode(button1, INPUT_PULLUP);
  pinMode(button2, INPUT_PULLUP);

  // IR-sensoren
  pinMode(irSensorPin1, INPUT);
  pinMode(irSensorPin2, INPUT);

  updateDisplay();

  // Eerste score verzenden
  zendScore(naam, score, machine);
}

void loop() {

  // MPU6050 uitlezen
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU, 6, true);

  int16_t AcX = Wire.read() << 8 | Wire.read();
  int16_t AcY = Wire.read() << 8 | Wire.read();
  int16_t AcZ = Wire.read() << 8 | Wire.read();

  int waarden[3] = {AcX, AcY, AcZ};

  tiltActief = false;

  // Controle X en Y-as
  for (int i = 0; i < 2; i++) {

    if (abs(waarden[i]) > 18000) {
      tiltActief = true;
    }
  }

  // TILT actief
  if (tiltActief) {

    toonTilt();

  } else {

    // Puntensensor
    bool balGedetecteerd1 = digitalRead(irSensorPin1);

    if (balGedetecteerd1 && !vorigeStatus1) {
      score += 100;
      updateDisplay();
      zendScore(naam, score, machine);
    }

    vorigeStatus1 = balGedetecteerd1;

    // Resetsensor
    bool balGedetecteerd2 = digitalRead(irSensorPin2);

    if (balGedetecteerd2 && !vorigeStatus2) {
      score = 0;
      updateDisplay();
      zendScore(naam, score, machine);
    }

    vorigeStatus2 = balGedetecteerd2;
  }

  // Servo 1
  if (digitalRead(button1) == LOW) {
    servo1.write(90);
  } else {
    servo1.write(0);
  }

  // Servo 2
  if (digitalRead(button2) == LOW) {
    servo2.write(0);
  } else {
    servo2.write(90);
  }

  delay(50);
}