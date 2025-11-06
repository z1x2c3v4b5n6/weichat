# Infrastructure

## Prerequisites
- Docker Desktop or Docker Engine + Docker Compose v2
- Optional: update `.env.example` for custom domains or ports

## One-command bootstrap
```bash
docker compose -f infra/docker-compose.yaml up -d --build
```

The stack exposes:
- Web app: http://localhost
- API: http://localhost/api
- Socket.IO: ws://localhost/socket.io
- MinIO console: http://localhost:9001 (user: `minioadmin` / `minioadmin`)

To stop and remove containers:
```bash
docker compose -f infra/docker-compose.yaml down
```

## HTTPS
The provided `nginx.conf` includes commented HTTPS directives. Generate a self-signed certificate and mount it into `/etc/nginx/certs` to enable TLS.
