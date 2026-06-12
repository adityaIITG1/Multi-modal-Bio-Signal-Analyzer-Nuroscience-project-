/*
  NeuroPulseAI 4-Channel EMG WiFi UDP Sender
  Board: Arduino UNO R4 WiFi

  Wiring:
    Sensor 1 OUT -> A0
    Sensor 2 OUT -> A1
    Sensor 3 OUT -> A2
    Sensor 4 OUT -> A3
    All sensor GND/REF -> Arduino GND
    Sensor VCC -> as per your BioAmp board requirement

  Sends UDP broadcast to the Python plotter:
    time_ms,sig1,env1,sig2,env2,sig3,env3,sig4,env4

  Plot colors in the updated Python plotter:
    Yellow = cleaned centered signal
    Green  = muscle strength/envelope
    Red    = active muscle shadow where envelope is above threshold

  Plotter settings:
    Auto WiFi UDP: ON
    IP: 0.0.0.0
    Port: 4210
*/

#include <WiFiS3.h>
#include <WiFiUdp.h>

const int CH1_PIN = A0;
const int CH2_PIN = A1;
const int CH3_PIN = A2;
const int CH4_PIN = A3;

char ssid[] = "vivo T4 5G";
char password[] = "thinkpositive";
const unsigned int receiverPort = 4210;

const unsigned long SAMPLE_INTERVAL_US = 2000; // 500 Hz
const int BASELINE_SAMPLES = 1000;
const int NOISE_SAMPLES = 1000;
const int UDP_BATCH_COUNT = 10;

const float BASE_ALPHA = 0.001;
const float CLEAN_ALPHA = 0.25;
const float ENV_ALPHA = 0.06;
const float IDLE_NOISE_ALPHA = 0.002;

// Sensitivity controls:
// Increase gains if contractions still look too small.
// Increase gates only if idle/disconnected noise becomes visible.
const float SIGNAL_GAIN = 4.0;
const float STRENGTH_GAIN = 7.0;
const float NOISE_GATE_MULTIPLIER = 2.4;
const float MIN_NOISE_GATE = 3.0;
const int ACTIVE_CONFIRM_SAMPLES = 4;

unsigned long lastSample = 0;

float base1 = 512, base2 = 512, base3 = 512, base4 = 512;
float clean1 = 0, clean2 = 0, clean3 = 0, clean4 = 0;
float env1 = 0, env2 = 0, env3 = 0, env4 = 0;
float noise1 = 0, noise2 = 0, noise3 = 0, noise4 = 0;
int activeCount1 = 0, activeCount2 = 0, activeCount3 = 0, activeCount4 = 0;

char udpBuffer[1024];
int udpBufferLen = 0;
int udpSampleCount = 0;

WiFiUDP udp;
IPAddress broadcastIP;
bool wifiConnected = false;

struct EmgSample {
  float signal;
  float strength;
};

IPAddress getBroadcastIP(IPAddress localIP, IPAddress subnetMask) {
  IPAddress ip;
  for (int i = 0; i < 4; i++) {
    ip[i] = localIP[i] | (~subnetMask[i]);
  }
  return ip;
}

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  int status = WL_IDLE_STATUS;
  while (status != WL_CONNECTED) {
    status = WiFi.begin(ssid, password);
    delay(2000);
    Serial.print(".");
  }

  wifiConnected = true;
  udp.begin(receiverPort);
  broadcastIP = getBroadcastIP(WiFi.localIP(), WiFi.subnetMask());

  Serial.println();
  Serial.print("WiFi connected. Arduino IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Broadcast IP: ");
  Serial.println(broadcastIP);
  Serial.print("UDP port: ");
  Serial.println(receiverPort);
}

void sendStatus(const char *message) {
  Serial.println(message);

  if (!wifiConnected) {
    return;
  }

  udp.beginPacket(broadcastIP, receiverPort);
  udp.write((const uint8_t *)message, strlen(message));
  udp.endPacket();
}

EmgSample processChannel(
  int pin,
  float &baseline,
  float &cleaned,
  float &envelope,
  float &noiseFloor,
  int &activeCount
) {
  int raw = analogRead(pin);

  baseline = (1.0 - BASE_ALPHA) * baseline + BASE_ALPHA * raw;

  float centered = raw - baseline;
  cleaned = (1.0 - CLEAN_ALPHA) * cleaned + CLEAN_ALPHA * centered;

  float rectified = abs(cleaned);
  envelope = (1.0 - ENV_ALPHA) * envelope + ENV_ALPHA * rectified;

  float gate = max(MIN_NOISE_GATE, noiseFloor * NOISE_GATE_MULTIPLIER);
  bool aboveGate = envelope > gate;

  if (aboveGate) {
    activeCount++;
    if (activeCount > ACTIVE_CONFIRM_SAMPLES) {
      activeCount = ACTIVE_CONFIRM_SAMPLES;
    }
  } else {
    activeCount = 0;
    noiseFloor = (1.0 - IDLE_NOISE_ALPHA) * noiseFloor + IDLE_NOISE_ALPHA * envelope;
  }

  bool confirmedActive = activeCount >= ACTIVE_CONFIRM_SAMPLES;
  float strength = confirmedActive ? (envelope - gate) * STRENGTH_GAIN : 0.0;
  float signal = confirmedActive ? cleaned * SIGNAL_GAIN : 0.0;

  EmgSample out = {signal, strength};
  return out;
}

float processNoiseOnly(int pin, float &baseline, float &cleaned, float &envelope) {
  int raw = analogRead(pin);

  baseline = (1.0 - BASE_ALPHA) * baseline + BASE_ALPHA * raw;
  float centered = raw - baseline;
  cleaned = (1.0 - CLEAN_ALPHA) * cleaned + CLEAN_ALPHA * centered;
  envelope = (1.0 - ENV_ALPHA) * envelope + ENV_ALPHA * abs(cleaned);

  return envelope;
}

void calibrateBaseline() {
  sendStatus("# Baseline calibration started. Keep electrodes connected and muscles relaxed.");

  long s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  for (int i = 0; i < BASELINE_SAMPLES; i++) {
    s1 += analogRead(CH1_PIN);
    s2 += analogRead(CH2_PIN);
    s3 += analogRead(CH3_PIN);
    s4 += analogRead(CH4_PIN);
    delayMicroseconds(SAMPLE_INTERVAL_US);

    if (i == 250) sendStatus("# Baseline calibration 25%");
    if (i == 500) sendStatus("# Baseline calibration 50%");
    if (i == 750) sendStatus("# Baseline calibration 75%");
  }

  base1 = s1 / (float)BASELINE_SAMPLES;
  base2 = s2 / (float)BASELINE_SAMPLES;
  base3 = s3 / (float)BASELINE_SAMPLES;
  base4 = s4 / (float)BASELINE_SAMPLES;

  clean1 = clean2 = clean3 = clean4 = 0;
  env1 = env2 = env3 = env4 = 0;
  activeCount1 = activeCount2 = activeCount3 = activeCount4 = 0;

  sendStatus("# Baseline calibration complete.");
}

void calibrateNoiseFloor() {
  sendStatus("# Idle noise calibration started. Do not contract muscles.");

  float n1 = 0, n2 = 0, n3 = 0, n4 = 0;
  for (int i = 0; i < NOISE_SAMPLES; i++) {
    n1 += processNoiseOnly(CH1_PIN, base1, clean1, env1);
    n2 += processNoiseOnly(CH2_PIN, base2, clean2, env2);
    n3 += processNoiseOnly(CH3_PIN, base3, clean3, env3);
    n4 += processNoiseOnly(CH4_PIN, base4, clean4, env4);
    delayMicroseconds(SAMPLE_INTERVAL_US);

    if (i == 250) sendStatus("# Idle noise calibration 25%");
    if (i == 500) sendStatus("# Idle noise calibration 50%");
    if (i == 750) sendStatus("# Idle noise calibration 75%");
  }

  noise1 = n1 / (float)NOISE_SAMPLES;
  noise2 = n2 / (float)NOISE_SAMPLES;
  noise3 = n3 / (float)NOISE_SAMPLES;
  noise4 = n4 / (float)NOISE_SAMPLES;

  clean1 = clean2 = clean3 = clean4 = 0;
  env1 = env2 = env3 = env4 = 0;

  char statusLine[128];
  snprintf(
    statusLine,
    sizeof(statusLine),
    "# Calibration complete. Noise floors: %.2f, %.2f, %.2f, %.2f",
    noise1,
    noise2,
    noise3,
    noise4
  );
  sendStatus(statusLine);
  sendStatus("# Streaming started. Press CLEAR in plotter for a fresh session.");
}

void sendUdpBatchIfReady() {
  if (!wifiConnected) {
    udpBufferLen = 0;
    udpSampleCount = 0;
    return;
  }

  if (udpSampleCount >= UDP_BATCH_COUNT && udpBufferLen > 0) {
    udp.beginPacket(broadcastIP, receiverPort);
    udp.write((uint8_t *)udpBuffer, udpBufferLen);
    udp.endPacket();

    udpBufferLen = 0;
    udpSampleCount = 0;
  }
}

void addLineToUdpBatch(char *line, int lineLen) {
  if (!wifiConnected || lineLen <= 0) {
    return;
  }

  if (udpBufferLen > 0 && udpBufferLen + lineLen + 1 < sizeof(udpBuffer)) {
    udpBuffer[udpBufferLen++] = '\n';
  }

  if (udpBufferLen + lineLen < sizeof(udpBuffer)) {
    memcpy(udpBuffer + udpBufferLen, line, lineLen);
    udpBufferLen += lineLen;
    udpSampleCount++;
  } else {
    udpBufferLen = 0;
    udpSampleCount = 0;
  }

  sendUdpBatchIfReady();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(CH1_PIN, INPUT);
  pinMode(CH2_PIN, INPUT);
  pinMode(CH3_PIN, INPUT);
  pinMode(CH4_PIN, INPUT);

  connectWiFi();
  calibrateBaseline();
  calibrateNoiseFloor();

  lastSample = micros();
}

void loop() {
  static unsigned long lastWifiCheck = 0;
  if (millis() - lastWifiCheck >= 1000) {
    lastWifiCheck = millis();

    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      connectWiFi();
    }
  }

  unsigned long now = micros();
  if (now - lastSample >= SAMPLE_INTERVAL_US) {
    lastSample = now;

    EmgSample ch1 = processChannel(CH1_PIN, base1, clean1, env1, noise1, activeCount1);
    EmgSample ch2 = processChannel(CH2_PIN, base2, clean2, env2, noise2, activeCount2);
    EmgSample ch3 = processChannel(CH3_PIN, base3, clean3, env3, noise3, activeCount3);
    EmgSample ch4 = processChannel(CH4_PIN, base4, clean4, env4, noise4, activeCount4);

    char line[128];
    int lineLen = snprintf(
      line,
      sizeof(line),
      "%lu,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f",
      millis(),
      ch1.signal, ch1.strength,
      ch2.signal, ch2.strength,
      ch3.signal, ch3.strength,
      ch4.signal, ch4.strength
    );

    addLineToUdpBatch(line, lineLen);

    static unsigned long lastPrint = 0;
    if (millis() - lastPrint >= 1000) {
      lastPrint = millis();
      Serial.println(line);
    }
  }
}
