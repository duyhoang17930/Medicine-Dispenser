-- Medicine Dispenser Database Schema
-- Run this SQL to create the database and tables

CREATE DATABASE IF NOT EXISTS medicine_dispenser;
USE medicine_dispenser;

-- Table: medicine_logs - Lưu lịch sử phát thuốc
CREATE TABLE IF NOT EXISTS medicine_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slot INT NOT NULL COMMENT 'Số thuốc (1 hoặc 2)',
    status VARCHAR(20) NOT NULL COMMENT 'Trạng thái: success, fail, no_pill_detected',
    message VARCHAR(255) DEFAULT NULL COMMENT 'Thông báo thêm',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian tạo'
);

-- Table: system_status - Lưu trạng thái hệ thống
CREATE TABLE IF NOT EXISTS system_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    component VARCHAR(50) NOT NULL COMMENT 'Tên component: esp32, mqtt, servo1, servo2, ir_sensor',
    status VARCHAR(20) NOT NULL COMMENT 'Trạng thái: online, offline, error',
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    details TEXT DEFAULT NULL COMMENT 'Chi tiết thêm'
);

-- Insert initial system status
INSERT INTO system_status (component, status, details) VALUES
('esp32', 'offline', 'Chưa kết nối'),
('mqtt', 'offline', 'Chưa kết nối'),
('servo1', 'offline', 'Chưa kích hoạt'),
('servo2', 'offline', 'Chưa kích hoạt'),
('ir_sensor', 'offline', 'Chưa kích hoạt');

-- Table: voice_commands - Lưu lệnh giọng nói
CREATE TABLE IF NOT EXISTS voice_commands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    command_text VARCHAR(255) NOT NULL COMMENT 'Câu lệnh gốc',
    slot INT NOT NULL COMMENT 'Số thuốc được phát',
    confidence FLOAT DEFAULT 1.0 COMMENT 'Độ tin cậy nhận dạng',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_medicine_logs_created_at ON medicine_logs(created_at);
CREATE INDEX idx_medicine_logs_slot ON medicine_logs(slot);