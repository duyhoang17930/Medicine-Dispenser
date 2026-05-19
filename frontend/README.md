# Frontend - Medicine Dispenser Dashboard

## Tổng quan

Đây là giao diện web dashboard cho he thong phat thuoc tu dong su dung ESP32. Ung dung cho phep:

- Theo doi trang thai theo thoi gian thuc (realtime)
- Dieu khien phat thuoc bang nut bam tren giao dien
- Dieu khien bang cam bien cam ung (TTP224) tren thiet bi ESP32
- Nhan dang giong noi tieng Viet (Web Speech API)
- Xem lich su phat thuoc

## Tinh nang

- Dashboard realtime hien thi trang thai he thong
- Dieu khien phat thuoc bang nut bam
- Nhan dang giong noi tieng Viet (Web Speech API)
- Hien thi lich su phat thuoc realtime
- Trang thai ESP32, MQTT, Stepper Motor, IR Sensor
- Cam bien cam ung TTP224 (4 nut)

## Cai dat

### Yeu cuu he thong

- Node.js 14+ (khuyen nghi Node.js 18+)
- npm hoac yarn
- Trinh duyet Chrome, Edge, hoac Firefox

### Buoc cai dat

```bash
# 1. Di den thu muc frontend
cd frontend

# 2. Cai dat cac goi phu thuoc
npm install
# hoac
yarn install

# 3. Chay ung dung
npm start
# hoac
yarn start
```

 Ung dung se chay tai dia chi: `http://localhost:3000`

## Cau hinh

### Bien moi truong

Tao file `.env` neu can thay doi URL backend:

```bash
# File .env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=ws://localhost:3000
```

### Cau hinh WebSocket

Ung dung su dung Socket.io de nhan du lieu realtime. Dam bao backend co ho tro Socket.io.

## Phan cung

### So do ket noi ESP32

```
+------------------+     +------------------+
|   NGAN A        |     |   NGAN B        |
|  [Thuoc]       |     |  [Thuoc]       |
|    v            |     |    v            |
| +----------+  |     | +----------+  |
| | Stepper  |--+----->| | Stepper  |  |
| | 28BYJ-48|  |     | | 28BYJ-48|  |
| | +ULN2003|  |     | | +ULN2003|  |
| +----------+  |     | +----------+  |
|    v            |     |    v            |
| +----------+  |     | +----------+  |
| |  IR SENSOR|<----->|  IR SENSOR |
| +----------+  |     | +----------+  |
+------------------+     +------------------+
        |                       |
        +--------+---------------+
                 |
           +----+----+
           | ESP32 |
           |       |
           |GPIO34|--> IR A
           |GPIO35|--> IR B
           |GPIO26|--> Stepper A IN1
           |GPIO27|--> Stepper A IN2
           |GPIO14|--> Stepper A IN3
           |GPIO12|--> Stepper A IN4
           |GPIO16|--> Stepper B IN1
           |GPIO17|--> Stepper B IN2
           |GPIO 5|--> Stepper B IN3
           |GPIO18|--> Stepper B IN4
           |GPIO36|--> TTP224 Touch
           +--------+
                 |
           +----+----+
           | MQTT |
           |Broker|
           +----+----+
                 |
           +----+----+
           |Backend|
           | API  |
           +----+----+
```

### Bang ket noi chi tiet

| Linh kien | Chan ESP32 | Ten chan | Ghi chu |
|-----------|-----------|----------|---------|
| **Stepper Motor A (Ngăn A)** | | | Qua ULN2003 |
| | GPIO 26 | IN1_A | Cuon 1 |
| | GPIO 27 | IN2_A | Cuon 2 |
| | GPIO 14 | IN3_A | Cuon 3 |
| | GPIO 12 | IN4_A | Cuon 4 |
| **Stepper Motor B (Ngăn B)** | | | Qua ULN2003 |
| | GPIO 16 | IN1_B | Cuon 1 |
| | GPIO 17 | IN2_B | Cuon 2 |
| | GPIO 5 | IN3_B | Cuon 3 |
| | GPIO 18 | IN4_B | Cuon 4 |
| **IR Sensor A** | GPIO 34 | IR1_PIN | Cam bien van chan hong ngoai |
| **IR Sensor B** | GPIO 35 | IR2_PIN | Cam bien van chan hong ngoai |
| **TTP224 Touch** | GPIO 36 | TOUCH_PIN | Cam bien cam ung 4 nut |

### Thong so ky thuat

#### ESP32
- **Model**: ESP32-WROOM-32
- **CPU**: Dual-core Xtensa LX6, 240MHz
- **RAM**: 512KB
- **Flash**: 4MB
- **Wi-Fi**: 802.11 b/g/n, 2.4GHz
- **Bluetooth**: v4.2 BR/EDR, BLE
- **Dien ap hoat dong**: 3.3V

#### Stepper Motor 28BYJ-48
- **Hãng sản xuất**: 28BYJ-48
- **Điện áp hoạt động**: 5V DC
- **Số pha**: 4
- **Tỷ số giảm tốc**: 1:64
- **Số bước/1 vòng**: 2048 bước (512 x 4)
- **Mô-men xoắn**: 0.08 Nm
- **Tốc độ**: 10-15 RPM
- **Dòng điện/pha**: 92mA

#### Module ULN2003
- **Điện áp đầu vào**: 5V-12V DC
- **Dòng ra tối đa**: 500mA mỗi kênh
- **Số kênh**: 7 kênh đầu ra
- **Tương thích**: 28BYJ-48, các động cơ bước 5V

#### IR Sensor (GP2Y0A21YK)
- **Điện áp hoạt động**: 4.5V-5.5V DC
- **Khoảng cách phát hiện**: 10-80cm
- **Điện áp đầu ra**: 0.4V-2.5V (tương ứng khoảng cách)
- **Tín hiệu đầu ra**: Analog

#### TTP224 Touch Sensor
- **Điện áp hoạt động**: 2.5V-5.5V DC
- **Số nút**: 4 nút cảm ứng điện dung
- **Độ nhạy**: Có thể điều chỉnh
- **Đầu ra**: Digital (HIGH khi chạm)
- **Khoảng cách phát hiện**: Không tiếp xúc, chạm nhẹ

## Touch Buttons (TTP224)

| Nút | Chan | Chuc nang | Mo ta |
|-----|------|-----------|-------|
| 1 | - | Nhả thuốc ngăn A | Xoay đĩa đưa 1 viên thuốc ngăn A ra cổng xả |
| 2 | - | Nhả thuốc ngăn B | Xoay đĩa đưa 1 viên thuốc ngăn B ra cổng xả |
| 3 | - | Reset hệ thống | Khởi động lại trạng thái FSM |
| 4 | - | (Reserved) | Dự phòng cho tính năng mở rộng |

## Voice Commands

Các lệnh giọng nói được hỗ trợ khi bấm nút microphone:

| Lệnh | Hành động |
|------|----------|
| "Uống thuốc" | Phát thuốc số 1 |
| "Thuốc" | Phát thuốc số 1 |
| "Thuốc 1" | Phát thuốc số 1 |
| "Cho tôi thuốc 1" | Phát thuốc số 1 |
| "Thuốc 2" | Phát thuốc số 2 |
| "Cho tôi thuốc 2" | Phát thuốc số 2 |

**Lưu ý**: Web Speech API chỉ hỗ trợ tiếng Anh mặc định trên Chrome. Để nhận dạng tiếng Việt, cần sử dụng backend xử lý hoặc API bên thứ 3 (Google Speech-to-Text, Azure Speech).

## State Machine

### Sơ đồ trạng thái

```
                    +------------------+
                    |                  |
   +--------+      |     RECEIVE      |      +----------+
   |        |      |     COMMAND     |      |          |
   |  IDLE  |------|                  |------| DISPENSE |
   |        |      |                  |      |          |
   +--------+      +------------------+      +----+-----+
        ^                                          |
        |                                          v
   +--------+      +------------------+      +----------+
   |        |      |                  |      |          |
   | SUCCESS|<-----|   WAIT_SENSOR    |------|  ERROR   |
   |        |      |                  |      |          |
   +--------+      +------------------+      +----------+
```

### Mo ta trang thai

| Trang thai | Ma | Mo ta |
|------------|-----|-------|
| IDLE | 0 | Cho lenh tu MQTT, Touch Button, hoac Voice |
| DISPENSE | 1 | Xoay stepper day thuoc ra cong xa |
| WAIT_SENSOR | 2 | Cho IR sensor phat hien thuoc roi (timeout 3s) |
| SUCCESS | 3 | IR detect thanh cong -> gui MQTT status |
| ERROR | 2 | Timeout hoac khong detect -> bao loi |

### Luong hoat dong

1. **Khoi dong**:
   - Ket noi Wi-Fi
   - Ket noi MQTT broker
   - Khoi tao stepper ve vi tri ban dau
   - In trang thai len Serial

2. **Trong trang thai IDLE**:
   - Doc cam bien IR lien tuc
   - Doc cam bien cam ung TTP224
   - Kiem tra MQTT neu co lenh moi
   - Xu ly lenh nhan duoc

3. **Khi nhan lenh phat thuoc**:
   - Chuyen sang trang thai DISPENSE
   - Xoay stepper tuong ung (512 steps = 1/4 vong)
   - Mo dong relay servo (neu co)
   - Chuyen sang WAIT_SENSOR

4. **Khi cho IR sensor**:
   - Doc gia tri IR lien tuc
   - Neu IR < nguong (2000) -> phat hien thuoc -> SUCCESS
   - Neu timeout 3s -> ERROR

5. **Khi hoan thanh**:
   - Publish trang thai len MQTT topic `medicine/status`
   - Reset bien, quy ve IDLE

## MQTT Topics

### Topic dong

| Topic | Description | Payload |
|-------|-------------|---------|
| `medicine/command` | Lenh gui toi ESP32 | `{"slot": 1}` hoac `{"slot": 2}` |
| `medicine/status` | Trang thai tu ESP32 | Xem ben duoi |

### Status Payload

```json
{
  "slot": 1,
  "status": "success",
  "ir_triggered": true
}
```

Cac gia tri status:
- `"success"`: Phat thuoc thanh cong
- `"no_pill_detected"`: Khong phat hien thuoc roi
- `"system_reset"`: He thong duoc reset
- `"error"`: Loi khac

## API Endpoints

### Backend API

Ung dung goi API toi backend:

| Method | Endpoint | Description |
|--------|----------|------------|
| GET | `/api/medicine/logs` | Lay lich su phat thuoc |
| GET | `/api/medicine/status` | Lay trang thai hien tai |
| POST | `/api/medicine/dispense` | Phat thuoc (body: `{slot: 1\|2}`) |

## WebSocket Events

### Client lang nghe

| Event | Description |
|-------|-------------|
| `medicine:status` | Trang thai phat thuoc cap nhat |
| `medicine:logs` | Lich su phat thuoc cap nhat |
| `system:status` | Trang thai he thong |
| `mqtt:status` | Trang thai MQTT |

### Client gui

| Event | Description |
|-------|-------------|
| `request:initial-data` | Yeu cau du lieu ban dau |

## Xuat hien loi va cach khac phuc

### Loi thuong gap

| Loi | Nguyen nhan | Cach khac phuc |
|-----|-------------|----------------|
| Khong ket noi duoc Wi-Fi | Sai ten Wi-Fi hoac mat khau | Kiem tra cau hinh `WIFI_SSID`, `WIFI_PASSWORD` |
| Khong ket noi MQTT | MQTT broker khong chay | Kiem tra MQTT broker da khoi dong |
| IR khong phat hien thuoc | Cam bien khong dung vi tri | Dieu chinh vi tri cam bien |
| Stepper khong quay | Day ket noi loi | Kiem tra day ULN2003 |
| Touch Button khong phan ung | Cam bien TTP224 loi | Kiem tra nguon 5V |

### Kiem tra trang thai

Mo Serial Monitor (9600 baud) de xem log:

```
===== Medicine Dispenser - Stepper v1.0 =====
Connecting WiFi: Ret.....
WiFi OK!
IP: 192.168.1.100
MQTT connecting to 172.20.10.2:1883
MQTT Connected!
State: IDLE -> DISPENSE
=> DISPENSE SLOT: 1
=> STEPPER A DISPENSED
=== Stepper done, waiting sensor ===
IR1: 1500 IR2: 4095 Detected: YES
State: WAIT_SENSOR -> SUCCESS
Published: {"slot":1,"status":"success","ir_triggered":true}
State: SUCCESS -> IDLE
```

## Bao tri

### Bao tri dinh ky

- **Hang tuan**: Kiem tra trang thai hoat dong, lam sach IR sensor
- **Hang thang**: Kiem tra day ket noi, bo loc bui
- **Hang quy**: Thay the linh kien hong neu can

### Thay the linh kien

1. **Stepper Motor**: Thay the khi keu to, rung nhieu
2. **IR Sensor**: Thay the khi doc sai gia tri
3. **TTP224**: Thay the khi khong phan ung

## Mo rong he thong

### Them nhieu ngăn thuốc

1. Them stepper motor + IR sensor
2. Cap nhat code: tang so luong slot
3. Cap nhat MQTT topic

### Them MQTT Integration

1. Cau hình MQTT broker (cloud/neu)
2. Cap nhat MQTT_SERVER trong code
3. Them authentication neu can

### Them IoT Dashboard

1. Su dung Home Assistant
2. Su dung Node-RED
3. Su dung custom dashboard

## Giao diện nguoi dung

### Man hinh chinh

- Hien thi trang thai: IDLE, DISPENSE, SUCCESS, ERROR
- 2 nut bam: "Nhả thuốc A", "Nhả thuốc B"
- Nut microphone cho voice command
- Lich su phat thuoc (realtime)

### Trang thai hien thi

- Do xanh: Hoat dong binh thuong
- Do cam: Warning/Error
- Xanh la: Thanh cong

## Gop y

Neu co thac mac hoac can ho tro, vui long:
- Tao issue tren GitHub
- Lien he qua email

## License

MIT License

## Tac gia

- Developer: [Ten]
- Version: 1.0.0
- Ngay tao: 2024