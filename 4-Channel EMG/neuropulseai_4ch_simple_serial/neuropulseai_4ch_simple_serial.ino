/*
  NeuroPulseAI 4-Channel EMG Sender (Simple USB Serial Version)
  Compatible with NeuroPulseAI 4-Channel Plotter GUI
  
  Baud Rate: 460800 (Set same baud in GUI for maximum performance)
  Sample Rate: 500 Hz (Every 2ms)
  
  Pins:
    Channel 1: A0
    Channel 2: A1
    Channel 3: A2
    Channel 4: A3
*/

#define SAMPLE_RATE 500
#define BAUD_RATE 460800
#define BUFFER_SIZE 128

const int INPUT_PINS[4] = {A0, A1, A2, A3};

int circular_buffer[4][BUFFER_SIZE];
int data_index[4] = {0, 0, 0, 0};
long sum[4] = {0, 0, 0, 0};

struct BiquadState {
  float z1;
  float z2;
};

struct EMGFilterState {
  BiquadState stage1;
  BiquadState stage2;
  BiquadState stage3;
  BiquadState stage4;
};

EMGFilterState filter_states[4];

void setup() {
  Serial.begin(BAUD_RATE);
  
  // Initialize filter states and buffers for all 4 channels
  for (int i = 0; i < 4; i++) {
    pinMode(INPUT_PINS[i], INPUT);
    filter_states[i].stage1.z1 = filter_states[i].stage1.z2 = 0.0f;
    filter_states[i].stage2.z1 = filter_states[i].stage2.z2 = 0.0f;
    filter_states[i].stage3.z1 = filter_states[i].stage3.z2 = 0.0f;
    filter_states[i].stage4.z1 = filter_states[i].stage4.z2 = 0.0f;
    
    sum[i] = 0;
    data_index[i] = 0;
    for (int j = 0; j < BUFFER_SIZE; j++) {
      circular_buffer[i][j] = 0;
    }
  }
}

void loop() {
  static unsigned long past = 0;
  unsigned long present = micros();
  unsigned long interval = present - past;
  past = present;

  static long timer = 0;
  timer -= interval;

  if (timer < 0) {
    timer += 1000000 / SAMPLE_RATE;

    unsigned long time_ms = millis();
    
    float centered[4];
    int envelope[4];

    for (int i = 0; i < 4; i++) {
      int raw = analogRead(INPUT_PINS[i]);
      centered[i] = EMGFilter(raw, filter_states[i]);
      envelope[i] = getEnvelope(i, abs((int)centered[i]));
    }

    // Output matches the 4-Channel GUI CSV format:
    // time_ms,sig1,env1,sig2,env2,sig3,env3,sig4,env4
    Serial.print(time_ms);
    for (int i = 0; i < 4; i++) {
      Serial.print(",");
      Serial.print(centered[i], 2);
      Serial.print(",");
      Serial.print(envelope[i]);
    }
    Serial.println();
  }
}

int getEnvelope(int ch, int abs_emg) {
  sum[ch] -= circular_buffer[ch][data_index[ch]];
  sum[ch] += abs_emg;
  circular_buffer[ch][data_index[ch]] = abs_emg;
  data_index[ch] = (data_index[ch] + 1) % BUFFER_SIZE;

  return (sum[ch] / BUFFER_SIZE) * 2;
}

float EMGFilter(float input, EMGFilterState &state) {
  float output = input;

  // Stage 1
  {
    float x = output - 0.05159732f * state.stage1.z1 - 0.36347401f * state.stage1.z2;
    output = 0.01856301f * x + 0.03712602f * state.stage1.z1 + 0.01856301f * state.stage1.z2;
    state.stage1.z2 = state.stage1.z1;
    state.stage1.z1 = x;
  }

  // Stage 2
  {
    float x = output - -0.53945795f * state.stage2.z1 - 0.39764934f * state.stage2.z2;
    output = 1.00000000f * x + -2.00000000f * state.stage2.z1 + 1.00000000f * state.stage2.z2;
    state.stage2.z2 = state.stage2.z1;
    state.stage2.z1 = x;
  }

  // Stage 3
  {
    float x = output - 0.47319594f * state.stage3.z1 - 0.70744137f * state.stage3.z2;
    output = 1.00000000f * x + 2.00000000f * state.stage3.z1 + 1.00000000f * state.stage3.z2;
    state.stage3.z2 = state.stage3.z1;
    state.stage3.z1 = x;
  }

  // Stage 4
  {
    float x = output - -1.00211112f * state.stage4.z1 - 0.74520226f * state.stage4.z2;
    output = 1.00000000f * x + -2.00000000f * state.stage4.z1 + 1.00000000f * state.stage4.z2;
    state.stage4.z2 = state.stage4.z1;
    state.stage4.z1 = x;
  }

  return output;
}
