/**
 * Medicine Dispenser ESP32 - Stepper Motor + Touch Sensor Version
 * Hardware: 2x Stepper 28BYJ-48 (ULN2003), 2x IR, 1x TTP224
 * FSM: IDLE → DISPENSE → WAIT_SENSOR → SUCCESS/ERROR → IDLE
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ==================== CẤU HÌNH ====================
#define WIFI_SSID     "Rẹt"
#define WIFI_PASSWORD "05012005"
#define MQTT_SERVER   "172.20.10.2"
#define MQTT_PORT    1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD  ""

#define COMMAND_TOPIC "medicine/command"
#define STATUS_TOPIC  "medicine/status"

// ----- Stepper Motor 1 (Ngăn A) -----
#define IN1_A  26
#define IN2_A  27
#define IN3_A  14
#define IN4_A  12

// ----- Stepper Motor 2 (Ngăn B) -----
#define IN1_B  16
#define IN2_B  17
#define IN3_B  5
#define IN4_B  18

// ----- IR Sensors -----
#define IR1_PIN   34
#define IR2_PIN   35

// ----- Touch Sensor TTP224 -----
#define TOUCH_PIN  36
#define TOUCH_A1 1   // Nút 1: Nhả ngăn A
#define TOUCH_A2 2   // Nút 2: Nhả ngăn B
#define TOUCH_RST 3  // Nút 3: Reset hệ thống (tùy chọn)

// ----- Thông số -----
#define IR_THRESHOLD    2000
#define STEPS_PER_REV   2048  // 28BYJ-48 full revolution
#define DISPENSE_STEPS  512  // Xoay 1/4 vòng = 8 khoang
#define MOTOR_SPEED     5    // Delay per step (ms) - nhỏ = nhanh
#define DISPENSE_TIMEOUT 3000 // Timeout chờ IR (ms)

// ==================== STATE MACHINE ====================
enum State {
    STATE_IDLE,
    STATE_DISPENSE,
    STATE_WAIT_SENSOR,
    STATE_SUCCESS,
    STATE_ERROR
};

const char* stateNames[] = {
    "IDLE",
    "DISPENSE",
    "WAIT_SENSOR",
    "SUCCESS",
    "ERROR"
};

// ==================== BIẾN ====================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// FSM state
State currentState = STATE_IDLE;
State previousState = STATE_IDLE;

// Command data
int currentSlot = 0;
unsigned long stateStartTime = 0;
bool irTriggered = false;

// IR values
int ir1Value = 4095;
int ir2Value = 4095;

// Touch values
bool touchPressed[4] = {false, false, false, false};
int touchButtons[4] = {0};

// ==================== SETUP ====================
void setup() {
    Serial.begin(9600);
    Serial.println("\n===== Medicine Dispenser - Stepper v1.0 =====");

    // Init Stepper pins
    initStepperPins();

    // Init IR pins
    pinMode(IR1_PIN, INPUT);
    pinMode(IR2_PIN, INPUT);

    // Init Touch pins
    pinMode(TOUCH_PIN, INPUT);

    // WiFi
    connectWiFi();

    // MQTT
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);

    Serial.println("===== Setup Complete =====\n");
}

void initStepperPins() {
    // Stepper A
    pinMode(IN1_A, OUTPUT);
    pinMode(IN2_A, OUTPUT);
    pinMode(IN3_A, OUTPUT);
    pinMode(IN4_A, OUTPUT);

    // Stepper B
    pinMode(IN1_B, OUTPUT);
    pinMode(IN2_B, OUTPUT);
    pinMode(IN3_B, OUTPUT);
    pinMode(IN4_B, OUTPUT);

    // Set all LOW initially
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW);
    digitalWrite(IN4_A, LOW);
    digitalWrite(IN1_B, LOW);
    digitalWrite(IN2_B, LOW);
    digitalWrite(IN3_B, LOW);
    digitalWrite(IN4_B, LOW);
}

// ==================== LOOP ====================
void loop() {
    // Đọc cảm biến
    readIRSensors();
    readTouchSensor();

    // Kiểm tra MQTT
    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();

    // FSM
    switch (currentState) {
        case STATE_IDLE:
            fsmIdle();
            break;
        case STATE_DISPENSE:
            fsmDispense();
            break;
        case STATE_WAIT_SENSOR:
            fsmWaitSensor();
            break;
        case STATE_SUCCESS:
            fsmSuccess();
            break;
        case STATE_ERROR:
            fsmError();
            break;
    }

    delay(10);
}

// ==================== FSM FUNCTIONS ====================

void fsmIdle() {
    // Kiểm tra nút chạm
    if (touchPressed[TOUCH_A1 - 1]) {
        currentSlot = 1;
        touchPressed[TOUCH_A1 - 1] = false;
        transitionTo(STATE_DISPENSE);
    } else if (touchPressed[TOUCH_A2 - 1]) {
        currentSlot = 2;
        touchPressed[TOUCH_A2 - 1] = false;
        transitionTo(STATE_DISPENSE);
    } else if (touchPressed[TOUCH_RST - 1]) {
        // Reset system
        touchPressed[TOUCH_RST - 1] = false;
        publishStatus("system_reset");
    }
    // MQTT command handled in callback
}

void fsmDispense() {
    Serial.println("========================================");
    Serial.print("=> DISPENSE SLOT: ");
    Serial.println(currentSlot);
    Serial.println("========================================");

    // Xoay stepper tương ứng
    if (currentSlot == 1) {
        rotateStepperA(DISPENSE_STEPS);
        Serial.println("=> STEPPER A DISPENSED");
    } else if (currentSlot == 2) {
        rotateStepperB(DISPENSE_STEPS);
        Serial.println("=> STEPPER B DISPENSED");
    }

    Serial.println("=== Stepper done, waiting sensor ===");

    // Chuyển sang chờ sensor
    stateStartTime = millis();
    irTriggered = false;
    transitionTo(STATE_WAIT_SENSOR);
}

void fsmWaitSensor() {
    unsigned long elapsed = millis() - stateStartTime;

    // Kiểm tra IR theo slot
    bool detected = false;
    if (currentSlot == 1) {
        detected = (ir1Value < IR_THRESHOLD);
    } else if (currentSlot == 2) {
        detected = (ir2Value < IR_THRESHOLD);
    }

    Serial.print("IR1: ");
    Serial.print(ir1Value);
    Serial.print(" IR2: ");
    Serial.print(ir2Value);
    Serial.print(" Detected: ");
    Serial.println(detected ? "YES" : "NO");

    // Kết quả
    if (detected) {
        irTriggered = true;
        transitionTo(STATE_SUCCESS);
    } else if (elapsed > DISPENSE_TIMEOUT) {
        irTriggered = false;
        transitionTo(STATE_ERROR);
    }
}

void fsmSuccess() {
    Serial.println("========================================");
    Serial.print("=> SUCCESS - Slot ");
    Serial.println(currentSlot);
    Serial.print("=> IR Triggered: ");
   Serial.println(irTriggered ? "YES" : "NO");
    Serial.println("========================================");

    publishStatus("success");
    irTriggered = false;
    currentSlot = 0;
    transitionTo(STATE_IDLE);
}

void fsmError() {
    Serial.println("========================================");
    Serial.print("=> ERROR - Slot ");
    Serial.println(currentSlot);
    Serial.println("=> NO PILL DETECTED");
    Serial.println("========================================");

    publishStatus("no_pill_detected");
    irTriggered = false;
    currentSlot = 0;
    transitionTo(STATE_IDLE);
}

void transitionTo(State newState) {
    if (newState != currentState) {
        Serial.print("State: ");
        Serial.print(stateNames[currentState]);
        Serial.print(" -> ");
        Serial.println(stateNames[newState]);

        previousState = currentState;
        currentState = newState;
        stateStartTime = millis();
    }
}

// ==================== STEPPER MOTOR ====================

void rotateStepperA(int steps) {
    // 28BYJ-48 sequence (4-step)
    for (int i = 0; i < steps; i++) {
        for (int step = 0; step < 4; step++) {
            setStepperA(step);
            delay(MOTOR_SPEED);
        }
    }
    // Turn off
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW);
    digitalWrite(IN4_A, LOW);
}

void rotateStepperB(int steps) {
    for (int i = 0; i < steps; i++) {
        for (int step = 0; step < 4; step++) {
            setStepperB(step);
            delay(MOTOR_SPEED);
        }
    }
    digitalWrite(IN1_B, LOW);
    digitalWrite(IN2_B, LOW);
    digitalWrite(IN3_B, LOW);
    digitalWrite(IN4_B, LOW);
}

void setStepperA(int step) {
    // 4-phase sequence for 28BYJ-48
    switch (step % 4) {
        case 0:
            digitalWrite(IN1_A, HIGH); digitalWrite(IN2_A, HIGH); digitalWrite(IN3_A, LOW); digitalWrite(IN4_A, LOW);
            break;
        case 1:
            digitalWrite(IN1_A, LOW); digitalWrite(IN2_A, HIGH); digitalWrite(IN3_A, HIGH); digitalWrite(IN4_A, LOW);
            break;
        case 2:
            digitalWrite(IN1_A, LOW); digitalWrite(IN2_A, LOW); digitalWrite(IN3_A, HIGH); digitalWrite(IN4_A, HIGH);
            break;
        case 3:
            digitalWrite(IN1_A, HIGH); digitalWrite(IN2_A, LOW); digitalWrite(IN3_A, LOW); digitalWrite(IN4_A, HIGH);
            break;
    }
}

void setStepperB(int step) {
    switch (step % 4) {
        case 0:
            digitalWrite(IN1_B, HIGH); digitalWrite(IN2_B, HIGH); digitalWrite(IN3_B, LOW); digitalWrite(IN4_B, LOW);
            break;
        case 1:
            digitalWrite(IN1_B, LOW); digitalWrite(IN2_B, HIGH); digitalWrite(IN3_B, HIGH); digitalWrite(IN4_B, LOW);
            break;
        case 2:
            digitalWrite(IN1_B, LOW); digitalWrite(IN2_B, LOW); digitalWrite(IN3_B, HIGH); digitalWrite(IN4_B, HIGH);
            break;
        case 3:
            digitalWrite(IN1_B, HIGH); digitalWrite(IN2_B, LOW); digitalWrite(IN3_B, LOW); digitalWrite(IN4_B, HIGH);
            break;
    }
}

// ==================== IR SENSOR ====================

void readIRSensors() {
    ir1Value = analogRead(IR1_PIN);
    ir2Value = analogRead(IR2_PIN);
}

// ==================== TOUCH SENSOR ====================

void readTouchSensor() {
    // TTP224 output: digital (HIGH = pressed)
    // 4 buttons, each produces different voltage level
    int raw = analogRead(TOUCH_PIN);

    // Determine which button pressed (approximate ADC values)
    // No press: ~0-100
    // Button 1: ~500-1000
    // Button 2: ~1000-1500
    // Button 3: ~1500-2000
    // Button 4: ~2000-2500 (or higher)

    for (int i = 0; i < 4; i++) {
        if (raw > 400 * (i + 1)) {
            if (!touchPressed[i]) {
                touchPressed[i] = true;
                Serial.print("Touch Button ");
                Serial.print(i + 1);
                Serial.println(" PRESSED");
            }
        } else {
            touchPressed[i] = false;
        }
    }
}

// ==================== MQTT ====================

void reconnectMQTT() {
    static unsigned long lastAttempt = 0;
    if (millis() - lastAttempt < 2000) return;
    lastAttempt = millis();

    Serial.print("MQTT connecting to ");
    Serial.print(MQTT_SERVER);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    String clientId = "ESP32_med_" + String(random(0xffff), HEX);
    if (mqttClient.connect(clientId.c_str())) {
        Serial.println("MQTT Connected!");
        mqttClient.subscribe(COMMAND_TOPIC);
    } else {
        Serial.print("MQTT failed, code: ");
        Serial.println(mqttClient.state());
    }
}

void mqttCallback(char* topic, byte* payload, unsigned int len) {
    String msg;
    for (int i = 0; i < len; i++) msg += (char)payload[i];

    Serial.print("MQTT [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(msg);

    if (String(topic) == COMMAND_TOPIC) {
        parseCommand(msg);
    }
}

void parseCommand(String msg) {
    int slotStart = msg.indexOf("\"slot\":");
    if (slotStart == -1) {
        slotStart = msg.indexOf("slot:");
    }

    if (slotStart != -1 && currentState == STATE_IDLE) {
        int numStart = msg.indexOf(":", slotStart) + 1;
        while (msg[numStart] == ' ' || msg[numStart] == '"') numStart++;

        int slot = msg[numStart] - '0';
        if (slot == 1 || slot == 2) {
            currentSlot = slot;
            Serial.print("MQTT Command: Slot ");
            Serial.println(currentSlot);
        }
    }
}

void publishStatus(const char* status) {
    String payload = "{";
    payload += "\"slot\":" + String(currentSlot) + ",";
    payload += "\"status\":\"" + String(status) + "\",";
    payload += "\"ir_triggered\":" + String(irTriggered ? "true" : "false");
    payload += "}";

    mqttClient.publish(STATUS_TOPIC, payload.c_str());
    Serial.print("Published: ");
    Serial.println(payload);
}

// ==================== WiFi ====================

void connectWiFi() {
    Serial.print("Connecting WiFi: ");
    Serial.println(WIFI_SSID);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;

    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi OK!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi FAILED!");
    }
}