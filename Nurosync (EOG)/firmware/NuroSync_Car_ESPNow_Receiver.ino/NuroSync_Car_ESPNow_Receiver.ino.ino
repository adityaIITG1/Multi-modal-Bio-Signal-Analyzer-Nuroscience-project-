#include <WiFi.h>
#include <esp_now.h>
#include "esp_mac.h"

#define IN1 12
#define IN2 13
#define IN3 14
#define IN4 27

// Forward/Backward max running time
#define SAFETY_TIMEOUT_MS 20000

// Left/Right short turn duration
#define TURN_DURATION_MS 350

typedef struct {
  char command[20];
} NuroCommand;

NuroCommand incoming;

String currentCommand = "STOP";
unsigned long lastCommandTime = 0;

// Used only for short left/right turn
bool turnPulseActive = false;
unsigned long turnStartTime = 0;

void stopCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

void forwardCar() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void backwardCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void leftCar() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
}

void rightCar() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
}

void printMac() {
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);

  Serial.printf(
    "CAR_REAL_MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
    mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
  );
}

void startTurnPulse(String direction) {
  if (direction == "LEFT") {
    leftCar();
    currentCommand = "LEFT";
    Serial.println("SHORT_TURN_LEFT_STARTED");
  } 
  else if (direction == "RIGHT") {
    rightCar();
    currentCommand = "RIGHT";
    Serial.println("SHORT_TURN_RIGHT_STARTED");
  }

  turnPulseActive = true;
  turnStartTime = millis();
  lastCommandTime = millis();
}

void executeCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  Serial.print("RECEIVED_CMD: ");
  Serial.println(cmd);

  if (cmd == "F" || cmd == "FORWARD") {
    turnPulseActive = false;
    forwardCar();
    currentCommand = "FORWARD";
    lastCommandTime = millis();
    Serial.println("CAR_FORWARD_20_SEC_MODE");
  } 
  else if (cmd == "B" || cmd == "BACKWARD") {
    turnPulseActive = false;
    backwardCar();
    currentCommand = "BACKWARD";
    lastCommandTime = millis();
    Serial.println("CAR_BACKWARD_20_SEC_MODE");
  } 
  else if (cmd == "L" || cmd == "LEFT") {
    startTurnPulse("LEFT");
  } 
  else if (cmd == "R" || cmd == "RIGHT") {
    startTurnPulse("RIGHT");
  } 
  else if (cmd == "S" || cmd == "STOP") {
    turnPulseActive = false;
    stopCar();
    currentCommand = "STOP";
    lastCommandTime = millis();
    Serial.println("CAR_STOPPED");
  } 
  else if (cmd == "E" || cmd == "EMERGENCY_STOP") {
    turnPulseActive = false;
    stopCar();
    currentCommand = "STOP";
    lastCommandTime = millis();
    Serial.println("EMERGENCY_STOP_EXECUTED");
  } 
  else {
    turnPulseActive = false;
    stopCar();
    currentCommand = "STOP";
    lastCommandTime = millis();
    Serial.println("UNKNOWN_COMMAND_STOPPED");
  }
}

void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  memset(&incoming, 0, sizeof(incoming));
  memcpy(&incoming, data, min(len, (int)sizeof(incoming)));

  executeCommand(String(incoming.command));
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  stopCar();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  delay(500);

  Serial.println("NUROSYNC CAR RECEIVER READY");
  printMac();

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP_NOW_INIT_FAILED");
    return;
  }

  esp_now_register_recv_cb(onReceive);

  Serial.println("ESP_NOW_RECEIVER_READY");
  Serial.println("FORWARD/BACKWARD = 20 sec max");
  Serial.println("LEFT/RIGHT = short pulse turn");
}

void loop() {
  if (Serial.available()) {
    executeCommand(Serial.readStringUntil('\n'));
  }

  // Auto stop after short left/right turn
  if (turnPulseActive && millis() - turnStartTime >= TURN_DURATION_MS) {
    stopCar();
    turnPulseActive = false;
    currentCommand = "STOP";
    Serial.println("SHORT_TURN_AUTO_STOP");
  }

  // Safety stop for forward/backward
  if (!turnPulseActive && currentCommand != "STOP" && millis() - lastCommandTime > SAFETY_TIMEOUT_MS) {
    stopCar();
    currentCommand = "STOP";
    Serial.println("SAFETY_TIMEOUT_STOP");
  }
}