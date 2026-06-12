/*
  NeuroPulseAI 4-Channel EMG Sender
  UNO R4 WiFi
  Auto wireless using UDP broadcast
  Baud: 115200

  Output:
  millis,sig1,env1,sig2,env2,sig3,env3,sig4,env4

  WiFi:
    SSID = vivo T4 5G
    Password = thinkpositive

  OLED pages:
    1) Branding
    2) Left Side: CH1, CH2
    3) Right Side: CH3, CH4
    4) Left Avg / Right Avg / L-R Ratio
    5) System Status
*/

#include <WiFiS3.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SAMPLE_RATE 500
#define BAUD_RATE 460800
#define BUFFER_SIZE 128
#define FILTER_SETTLE_SAMPLES (SAMPLE_RATE * 2)

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C

const int CH_PINS[4] = {A0, A1, A2, A3};

char ssid[] = "vivo T4 5G";
char password[] = "thinkpositive";
const unsigned int receiverPort = 4210;

WiFiUDP udp;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

int circular_buffer[4][BUFFER_SIZE];
int data_index[4] = {0, 0, 0, 0};
long sum_env[4] = {0, 0, 0, 0};

struct BiquadState { float z1; float z2; };
struct EMGFilterState {
  BiquadState s1;
  BiquadState s2;
  BiquadState s3;
  BiquadState s4;
};
EMGFilterState filterState[4];

float latestSig[4] = {0, 0, 0, 0};
int latestEnv[4] = {0, 0, 0, 0};

// UDP batching — use fixed char buffer, NO String heap allocation
#define UDP_BUFFER_COUNT 20
#define UDP_PACKET_MAX 2048
char udp_buf[UDP_PACKET_MAX];
int udp_buf_len = 0;
int udp_sample_counter = 0;

bool wifi_connected = false;
IPAddress broadcastIP;
unsigned long last_wifi_check = 0;

unsigned long lastOledSwitch = 0;
int oledPage = 0;
const unsigned long OLED_PAGE_INTERVAL = 5000;   // 5s per page (was 2.5s)


IPAddress getBroadcastIP(IPAddress localIP, IPAddress subnetMask) {
  IPAddress broadcastIP;
  for (int i = 0; i < 4; i++) {
    broadcastIP[i] = localIP[i] | (~subnetMask[i]);
  }
  return broadcastIP;
}

void connectWiFi() {
  Serial.println("Attempting to connect to WiFi...");
  int status = WL_IDLE_STATUS;
  int attempts = 0;
  
  // Try to connect up to 3 times to prevent blocking the USB Serial functionality
  while (status != WL_CONNECTED && attempts < 3) {
    attempts++;
    Serial.print("WiFi Attempt ");
    Serial.print(attempts);
    Serial.println("...");
    status = WiFi.begin(ssid, password);
    delay(2000);
  }
  
  if (status == WL_CONNECTED) {
    Serial.print("WiFi connected. Board IP: ");
    Serial.println(WiFi.localIP());
    udp.begin(receiverPort);
  } else {
    Serial.println("WiFi not found or failed. Continuing in USB Serial mode only.");
  }
}

float EMGFilterChannel(float input, EMGFilterState &st) {
  float output = input;
  {
    float x = output - 0.05159732f * st.s1.z1 - 0.36347401f * st.s1.z2;
    output = 0.01856301f * x + 0.03712602f * st.s1.z1 + 0.01856301f * st.s1.z2;
    st.s1.z2 = st.s1.z1; st.s1.z1 = x;
  }
  {
    float x = output - -0.53945795f * st.s2.z1 - 0.39764934f * st.s2.z2;
    output = 1.00000000f * x + -2.00000000f * st.s2.z1 + 1.00000000f * st.s2.z2;
    st.s2.z2 = st.s2.z1; st.s2.z1 = x;
  }
  {
    float x = output - 0.47319594f * st.s3.z1 - 0.70744137f * st.s3.z2;
    output = 1.00000000f * x + 2.00000000f * st.s3.z1 + 1.00000000f * st.s3.z2;
    st.s3.z2 = st.s3.z1; st.s3.z1 = x;
  }
  {
    float x = output - -1.00211112f * st.s4.z1 - 0.74520226f * st.s4.z2;
    output = 1.00000000f * x + -2.00000000f * st.s4.z1 + 1.00000000f * st.s4.z2;
    st.s4.z2 = st.s4.z1; st.s4.z1 = x;
  }
  return output;
}

int getEnvelopeChannel(int ch, int abs_emg) {
  sum_env[ch] -= circular_buffer[ch][data_index[ch]];
  sum_env[ch] += abs_emg;
  circular_buffer[ch][data_index[ch]] = abs_emg;
  data_index[ch] = (data_index[ch] + 1) % BUFFER_SIZE;
  return (sum_env[ch] / BUFFER_SIZE) * 2;
}

void settleAnalogFilters() {
  for (int sample = 0; sample < FILTER_SETTLE_SAMPLES; sample++) {
    for (int i = 0; i < 4; i++) {
      int sensor_value = analogRead(CH_PINS[i]);
      latestSig[i] = EMGFilterChannel((float)sensor_value, filterState[i]);
      latestEnv[i] = getEnvelopeChannel(i, abs((int)latestSig[i]));
    }
    delayMicroseconds(1000000 / SAMPLE_RATE);
  }

  for (int i = 0; i < 4; i++) {
    latestSig[i] = 0.0f;
    latestEnv[i] = 0;
  }
}

void initOLED() {
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED init failed");
    return;
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.display();

  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(4, 6);
  display.println("Neuro");
  display.setCursor(4, 26);
  display.println("PulseAI");
  display.setTextSize(1);
  display.setCursor(4, 52);
  display.println("Debuggers Squad");
  display.display();
  delay(1800);
}

void drawBrandPage() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 4);
  display.println("Neuro");
  display.setCursor(0, 24);
  display.println("PulseAI");
  display.setTextSize(1);
  display.setCursor(0, 50);
  display.println("4CH EMG System");
  display.display();
}

void drawLeftPage() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Left Side");
  display.setCursor(0, 18);
  display.print("CH1: ");
  display.print(latestEnv[0]);
  display.setCursor(0, 34);
  display.print("CH2: ");
  display.print(latestEnv[1]);
  display.display();
}

void drawRightPage() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Right Side");
  display.setCursor(0, 18);
  display.print("CH3: ");
  display.print(latestEnv[2]);
  display.setCursor(0, 34);
  display.print("CH4: ");
  display.print(latestEnv[3]);
  display.display();
}

void drawComparePage() {
  float leftAvg = (latestEnv[0] + latestEnv[1]) / 2.0;
  float rightAvg = (latestEnv[2] + latestEnv[3]) / 2.0;
  float ratio = (rightAvg > 0.001f) ? (leftAvg / rightAvg) * 100.0f : 0.0f;

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("L vs R Compare");
  display.setCursor(0, 16);
  display.print("L Avg: ");
  display.print((int)leftAvg);
  display.setCursor(0, 30);
  display.print("R Avg: ");
  display.print((int)rightAvg);
  display.setCursor(0, 46);
  display.print("L/R: ");
  display.print((int)ratio);
  display.print("%");
  display.display();
}

void drawStatusPage() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("System Status");
  display.setCursor(0, 18);
  display.print("USB: ON");
  display.setCursor(0, 30);
  display.print("WiFi: ");
  display.print(WiFi.status() == WL_CONNECTED ? "ON" : "OFF");
  display.setCursor(0, 42);
  display.print("Rate: ");
  display.print(SAMPLE_RATE);
  display.print(" Hz");
  display.setCursor(0, 54);
  display.print("UDP: Broadcast");
  display.display();
}

void updateOLED() {
  static unsigned long lastDisplayUpdate = 0;
  if (millis() - lastDisplayUpdate < 250) { // Limit OLED updates to 4 FPS to prevent blocking the sample loop
    return;
  }
  lastDisplayUpdate = millis();

  if (millis() - lastOledSwitch > OLED_PAGE_INTERVAL) {
    lastOledSwitch = millis();
    oledPage = (oledPage + 1) % 5;
  }

  switch (oledPage) {
    case 0: drawBrandPage(); break;
    case 1: drawLeftPage(); break;
    case 2: drawRightPage(); break;
    case 3: drawComparePage(); break;
    case 4: drawStatusPage(); break;
  }
}

void setup() {
  Serial.begin(BAUD_RATE);
  delay(1200);
  analogReadResolution(14);

  for (int i = 0; i < 4; i++) {
    pinMode(CH_PINS[i], INPUT);
    filterState[i].s1.z1 = filterState[i].s1.z2 = 0.0f;
    filterState[i].s2.z1 = filterState[i].s2.z2 = 0.0f;
    filterState[i].s3.z1 = filterState[i].s3.z2 = 0.0f;
    filterState[i].s4.z1 = filterState[i].s4.z2 = 0.0f;
  }

  Wire.begin();
  initOLED();
  Wire.setClock(400000); // Set I2C clock to 400kHz after OLED init to ensure it is not overridden
  connectWiFi();
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    broadcastIP = getBroadcastIP(WiFi.localIP(), WiFi.subnetMask());
  }

  Serial.println("# Settling EMG filters before streaming...");
  settleAnalogFilters();
  Serial.println("# EMG stream started");
}

void loop() {
  static unsigned long past = 0;
  unsigned long present = micros();
  unsigned long interval = present - past;
  past = present;

  static long timer = 0;
  timer -= interval;

  // Throttled WiFi status check (every 1000ms) to avoid blocking SPI bus
  if (millis() - last_wifi_check >= 1000) {
    last_wifi_check = millis();
    bool current_status = (WiFi.status() == WL_CONNECTED);
    if (current_status != wifi_connected) {
      wifi_connected = current_status;
      if (wifi_connected) {
        broadcastIP = getBroadcastIP(WiFi.localIP(), WiFi.subnetMask());
      }
    }
  }

  // Loop frequency tracking for diagnostics
  static int sample_count = 0;
  static unsigned long last_hz_time = 0;

  if (timer < 0) {
    timer += 1000000 / SAMPLE_RATE;
    sample_count++;

    for (int i = 0; i < 4; i++) {
      int sensor_value = analogRead(CH_PINS[i]);
      latestSig[i] = EMGFilterChannel((float)sensor_value, filterState[i]);
      latestEnv[i] = getEnvelopeChannel(i, abs((int)latestSig[i]));
    }

    // Build line using sprintf into static buffer — ZERO heap allocation
    static char line[128];
    int line_len = snprintf(line, sizeof(line),
      "%lu,%.2f,%d,%.2f,%d,%.2f,%d,%.2f,%d",
      millis(),
      latestSig[0], latestEnv[0],
      latestSig[1], latestEnv[1],
      latestSig[2], latestEnv[2],
      latestSig[3], latestEnv[3]
    );

    // Send to USB Serial — direct write (non-blocking if buffer has space)
    Serial.write((uint8_t*)line, line_len);
    Serial.write('\n');

    // Accumulate in UDP char buffer
    if (wifi_connected) {
      if (udp_buf_len > 0 && udp_buf_len + line_len + 2 < UDP_PACKET_MAX) {
        udp_buf[udp_buf_len++] = '\n';
      }
      if (udp_buf_len + line_len < UDP_PACKET_MAX) {
        memcpy(udp_buf + udp_buf_len, line, line_len);
        udp_buf_len += line_len;
      }
      udp_sample_counter++;

      if (udp_sample_counter >= UDP_BUFFER_COUNT) {
        udp.beginPacket(broadcastIP, receiverPort);
        udp.write((uint8_t*)udp_buf, udp_buf_len);
        udp.endPacket();
        udp_buf_len = 0;
        udp_sample_counter = 0;
      }
    }
  }

  // Print diagnostics to Serial Monitor every second
  if (millis() - last_hz_time >= 1000) {
    Serial.print("# Hz:");
    Serial.print(sample_count);
    Serial.print(" WiFi:");
    Serial.println(wifi_connected ? "OK" : "NO");
    sample_count = 0;
    last_hz_time = millis();
  }

  updateOLED();
}
