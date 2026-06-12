#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

SoftwareSerial sim800(3, 2); // RX, TX

const int buttonPin = A0;

String phoneNumber = "+917355757326"; // Change number

bool sent = false;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);

  lcd.init();
  lcd.backlight();

  sim800.begin(9600);

  lcd.setCursor(0, 0);
  lcd.print("Patient Alert");
  lcd.setCursor(0, 1);
  lcd.print("System Ready");

  delay(2000);
  lcd.clear();
}

void loop() {

  if (digitalRead(buttonPin) == LOW && !sent) {

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("EMERGENCY!");
    lcd.setCursor(0, 1);
    lcd.print("Sending SMS");

    sendSMS();

    delay(5000);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Calling...");

    makeCall();

    sent = true;
  }

  if (digitalRead(buttonPin) == HIGH) {
    sent = false;
  }
}

void sendSMS() {

  sim800.println("AT+CMGF=1");
  delay(1000);

  sim800.print("AT+CMGS=\"");
  sim800.print(phoneNumber);
  sim800.println("\"");
  delay(1000);

  sim800.println("EMERGENCY! Patient needs immediate assistance.");
  delay(500);

  sim800.write(26); // CTRL+Z
  delay(10000);
}

void makeCall() {

  sim800.print("ATD");
  sim800.print(phoneNumber);
  sim800.println(";");

  delay(20000); // Call for 20 sec

  sim800.println("ATH");
}