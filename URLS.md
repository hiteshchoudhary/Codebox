# CodeBox - Important URLs

## Local Development

| Service | URL | Description |
|---------|-----|-------------|
| **API Server** | http://localhost:3000 | Main API endpoint |
| **Health Check** | http://localhost:3000/health | API health status |
| **Prometheus Metrics** | http://localhost:3000/metrics | Prometheus scrape endpoint |
| **Redis** | localhost:6379 | Redis server (internal) |

## Production (docker-compose.prod.yml)

| Service | URL | Description |
|---------|-----|-------------|
| **API (via Caddy)** | http://localhost:80 | Main API through reverse proxy |
| **API (direct)** | http://localhost:3000 | Direct API access |
| **Prometheus** | http://localhost:9090 | Prometheus dashboard |
| **Grafana** | http://localhost:3001 | Grafana dashboards (admin/admin) |

---

## API Endpoints Quick Reference

### System
```
GET  /health        - Health check (no auth)
GET  /about         - System info
GET  /system_info   - Detailed system metrics
GET  /config_info   - Configuration limits
GET  /workers       - Worker status
GET  /statistics    - Queue statistics
GET  /metrics       - Prometheus metrics
GET  /executor      - Executor info (Docker/Firecracker)
```

### Languages
```
GET  /languages      - List active languages
GET  /languages/all  - List all languages
GET  /languages/:id  - Get language by ID
GET  /statuses       - List all status codes
```

### Submissions
```
POST   /submissions              - Create submission
POST   /submissions?wait=true    - Create and wait for result
GET    /submissions/:token       - Get submission by token
DELETE /submissions/:token       - Delete submission
POST   /submissions/batch        - Batch create (up to 20)
GET    /submissions/batch?tokens=a,b,c - Batch get
```

---

## Quick Test Commands

### Health Check
```bash
curl http://localhost:3000/health
```

### List Languages
```bash
curl http://localhost:3000/languages \
  -H "X-Auth-Token: dev-token"
```

### Run Python Code
```bash
curl -X POST "http://localhost:3000/submissions?wait=true" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: dev-token" \
  -d '{"source_code": "print(1+1)", "language_id": 71}'
```

### Run JavaScript Code
```bash
curl -X POST "http://localhost:3000/submissions?wait=true" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: dev-token" \
  -d '{"source_code": "console.log(2+2)", "language_id": 63}'
```

### Run C++ Code
```bash
curl -X POST "http://localhost:3000/submissions?wait=true" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: dev-token" \
  -d '{"source_code": "#include <iostream>\nint main() { std::cout << 42; return 0; }", "language_id": 54}'
```

---

## Language IDs

| ID | Language |
|----|----------|
| 50 | C (GCC 9) |
| 54 | C++ (GCC 9) |
| 62 | Java (OpenJDK 17) |
| 63 | JavaScript (Node.js 18) |
| 71 | Python (3.8) |
| 74 | TypeScript (5.0) |
| 89 | Multi-file program |

### RapidAPI / Judge0-CE-Extra aliases

These map to the native language configs above rather than distinct runtimes:

| RapidAPI ID | Aliases to |
|-------------|------------|
| 92 | Python (71) |
| 93, 102 | JavaScript (63) |
| 94 | TypeScript (74) |

---

## Status Codes

| ID | Status |
|----|--------|
| 1 | In Queue |
| 2 | Processing |
| 3 | Accepted |
| 4 | Wrong Answer |
| 5 | Time Limit Exceeded |
| 6 | Compilation Error |
| 7-12 | Runtime Errors |
| 13 | Internal Error |

---

## Postman

Import `postman_collection.json` into Postman to test all endpoints.

**Setup:**
1. Import the collection
2. Set `baseUrl` variable to `http://localhost:3000`
3. Auth token `dev-token` is pre-configured
