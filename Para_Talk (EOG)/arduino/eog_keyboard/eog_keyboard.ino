/*
  Para Talk EOG Keyboard Controller

  Upload this sketch to Arduino 1: the EOG board.
  A detected blink sends a USB HID Space key press to the laptop.

  Designed for:
  - Arduino UNO R4 Minima
  - Arduino UNO R4 WiFi

  The Para Talk web app listens for Space key presses, so this board does not
  need Web Serial connection in the browser. It behaves like a keyboard.
*/

#include <Arduino.h>
#include <Keyboard.h>
#include <math.h>

// #define DEBUG

#define SAMPLE_RATE 512
#define BAUD_RATE 115200
#define INPUT_PIN A0
#define LED_PIN LED_BUILTIN

#define ENVELOPE_WINDOW_MS 100
#define ENVELOPE_WINDOW_SIZE ((ENVELOPE_WINDOW_MS * SAMPLE_RATE) / 1000)

// Adjust these two values for the patient and electrode setup.
const int BlinkLowerThreshold = 30;
const int BlinkUpperThreshold = 50;

#define BUFFER_SIZE 64
float eogCircBuffer[BUFFER_SIZE];
int writeIndex = 0;
int readIndex = 0;
int samplesAvailable = 0;

const unsigned long BLINK_DEBOUNCE_MS = 300;
unsigned long lastBlinkTime = 0;
float currentEOGEnvelope = 0;

const unsigned long HID_COOLDOWN_MS = 250;
unsigned long lastHIDCommandTime = 0;

float eogEnvelopeBuffer[ENVELOPE_WINDOW_SIZE] = {0};
int eogEnvelopeIndex = 0;
float eogEnvelopeSum = 0;

unsigned long totalBlinks = 0;
unsigned long startTime = 0;

#define SEGMENT_SEC 1
#define SAMPLES_PER_SEGMENT (SAMPLE_RATE * SEGMENT_SEC)
float eogBuffer[SAMPLES_PER_SEGMENT] = {0};
uint16_t segmentIndex = 0;
unsigned long lastSegmentTimeMs = 0;
float eogAvg = 0;
float eogMin = 0;
float eogMax = 0;
bool segmentStatsReady = false;

float Notch(float input) {
  float output = input;

  {
    static float z1, z2;
    float x = output - -1.58696045 * z1 - 0.96505858 * z2;
    output = 0.96588529 * x + -1.57986211 * z1 + 0.96588529 * z2;
    z2 = z1;
    z1 = x;
  }

  {
    static float z1, z2;
    float x = output - -1.62761184 * z1 - 0.96671306 * z2;
    output = 1.00000000 * x + -1.63566226 * z1 + 1.00000000 * z2;
    z2 = z1;
    z1 = x;
  }

  return output;
}

float EOGFilter(float input) {
  float output = input;

  {
    static float z1, z2;
    float x = output - -1.91327599 * z1 - 0.91688335 * z2;
    output = 0.95753983 * x + -1.91507967 * z1 + 0.95753983 * z2;
    z2 = z1;
    z1 = x;
  }

  return output;
}

float updateEOGEnvelope(float sample) {
  float absSample = fabs(sample);

  eogEnvelopeSum -= eogEnvelopeBuffer[eogEnvelopeIndex];
  eogEnvelopeSum += absSample;
  eogEnvelopeBuffer[eogEnvelopeIndex] = absSample;
  eogEnvelopeIndex = (eogEnvelopeIndex + 1) % ENVELOPE_WINDOW_SIZE;

  return eogEnvelopeSum / ENVELOPE_WINDOW_SIZE;
}

void sendSpaceBar() {
  unsigned long nowMs = millis();

  if ((nowMs - lastHIDCommandTime) >= HID_COOLDOWN_MS) {
    Keyboard.press(' ');
    delay(30);
    Keyboard.release(' ');

    lastHIDCommandTime = nowMs;
    totalBlinks++;

    Serial.print("SPACE blink #");
    Serial.println(totalBlinks);

    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
}

void setup() {
  Serial.begin(BAUD_RATE);
  delay(100);

  pinMode(INPUT_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  Keyboard.begin();

  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }

  startTime = millis();
  lastSegmentTimeMs = millis();

  Serial.println("=================================");
  Serial.println("Para Talk EOG Keyboard Controller");
  Serial.println("=================================");
  Serial.println("Single blink = Space key");
  Serial.println("Open the Para Talk app and focus the browser window.");
  Serial.println("Starting EOG monitoring at 512 Hz...");
}

void loop() {
  static unsigned long lastMicros = 0;
  static long timer = 0;

  digitalWrite(LED_PIN, LOW);

  unsigned long currentMicros = micros();
  long interval = (long)(currentMicros - lastMicros);
  lastMicros = currentMicros;

  timer -= interval;
  const long period = 1000000L / SAMPLE_RATE;

  while (timer < 0) {
    timer += period;

    int raw = analogRead(INPUT_PIN);
    float filtered = Notch(raw);
    float eog = EOGFilter(filtered);

    eogCircBuffer[writeIndex] = eog;
    writeIndex = (writeIndex + 1) % BUFFER_SIZE;

    if (samplesAvailable < BUFFER_SIZE) {
      samplesAvailable++;
    }
  }

  while (samplesAvailable > 0) {
    float eog = eogCircBuffer[readIndex];
    readIndex = (readIndex + 1) % BUFFER_SIZE;
    samplesAvailable--;

    currentEOGEnvelope = updateEOGEnvelope(eog);

    if (segmentIndex < SAMPLES_PER_SEGMENT) {
      eogBuffer[segmentIndex] = currentEOGEnvelope;
      segmentIndex++;
    }
  }

  unsigned long nowMs = millis();

  if ((nowMs - lastSegmentTimeMs) >= (1000UL * SEGMENT_SEC)) {
    if (segmentIndex > 0) {
      eogMin = eogBuffer[0];
      eogMax = eogBuffer[0];
      float eogSum = 0;

      for (uint16_t i = 0; i < segmentIndex; i++) {
        float eogVal = eogBuffer[i];
        if (eogVal < eogMin) eogMin = eogVal;
        if (eogVal > eogMax) eogMax = eogVal;
        eogSum += eogVal;
      }

      eogAvg = eogSum / segmentIndex;
      segmentStatsReady = true;
    }

    lastSegmentTimeMs = nowMs;
    segmentIndex = 0;
  }

  if (
    currentEOGEnvelope > BlinkLowerThreshold &&
    currentEOGEnvelope < BlinkUpperThreshold &&
    (nowMs - lastBlinkTime) >= BLINK_DEBOUNCE_MS
  ) {
    lastBlinkTime = nowMs;

    #ifdef DEBUG
      Serial.println("Blink detected");
    #endif

    sendSpaceBar();
  }

  static unsigned long lastStatusUpdate = 0;

  if ((nowMs - lastStatusUpdate) >= 30000) {
    unsigned long runTimeSeconds = (nowMs - startTime) / 1000;
    float blinksPerMinute = (totalBlinks * 60.0) / (runTimeSeconds + 1);

    Serial.println("");
    Serial.println("=== EOG Stats ===");
    Serial.print("Run Time: ");
    Serial.print(runTimeSeconds);
    Serial.println(" seconds");
    Serial.print("Total Space Presses: ");
    Serial.println(totalBlinks);
    Serial.print("Blink Rate: ");
    Serial.print(blinksPerMinute, 1);
    Serial.println(" per minute");
    Serial.print("Current EOG Level: ");
    Serial.println(currentEOGEnvelope);
    Serial.println("=================");
    Serial.println("");

    lastStatusUpdate = nowMs;
  }

  #ifdef DEBUG
    static unsigned long lastDebugPrint = 0;

    if ((nowMs - lastDebugPrint) >= 1000) {
      if (segmentStatsReady) {
        Serial.print("EOG: Avg ");
        Serial.print(eogAvg);
        Serial.print(", Min ");
        Serial.print(eogMin);
        Serial.print(", Max ");
        Serial.println(eogMax);
      } else {
        Serial.print("EOG: ");
        Serial.println(currentEOGEnvelope);
      }

      lastDebugPrint = nowMs;
    }
  #endif
}
