#define ledPin 11
#define knopPin 2 
#define potPin A0
void setup() {
pinMode(ledPin, OUTPUT);
pinMode(knopPin, INPUT_PULLUP);
Serial.begin(9600);
}

void loop() {

int waarde = analogRead(potPin);
analogWrite(ledPin, waarde/4);   //max waarde is 255

} 