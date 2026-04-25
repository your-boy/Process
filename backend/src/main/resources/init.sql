-- Process Database Initialization Script
-- Run this to set up the database and create an initial admin user

CREATE DATABASE IF NOT EXISTS process_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE process_db;

-- Initial admin user (username: admin, password: admin123)
-- Generate a new bcrypt hash for production use
INSERT IGNORE INTO users (username, email, password, created_at, updated_at)
VALUES ('admin', 'admin@example.com',
        '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iKom2N/ufjFGM5hGSMsV2KJ8h97W',
        NOW(), NOW());
