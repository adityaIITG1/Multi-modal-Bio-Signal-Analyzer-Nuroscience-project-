/*
  NeuroPulseAI 4-Channel EMG BLE Sender
  Board: Arduino UNO R4 WiFi

  Sends BLE notifications to the Python plotter as:
    time_ms,ch1,ch2,ch3,ch4

  Install in Arduino IDE:
    Library Manager -> ArduinoBLE

  Note:
    BLE is lower throughput than USB/WiFi UDP. This sketch sends the smoothed
    EMG envelope at 100 Hz for stable laptop Bluetooth reception.
*/

#include <ArduinoBLE.h>

const int CH1_PIN = A0;
const int CH2_PIN = A1;
const int CH3_PIN = A2;
const int CH4_PIN = A3;

const unsigned long SAMPLE_INTERVAL_US = 10000; // 100 Hz over BLE
unsigned long lastSample = 0;

float base1 = 512, base2 = 512, base3 = 512, base4 = 512;
float env1 = 0, env2 = 0, env3 = 0, env4 = 0;

const float BASE_ALPHA = 0.001;
const float ENV_ALPHA = 0.08;

BLEService emgService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic emgDataChar(
  "19B10001-E8F2-537E-4F6C-D104768A1214",
  BLERead | BLENotify,
  64
);

float processEMG(int pin, float &baseline, float &envelope) {
  int raw = analogRead(pin);
  baseline = (1.0 - BASE_ALPHA) * baseline + BASE_ALPHA * raw;
  float centered = raw - baseline;
  float rectified = abs(centered);
  envelope = (1.0 - ENV_ALPHA) * envelope + ENV_ALPHA * rectified;
  return envelope;
}

void initBaseline() {
  long s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  for (int i = 0; i < 500; i++) {
    s1 += analogRead(CH1_PIN);
    s2 += analogRead(CH2_PIN);
    s3 += analogRead(CH3_PIN);
    s4 += analogRead(CH4_PIN);
    delay(2);
  }

  base1 = s1 / 500.0;
  base2 = s2 / 500.0;
  base3 = s3 / 500.0;
  base4 = s4 / 500.0;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  initBaseline();

  if (!BLE.begin()) {
    Serial.println("BLE failed to start");
    while (1) {
      delay(1000);
    }
  }

  BLE.setLocalName("NeuroPulseAI-4CH");
  BLE.setDeviceName("NeuroPulseAI-4CH");
  BLE.setAdvertisedService(emgService);
  emgService.addCharacteristic(emgDataChar);
  BLE.addService(emgService);
  emgDataChar.writeValue("0,0,0,0,0");
  BLE.advertise();

  Serial.println("BLE advertising as NeuroPulseAI-4CH");
}

void loop() {
  BLEDevice central = BLE.central();

  if (!central) {
    return;
  }

  Serial.print("BLE connected: ");
  Serial.println(central.address());

  while (central.connected()) {
    BLE.poll();

    unsigned long now = micros();
    if (now - lastSample >= SAMPLE_INTERVAL_US) {
      lastSample = now;

      float ch1 = processEMG(CH1_PIN, base1, env1);
      float ch2 = processEMG(CH2_PIN, base2, env2);
      float ch3 = processEMG(CH3_PIN, base3, env3);
      float ch4 = processEMG(CH4_PIN, base4, env4);

      char line[64];
      snprintf(
        line,
        sizeof(line),
        "%lu,%.2f,%.2f,%.2f,%.2f\n",
        millis(),
        ch1,
        ch2,
        ch3,
        ch4
      );

      emgDataChar.writeValue(line);
      Serial.print(line);
    }
  }

  Serial.println("BLE disconnected");
}
