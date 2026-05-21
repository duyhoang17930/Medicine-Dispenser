# ESP32 State Machine - Medicine Dispenser FSM

## Source Code
`backend/esp32/medicine_dispenser_fsm/medicine_dispenser_fsm.ino`

---

## FSM States

```
┌─────────────────────────────────────────────────────────────────┐
│                        STATE DIAGRAM                            │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────┐
                        │  IDLE   │◄─────────────────────────┐
                        │ (0x00)  │                        │
                        └─────────┘                        │
                            │                              │
                            │ Command received            │
                            │ (MQTT/Touch)               │
                            ▼                          │
┌──────────────┐        ┌──────────────┐         ┌─────────────┐
│   DISPENSE   │───────►│  WAIT_SENSOR │         │   ERROR    │
│   (0x01)    │        │    (0x02)    │         │   (0x04)   │
│ (activate )  │        │(detect pill)  │         │(no pill)   │
└──────────────┘        └──────────────┘         └─────────────┘
                            │                 ▲              │
                            │                 │              │
                            ▼                 │              │
                      ┌─────────────┐         │              │
                      │  SUCCESS   │─────────┘              │
                      │   (0x03)   │──────────────────────┘
                      │ (complete) │
                      └─────────────┘
```

---

## State Definitions

| State | Enum Value | Description |
|-------|----------|-------------|
| `IDLE` | `0x00` | Waiting for command (MQTT or Touch) |
| `DISPENSE` | `0x01` | Activating stepper motor |
| `WAIT_SENSOR` | `0x02` | Waiting for IR sensor detection |
| `SUCCESS` | `0x03` | Pill dispensed successfully |
| `ERROR` | `0x04` | Timeout or no pill detected |

---

## State Transitions

### Idle State

| Event | Action | Next State |
|-------|--------|----------|
| MQTT command received | Parse slot, validate (1 or 2) | `DISPENSE` |
| Touch sensor pressed | Add slot to queue | `DISPENSE` |

### Dispense State

| Event | Action | Next State |
|-------|--------|----------|
| Stepper motor started | Launch FreeRTOS tasks | `WAIT_SENSOR` |
| (Auto-transition) | After launch | `WAIT_SENSOR` |

### Wait Sensor State

| Condition | Action | Next State |
|-----------|--------|----------|
| IR detected AND motor finished | Publish "success" | `SUCCESS` |
| Timeout (>5000ms) | Publish "no_pill_detected" | `ERROR` |

### Success State

| Event | Action | Next State |
|-------|--------|----------|
| (Enter) | Log success, reset variables | `IDLE` |

### Error State

| Event | Action | Next State |
|-------|--------|----------|
| (Enter) | Log error, reset variables | `IDLE` |

---

## Concurrent Processing (FreeRTOS)

The FSM handles multiple slots concurrently using FreeRTOS tasks:

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONCURRENT ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────┘

                      ┌─────────────────┐
                      │   IDLE State    │
                      │  (main loop)    │
                      └────────┬────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │  Slot 1 Task   │ │  Slot 2 Task   │ │  Slot N Task   │
     │  (FreeRTOS)   │ │  (FreeRTOS)    │ │  (FreeRTOS)   │
     ├───────────────┤ ├───────────────┤ ├───────────────┤
     │ IR Monitor   │ │ IR Monitor    │ │ IR Monitor    │
     │ Stepper     │ │ Stepper      │ │ Stepper      │
     └────────────┘ └──────────────┘ └──────────────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  MQTT Publish   │
                      │ medicine/status │
                      └─────────────────┘
```

### FreeRTOS Tasks

| Task Name | Core | Stack Size | Priority | Function |
|----------|------|-----------|----------|----------|----------|
| `IRMonitorTask` | Core 0 | 2048 | 1 | Monitor IR sensor |
| `StepperTask` | Core 1 | 4096 | 1 | Drive stepper motor |

---

## Hardware Interactions

### Inputs

| Input | Pin | Type | Purpose |
|-------|-----|------|---------|
| IR1 | GPIO 35 | Digital IN | Slot 1 presence detection |
| IR2 | GPIO 34 | Digital IN | Slot 2 presence detection |
| TOUCH_A1 | GPIO 32 | Digital IN | TTP224 OUT2 → Slot 1 |
| TOUCH_A2 | GPIO 33 | Digital IN | TTP224 OUT3 → Slot 2 |

### Outputs

| Output | Pin | Type | Purpose |
|-------|-----|------|---------|
| IN1_A ~ IN4_A | GPIO 26,27,14,13 | Digital OUT | Stepper 1 (ULN2003) |
| IN1_B ~ IN4_B | GPIO 16,17,18,19 | Digital OUT | Stepper 2 (ULN2003) |

---

## MQTT Integration

### Subscribe

| Topic | Payload | Action |
|-------|---------|--------|
| `medicine/command` | `{"slot": 1, "timestamp": "..."}` | Queue dispense |

### Publish

| Topic | Payload | Meaning |
|-------|---------|---------|
| `medicine/status` | `{"slot": 1, "status": "success"}` | Dispense OK |
| `medicine/status` | `{"slot": 1, "status": "no_pill_detected"}` | IR timeout |

---

## Anti-Duplicate Mechanism

```
lastCommandTs[slot] = timestamp from command

if (currentTimestamp == lastCommandTs[slot] within 3 seconds) {
    IGNORE duplicate command
}
```

---

## Queue Processing (Touch Sensor)

```
touchQueue[] = Circular buffer (size 4)

fsmIdle():
    while (queue not empty):
        pop slot
        if (slot not busy):
            launchDispense(slot)
        else:
            push back to queue
```

---

## Configuration Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DISPENSE_STEPS` | 128 | Steps per dispense (1/4 rev) |
| `MOTOR_SPEED` | 3 | ms delay per step |
| `DISPENSE_TIMEOUT` | 5000 | ms timeout for IR |
| `IR_THRESHOLD` | 2800 | Analog threshold (unused) |

---

*Document Generated: 2026-05-21*
*Source: `medicine_dispenser_fsm.ino`*