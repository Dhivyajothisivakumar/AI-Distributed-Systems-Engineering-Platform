# AI Distributed Systems Engineering Platform
A full-stack distributed task processing platform built with Node.js, Express.js, multiple worker processes, PM2, and Windows Task Scheduler.

## Features
- Distributed task processing
- 3 worker processes
- Task queue and task claiming
- Automatic task retry
- Worker heartbeat monitoring
- Worker failure detection
- Automatic task re-queuing
- System monitoring
- Task status tracking
- AI Analysis dashboard
- PM2 process management
- Windows automatic startup

## Technology Stack
- Node.js
- Express.js
- JavaScript
- HTML
- CSS
- PM2
- Windows Task Scheduler

## Architecture

Frontend
    |
    v
Express Backend - Port 5001
    |
    +-- Worker 1
    +-- Worker 2
    +-- Worker 3

## Project Structure

ai-distributed-platform/
+-- backend/
¦   +-- server.js
¦   +-- worker.js
¦   +-- package.json
¦   +-- package-lock.json
+-- frontend/
¦   +-- index.html
¦   +-- app.js
¦   +-- style.css
+-- ecosystem.config.js
+-- pm2-start.bat
+-- README.md

## Start Platform
pm2 start ecosystem.config.js
