#include <WiFi.h>
#include <esp_now.h>

#define EOG_PIN 1

// Car ESP32 MAC Address
uint8_t carMac[] = {0xC0, 0xCD, 0xD6, 0x85, 0xC7, 0x4C};

typedef struct {
  char command[20];
} NuroCommand;

NuroCommand msg;

// Timing and calibration settings
const int SAMPLE_DELAY_MS = 10;
const int CALIBRATION_TIME_MS = 5000;
const int BLINK_THRESHOLD_OFFSET = 700;
const int RELEASE_OFFSET = 120;

const unsigned long COMMAND_COOLDOWN_MS = 1200;
const unsigned long BLINK_SEQUENCE_TIMEOUT_MS = 1500;
const unsigned long LONG_BLINK_MS = 1200;

// Signal variables
int baseline = 0;
int blinkThreshold = 0;
int releaseThreshold = 0;

// Blink detection variables
bool isBlinking = false;
unsigned long blinkStartTime = 0;
unsigned long lastBlinkDetectedTime = 0;
unsigned long lastCommandTime = 0;
int sequenceBlinkCount = 0;

// ESP-NOW send callback for ESP32 Arduino Core 3.x
void onSent(const wifi_tx_info_t *tx_info, esp_now_send_status_t status) {
  Serial.print("ESP-NOW Send Status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAILED");
}

void sendCommand(const char* command) {
  unsigned long now = millis();

  // Safety commands should never be blocked by cooldown
  bool isSafetyCommand =
    strcmp(command, "STOP") == 0 ||
    strcmp(command, "EMERGENCY_STOP") == 0;

  // Cooldown only for movement commands
  if (!isSafetyCommand && now - lastCommandTime < COMMAND_COOLDOWN_MS) {
    return;
  }

  memset(&msg, 0, sizeof(msg));
  strncpy(msg.command, command, sizeof(msg.command) - 1);

  esp_err_t result = esp_now_send(carMac, (uint8_t *)&msg, sizeof(msg));

  Serial.print("Command:");
  Serial.println(command);

  Serial.print("ESP-NOW Result:");
  Serial.println(result == ESP_OK ? "OK" : "ERROR");

  lastCommandTime = now;
}

void setupESPNow() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  Serial.print("Headband MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed");
    return;
  }

  esp_now_register_send_cb(onSent);

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, carMac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to add car peer");
    return;
  }

  Serial.println("Car peer added successfully");
}

void calibrateBaseline() {
  Serial.println("Calibration started...");
  Serial.println("Keep eyes open and still. Do not blink.");

  long sum = 0;
  int count = 0;
  unsigned long startTime = millis();

  while (millis() - startTime < CALIBRATION_TIME_MS) {
    int value = analogRead(EOG_PIN);
    sum += value;
    count++;
    delay(10);
  }

  if (count > 0) {
    baseline = sum / count;
  }

  blinkThreshold = baseline + BLINK_THRESHOLD_OFFSET;
  releaseThreshold = baseline + RELEASE_OFFSET;

  isBlinking = false;
  sequenceBlinkCount = 0;

  Serial.println("Calibration complete");

  Serial.print("Baseline:");
  Serial.println(baseline);

  Serial.print("Blink Threshold:");
  Serial.println(blinkThreshold);

  Serial.print("Release Threshold:");
  Serial.println(releaseThreshold);
}

void applyManualThreshold(int newThreshold) {
  if (newThreshold <= 0 || newThreshold > 4095) {
    Serial.print("Threshold update failed. Invalid value:");
    Serial.println(newThreshold);
    return;
  }

  blinkThreshold = newThreshold;

  // Release threshold should remain near baseline
  releaseThreshold = baseline + RELEASE_OFFSET;

  isBlinking = false;
  sequenceBlinkCount = 0;

  Serial.print("Manual threshold updated:");
  Serial.println(blinkThreshold);

  Serial.print("Baseline:");
  Serial.println(baseline);

  Serial.print("Blink Threshold:");
  Serial.println(blinkThreshold);

  Serial.print("Release Threshold:");
  Serial.println(releaseThreshold);
}

void executeBlinkSequence(int count) {
  if (count == 1) {
    sendCommand("FORWARD");
  } 
  else if (count == 2) {
    sendCommand("LEFT");
  } 
  else if (count == 3) {
    sendCommand("RIGHT");
  } 
  else if (count == 4) {
    sendCommand("BACKWARD");
  } 
  else {
    sendCommand("STOP");
  }

  Serial.print("Blink sequence executed: ");
  Serial.println(count);
}

void handleBlink(int rawValue) {
  unsigned long now = millis();

  // Blink starts when raw signal crosses threshold
  if (!isBlinking && rawValue > blinkThreshold) {
    isBlinking = true;
    blinkStartTime = now;
    Serial.println("Blink started");
  }

  // Blink ends when raw signal comes below release threshold
  if (isBlinking && rawValue < releaseThreshold) {
    isBlinking = false;

    unsigned long blinkDuration = now - blinkStartTime;

    // Long blink = emergency stop
    if (blinkDuration >= LONG_BLINK_MS) {
      sendCommand("EMERGENCY_STOP");
      sequenceBlinkCount = 0;
      Serial.println("Long blink detected");
      return;
    }

    // Normal blink
    if (blinkDuration > 40 && blinkDuration < 900) {
      sequenceBlinkCount++;
      lastBlinkDetectedTime = now;

      Serial.print("Blink detected in sequence: ");
      Serial.println(sequenceBlinkCount);
    }
  }

  // Execute blink sequence after timeout
  if (sequenceBlinkCount > 0 && now - lastBlinkDetectedTime > BLINK_SEQUENCE_TIMEOUT_MS) {
    executeBlinkSequence(sequenceBlinkCount);
    sequenceBlinkCount = 0;
  }
}

void handleSerialCommand() {
  if (!Serial.available()) {
    return;
  }

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.length() == 0) {
    return;
  }

  String upperCmd = cmd;
  upperCmd.toUpperCase();

  if (upperCmd == "F") {
    sendCommand("FORWARD");
  } 
  else if (upperCmd == "S") {
    sendCommand("STOP");
  } 
  else if (upperCmd == "L") {
    sendCommand("LEFT");
  } 
  else if (upperCmd == "R") {
    sendCommand("RIGHT");
  } 
  else if (upperCmd == "B") {
    sendCommand("BACKWARD");
  } 
  else if (upperCmd == "E") {
    sendCommand("EMERGENCY_STOP");
  } 
  else if (upperCmd == "C") {
    calibrateBaseline();
  } 
  else if (upperCmd.startsWith("T:")) {
    int newThreshold = upperCmd.substring(2).toInt();
    applyManualThreshold(newThreshold);
  } 
  else {
    Serial.print("Unknown serial command:");
    Serial.println(cmd);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(EOG_PIN, INPUT);

  Serial.println("NuroSync Headband Multi Command");
  Serial.println("Starting ESP-NOW...");

  setupESPNow();

  // Safety stop at startup
  sendCommand("STOP");

  // Initial baseline calibration
  calibrateBaseline();

  Serial.println("Ready:");
  Serial.println("1 blink = FORWARD");
  Serial.println("2 blinks = LEFT");
  Serial.println("3 blinks = RIGHT");
  Serial.println("4 blinks = BACKWARD");
  Serial.println("5+ blinks = STOP");
  Serial.println("Long blink = EMERGENCY_STOP");
  Serial.println("Serial commands: F/S/L/R/B/E/C");
  Serial.println("Manual threshold command: T:<value>");
}

void loop() {
  int rawValue = analogRead(EOG_PIN);

  // Telemetry for Python app
  Serial.print("Raw_Signal:");
  Serial.print(rawValue);

  Serial.print(",Baseline:");
  Serial.print(baseline);

  Serial.print(",Blink_Threshold:");
  Serial.println(blinkThreshold);

  handleBlink(rawValue);
  handleSerialCommand();

  delay(SAMPLE_DELAY_MS);
}