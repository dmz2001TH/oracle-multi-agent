# Oracle Multi-Agent v5.0 — VPS Deployment Guide

## Quick Start

```bash
# 1. Clone
git clone https://github.com/dmz2001TH/oracle-multi-agent.git
cd oracle-multi-agent

# 2. Install
npm install

# 3. Start
npx tsx src/index.ts
# → http://localhost:3456
```

## Environment Variables

```bash
# .env
DB_PATH=./data/oracle.db          # SQLite database path
PORT=3456                          # Server port
EMBEDDING_PROVIDER=xenova          # xenova | hash | none
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Embedding model
VECTOR_DB=sqlite                   # sqlite | chroma
```

## systemd Service

```ini
# /etc/systemd/system/oracle-agent.service
[Unit]
Description=Oracle Multi-Agent v5.0
After=network.target

[Service]
Type=simple
User=oracle
WorkingDirectory=/opt/oracle-multi-agent
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3456
Environment=DB_PATH=/opt/oracle-multi-agent/data/oracle.db
Environment=EMBEDDING_PROVIDER=xenova

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable oracle-agent
sudo systemctl start oracle-agent
sudo journalctl -u oracle-agent -f
```

## Docker

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npx tsc --noEmit || true
EXPOSE 3456
CMD ["npx", "tsx", "src/index.ts"]
```

```bash
docker build -t oracle-agent .
docker run -d -p 3456:3456 -v oracle-data:/app/data oracle-agent
```

## Docker Compose

```yaml
version: '3.8'
services:
  oracle:
    build: .
    ports:
      - "3456:3456"
    volumes:
      - oracle-data:/app/data
      - oracle-psi:/app/ψ
    environment:
      - NODE_ENV=production
      - PORT=3456
      - EMBEDDING_PROVIDER=xenova
    restart: unless-stopped

volumes:
  oracle-data:
  oracle-psi:
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name oracle.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Health Check

```bash
curl http://localhost:3456/api/health
# → {"ok":true,"uptime":123,...}
```
