/**
 * Medicine Dispenser ESP32 - Stepper Motor + Touch Sensor Version
 * Hardware: 2x Stepper 28BYJ-48 (ULN2003), 2x IR, 1x TTP224
 * FSM: IDLE → DISPENSE → WAIT_SENSOR → SUCCESS/ERROR → IDLE
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// ==================== CẤU HÌNH ====================
#define WIFI_SSID     "Rẹt"
#define WIFI_PASSWORD "05012005"
#define MQTT_SERVER   "172.20.10.3"
#define MQTT_PORT    1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD  ""

#define COMMAND_TOPIC "medicine/command"
#define STATUS_TOPIC  "medicine/status"

// ----- Stepper Motor 1 (Ngăn A) -----
#define IN1_A  26
#define IN2_A  27
#define IN3_A  14
#define IN4_A  13

// ----- Stepper Motor 2 (Ngăn B) -----
#define IN1_B  16
#define IN2_B  17
#define IN3_B  18
#define IN4_B  19

// ----- IR Sensors (Digital) -----
#define IR1_PIN   35
#define IR2_PIN   34

// ----- Touch Sensor TTP224 -----
#define TOUCH_PIN  36
#define TOUCH_A1 1   // Nút 1: Nhả ngăn A
#define TOUCH_A2 2   // Nút 2: Nhả ngăn B
#define TOUCH_RST 3  // Nút 3: Reset hệ thống (tùy chọn)

// ----- Thông số -----
#define IR_THRESHOLD    2800
#define STEPS_PER_REV   2048  // 28BYJ-48 full revolution
#define DISPENSE_STEPS  128  // Xoay 1/4 vòng = 8 khoang
#define MOTOR_SPEED     3   // Delay per step (ms)
#define DISPENSE_TIMEOUT 5000 // Timeout chờ IR (ms)

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

// Forward declarations
void transitionTo(State newState);
void fsmIdle();
void fsmDispense();
void fsmWaitSensor();
void fsmSuccess();
void fsmError();

// ==================== BIẾN ====================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// FSM state
State currentState = STATE_IDLE;
State previousState = STATE_IDLE;

// Command data
int currentSlot = 0;
unsigned long stateStartTime = 0;
volatile bool irTriggered = false;

// Bien cho multitasking
volatile bool isDispensing = false;
volatile bool motorFinished = false;
TaskHandle_t irTaskHandle = NULL;
TaskHandle_t stepperTaskHandle = NULL;

// IR values
int ir1Value = 4095;
int ir2Value = 4095;

// Touch values
bool touchPressed[4] = {false, false, false, false};
int touchButtons[4] = {0};

// ISR cho IR
void IRAM_ATTR ir1ISR() {
    irTriggered = true;
}

void IRAM_ATTR ir2ISR() {
    irTriggered = true;
}

// ==================== SETUP ====================
void setup() {
    Serial.begin(9600);
    Serial.println("\n===== Medicine Dispenser - Stepper v1.0 =====");

    // Init Stepper pins
    initStepperPins();

    // Init IR pins - Digital (Poll mode, KO pullup)
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
    // Đọc cảm biến (IR da digital, khong can analog)
    // readIRSensors();
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
    // Guard - neu dang dispensing thi bo qua
    if (isDispensing) return;

    Serial.println("========================================");
    Serial.print("=> DISPENSE SLOT: ");
    Serial.println(currentSlot);
    Serial.println("========================================");

    irTriggered = false;
    motorFinished = false;
    isDispensing = true;

    // Start IR monitor task
    xTaskCreatePinnedToCore(
        irMonitorTask,
        "IRTask",
        2048,
        NULL,
        1,
        &irTaskHandle,
        0
    );

    // Start stepper task
    xTaskCreatePinnedToCore(
        stepperTask,
        "StepperTask",
        4096,
        NULL,
        1,
        &stepperTaskHandle,
        1
    );

    // Chuyen sang wait
    stateStartTime = millis();
    transitionTo(STATE_WAIT_SENSOR);
}

void irMonitorTask(void* parameter) {
    Serial.println("[IR Task] Started");
    while (isDispensing) {
        // Doc IR lien tuc
        int ir1 = digitalRead(IR1_PIN);
        int ir2 = digitalRead(IR2_PIN);

        // Kiem tra theo slot (che IR thi = 0)
        bool detected = false;
        if (currentSlot == 1) {
            detected = (ir1 == 0);
        } else if (currentSlot == 2) {
            detected = (ir2 == 0);
        }

        // Detect ngay khi co Low (1 lan)
        if (detected) {
            irTriggered = true;
            Serial.println("[IR] DETECTED!");
            break;
        }

        vTaskDelay(1);
    }

    Serial.println("[IR Task] Stopped");
    vTaskDelete(NULL);
}

// Task 2: Xu ly stepper
void stepperTask(void* parameter) {
    Serial.println("[Stepper Task] Started");

    // Luu local copy de tranh bi thay doi
    int slot = currentSlot;

    if (slot == 1) {
        // Quay nguoc 90 do
        for (int i = 0; i < DISPENSE_STEPS && !irTriggered; i++) {
            for (int step = 3; step >= 0 && !irTriggered; step--) {
                setStepperA(step);
                vTaskDelay(pdMS_TO_TICKS(MOTOR_SPEED));
            }
        }
    } else if (slot == 2) {
        for (int i = 0; i < DISPENSE_STEPS && !irTriggered; i++) {
            for (int step = 0; step < 4 && !irTriggered; step++) {
                setStepperB(step);
                vTaskDelay(pdMS_TO_TICKS(MOTOR_SPEED));
            }
        }
    }

    // Tat dong co truoc khi quay ve
    digitalWrite(IN1_A, LOW); digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW); digitalWrite(IN4_A, LOW);
    digitalWrite(IN1_B, LOW); digitalWrite(IN2_B, LOW);
    digitalWrite(IN3_B, LOW); digitalWrite(IN4_B, LOW);

    // Quay ve vi tri ban dau (ALWAYS)
    vTaskDelay(pdMS_TO_TICKS(200));
    if (slot == 1) {
        for (int i = 0; i < DISPENSE_STEPS; i++) {
            for (int step = 0; step < 4; step++) {
                setStepperA(step);
                vTaskDelay(pdMS_TO_TICKS(MOTOR_SPEED));
            }
        }
    } else if (slot == 2) {
        for (int i = 0; i < DISPENSE_STEPS; i++) {
            for (int step = 3; step >= 0; step--) {
                setStepperB(step);
                vTaskDelay(pdMS_TO_TICKS(MOTOR_SPEED));
            }
        }
    }

    // Tat het dong co
    digitalWrite(IN1_A, LOW); digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW); digitalWrite(IN4_A, LOW);
    digitalWrite(IN1_B, LOW); digitalWrite(IN2_B, LOW);
    digitalWrite(IN3_B, LOW); digitalWrite(IN4_B, LOW);

    // Danh dau da xong
    isDispensing = false;
    motorFinished = true;

    Serial.println("[Stepper Task] Done");
    vTaskDelete(NULL);
}

void fsmWaitSensor() {
    unsigned long elapsed = millis() - stateStartTime;

    // Chi bao SUCCESS khi Ca IR interrupt va Motor xong
    if (irTriggered && motorFinished) {
        isDispensing = false;
        transitionTo(STATE_SUCCESS);
    } else if (elapsed > DISPENSE_TIMEOUT) {
        isDispensing = false;
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
    // Xoay nguoc chieu 90 do
    for (int i = 0; i < steps; i++) {
        for (int step = 3; step >= 0; step--) {
            setStepperA(step);
            delay(MOTOR_SPEED);
        }
    }
    // Tat dong co
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW);
    digitalWrite(IN4_A, LOW);

    delay(200); // Cho 200ms

    // Quay ve vi tri ban dau (chieu thuan)
    for (int i = 0; i < steps; i++) {
        for (int step = 0; step < 4; step++) {
            setStepperA(step);
            delay(MOTOR_SPEED);
        }
    }
    // Tat dong co
    digitalWrite(IN1_A, LOW);
    digitalWrite(IN2_A, LOW);
    digitalWrite(IN3_A, LOW);
    digitalWrite(IN4_A, LOW);
}

void rotateStepperB(int steps) {
    // Xoay thuan 90 do
    for (int i = 0; i < steps; i++) {
        for (int step = 0; step < 4; step++) {
            setStepperB(step);
            delay(MOTOR_SPEED);
        }
    }
    // Tat dong co
    digitalWrite(IN1_B, LOW);
    digitalWrite(IN2_B, LOW);
    digitalWrite(IN3_B, LOW);
    digitalWrite(IN4_B, LOW);

    delay(200); // Cho 200ms

    // Quay ve vi tri ban dau (nguoc chieu)
    for (int i = 0; i < steps; i++) {
        for (int step = 3; step >= 0; step--) {
            setStepperB(step);
            delay(MOTOR_SPEED);
        }
    }
    // Tat dong co
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

        while (msg[numStart] == ' ' || msg[numStart] == '"') {
            numStart++;
        }

        int slot = msg[numStart] - '0';

        if (slot == 1 || slot == 2) {

            currentSlot = slot;

            Serial.print("MQTT Command: Slot ");
            Serial.println(currentSlot);

            // QUAN TRỌNG
            transitionTo(STATE_DISPENSE);
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