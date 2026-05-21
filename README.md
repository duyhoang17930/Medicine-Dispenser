# Hộp Thuốc Thông Minh - Setup Guide

## Tổng quan hệ thống

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend  │────▶│  ESP32 IoT  │
│  React Web  │     │  Node.js   │     │  Device    │
│  :3001      │     │  :3000     │     │  MQTT      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │            ┌──────┴──────┐            │
       │            │             │            │
       │       ┌────▼────┐  ┌───▼────┐ ┌───▼────┐
       │       │  MySQL   │  │  MQTT  │ │ Voice  │
       │       │ Database │  │ Broker │ │  API   │
       │       └─────────┘  └────────┘ └────────┘
       │
       │         ┌──────────────────────────┐
       │         │    Voice Control        │
       │         │  (Web Speech API)      │
       │         └──────────────────────────┘
─────────────────────────────────────────────────
```

## Yêu cầu hệ thống

- **Node.js**: 18+ (khuyến nghị 20 LTS)
- **MySQL**: 8.0+ (hoặc MySQL local)
- **MQTT Broker**: Mosquitto (version 2.0+)
- **Python**: 3.8+ (cho voice-control.py)
- **ESP32**: Board ESP32-WROOM-32

## Cài đặt từng bước

### Bước 1: Cài đặt MQTT Broker

#### Windows (sử dụng Chocolatey)
```powershell
# Cài đặt Chocolatey nếu chưa có
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Cài đặt Mosquitto
choco install mosquitto -y
```

#### Windows (thủ công)
```powershell
# Tải Mosquitto từ https://mosquitto.org/download/
# Giải nén và thêm vào PATH
```

#### Khởi động MQTT Broker
```powershell
# Tạo file cấu hình mosquitto.conf trong thư mục Mosquitto
# Nội dung:
# listener 1883
# allow_anonymous true

# Chạy Mosquitto
mosquitto -c mosquitto.conf -v
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mosquitto mosquitto-clients
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

#### Kiểm tra MQTT
```bash
# Test subscribe
mosquitto_sub -t "test"

# Test publish (terminal khác)
mosquitto_pub -t "test" -m "hello"
```

---

### Bước 2: Cài đặt MySQL Database

#### Windows (sử dụng XAMPP - khuyến nghị)
```powershell
# Tải XAMPP từ https://www.apachefriends.org/
# Cài đặt và khởi động MySQL
```

#### Windows (standalone)
```powershell
# Tải MySQL Installer từ https://dev.mysql.com/
# Cài đặt MySQL Server
```

#### Tạo Database

Chạy file backend/database/schema.sql

---

### Bước 3: Cài đặt Backend

```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt dependencies
npm install

# Tạo file .env
copy .env.example .env
# Hoặc tạo mới với nội dung:
```

File `.env` backend:
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=medicine_dispenser

# MQTT Broker
MQTT_HOST=localhost
MQTT_PORT=1883

# Server
PORT=3000

# Voice API (tùy chọn)
OPENAI_API_KEY=your_key_here
```

#### Khởi động Backend
```bash
npm start
# Hoặc
node server.js
```

Backend chạy tại: `http://localhost:3000`

---

### Bước 4: Cài đặt Frontend

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Tạo file .env (tùy chọn)
echo REACT_APP_MQTT_URL=mqtt://localhost:1883 > .env
```

#### Khởi động Frontend
```bash
npm start
```

Frontend chạy tại: `http://localhost:3001`

---

### Bước 5: Cài đặt ESP32 (Hardware)

#### Linh kiện cần thiết:
| Linh kiện | Số lượng | Ghi chú |
|-----------|---------|---------|
| ESP32-WROOM-32 | 1 | Board chính |
| Stepper 28BYJ-48 | 2 | Động cơ bước |
| ULN2003 Driver | 2 | Module điều khiển stepper |
| IR Sensor (GP2Y0A21YK) | 2 | Cảm biến hồng ngoại |
| TTP224 Touch | 1 | Cảm biến chạm |

#### Sơ đồ đấu nối:

```
ESP32 GPIO Map:
─────────────────────────────
GPIO 26 → Stepper A IN1
GPIO 27 → Stepper A IN2
GPIO 14 → Stepper A IN3
GPIO 12 → Stepper A IN4

GPIO 16 → Stepper B IN1
GPIO 17 → Stepper B IN2
GPIO 05 → Stepper B IN3
GPIO 18 → Stepper B IN4

GPIO 34 → IR Sensor A (Analog)
GPIO 35 → IR Sensor B (Analog)
GPIO 36 → TTP224 Touch

─────────────────────────────
Nguồn:
3.3V  → ESP32 VCC
5V     → ULN2003, IR, TTP224
GND    → Tất cả GND
```

#### Nạp code ESP32:
```bash
# Mở Arduino IDE
# Cài đặt thư viện:
# - PubSubClient
# - Stepper

# Mở file backend/esp32/medicine_dispenser_fsm/medicine_dispenser_fsm.ino
# Cấu hình WiFi và MQTT:
const char* WIFI_SSID = "Your WiFi Name";
const char* WIFI_PASSWORD = "Your WiFi Password";
const char* MQTT_SERVER = "192.168.1.X";  // IP của máy chạy MQTT

# Nạp code vào ESP32
```

---

### Bước 6: Voice Control (Tùy chọn)

```bash
# Cài đặt Python dependencies
pip install pyaudio openai whisper

# Hoặc chạy file có sẵn
python voice-control.py --server
```

---

## Kiểm tra hệ thống

### 1. Kiểm tra MQTT
```bash
# Subscribe to all topics
mosquitto_sub -t "medicine/#" -v

# Publish test command
mosquitto_pub -t "medicine/command" -m '{"slot":1}'
```

### 2. Kiểm tra Backend API
```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:3000/health

# Get logs
Invoke-WebRequest -Uri http://localhost:3000/api/medicine/logs

# Dispense
Invoke-WebRequest -Uri http://localhost:3000/api/medicine/dispense -Method POST -ContentType "application/json" -Body '{"slot":1}'
```

### 3. Kiểm tra Frontend
Mở trình duyệt tại: `http://localhost:3001`

- Kiểm tra kết nối MQTT (system log hiển thị "MQTT Connected")
- Nhấn nút "Phát Thuốc Ho" / "Phát Thuốc Sốt"
- Xem log cập nhật realtime

---

## Chạy nhanh (Quick Start)

```bash
# 1. Khởi động MQTT
mosquitto

# 2. Khởi động MySQL (XAMPP)
# Mở XAMPP Control Panel → Start MySQL

# 3. Terminal mới: Backend
cd backend && npm start

# 4. Terminal mới: Frontend
cd frontend && npm start

# 5. Mở trình duyệt
http://localhost:3001
```

---

## Cấu trúc dự án

```
Medicine-Dispenser/
├── backend/                 # Node.js API server
│   ├── routes/            # API routes
│   ├── database/          # Database queries
│   ├── mqtt/             # MQTT handlers
│   ├── esp32/            # ESP32 code
│   ├── .env             # Environment variables
│   └── server.js         # Main server
│
├── frontend/              # React web app
│   ├── src/
│   │   ├── App.js       # Main component
│   │   ├── components/ # UI components
│   │   └── index.css   # Styles
│   └── package.json
│
├── voice-control.py        # Python voice control
├── run-voice.bat        # Voice control launcher
├── SETUP.md            # This file
└── .gitignore
```

---

## Thông tin thêm

- **Backend API**: `http://localhost:3000`
- **Frontend**: `http://localhost:3001`
- **MQTT**: `mqtt://localhost:1883`
- **Database**: `localhost:3306`

## License

MIT