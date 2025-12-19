# University of Maine COS 498 – Final Project

# Project Overview

This project implements a web app with user authentication, comment and chat functionality, and profile customization. Features include:

- user registration
- login
- profile management
- comment system:
    - pagination
    - timestamps
- real-time chat system using Socket.io
- security features: 
    - password hashing
    - account lockout
    - input validation
- reverse proxy with nginx

# Table of Contents

1.  Setup Instructions
2.  Database Schema 
3.  Nginx Proxy Manager Setup  
4.  Security Features 
5.  API Endpoints (Chat)
6.  Known Limitations
7.  Design Decisions
8.  MISSING
# Setup Instructions

    Prerequisites:
    - Node.js
    - SQLite3
    - Docker & Docker Compose
    - Nginx Proxy Manager

    Installation

1. clone the repository:
   
   git clone <repo-url>
   cd <repo-directory>

2. install Node.js dependencies:

npm install

3. initialize the database:

    sqlite3 node/data/forum.db < node/migrations/001_init.sql


4. Configure environment variables:

NOT WORKING IN CURRENT IMPLEMENTATION
create a .env file in the project root:
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password


5. Run the application:

docker compose build
docker compose up


# Database Schema
PRAGMA foreign_keys = ON;

--Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  locked_until INTEGER DEFAULT 0,
  profile_color TEXT DEFAULT '#000000'
);

--Login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  ip_address TEXT,
  timestamp INTEGER NOT NULL,
  success INTEGER NOT NULL
);

--Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

--Comments
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
);

--Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);



# Deploy Nginx Proxy Manager using Docker.

    Add a new proxy host:

        Domain: your-domain.com

        Forward Hostname/IP: backend-nodejs

        Forward Port: 3000

    Enable SSL via Lets Encrypt

    Test access via your domain

Email Service Configuration

    Uses Nodemailer with Gmail SMTP.

    Requires App Passwords if 2FA is enabled.

    Example .env:

EMAIL_USER=example@gmail.com
EMAIL_PASS=your_app_password

    Password reset emails contain:

        Tokenized link

        Expiration time (1 hour)

        Instructions for resetting password

# Security Features

    Password hashing: Argon2

    Account lockout: 5 failed login attempts in 15 minutes → 15-min lock

    Input validation: Strong passwords, email format, display name checks

    Session handling: express-session with secret and cookie configuration

    Password reset tokens: Random 32-byte hex, single-use, expires after 1 hour

    SQL injection protection: Parameterized queries

# API Endpoints (Chat)
Method	Endpoint	Description
GET	/chat	Returns chat page (requires login)
Socket.io	connect	Join chat room
Socket.io	message	Send/receive messages in real-time
GET	/api/chat/history?page=N	Fetch paginated chat messages

# Known Limitations

    Session cookies are not secure in development (secure: false)

    No rate limiting for chat messages

    
# Design Decisions & Trade-offs

    SQLite chosen for simplicity, ease of setup 
    - limits concurrent writes

    Argon2 for password hashing 
    - prioritizes security

    Socket.io for chat  

    Pagination 
    - avoids loading all comments at once
    - trade-off: requires extra SQL query for count


# MISSING
Email implemntation included but is not functional


All HTML and CSS done by chatGPT