# Product Requirements Document: CodeRunner v1.1

## Executive Summary

CodeRunner is a modern, high-performance code execution engine designed as a drop-in replacement for Judge0. Built on Node.js/Express with Firecracker microVMs as the primary execution environment and Docker containers as a fallback, it provides secure, isolated code execution with full API compatibility while delivering superior performance and reliability.

## Product Vision

Create the fastest, most reliable code execution service that seamlessly replaces Judge0 while leveraging modern infrastructure technologies to provide better isolation, performance, and developer experience.

## Goals and Success Metrics

### Primary Goals
- **100% API Compatibility**: Support all Judge0 API endpoints and language codes
- **Performance**: 3-5x faster execution times compared to Judge0
- **Reliability**: 99.9% uptime with graceful failure handling
- **Security**: Military-grade isolation using Firecracker microVMs with Docker fallback
- **Flexible Deployment**: Support both Firecracker (KVM-enabled) and Docker-only environments

### Success Metrics
- Average execution time < 500ms for simple programs
- Cold start time < 100ms for Firecracker VMs, < 2s for Docker
- Support for 50+ programming languages
- Handle 1000+ concurrent executions
- API response time < 50ms (excluding code execution)

## Target Users

1. **Coding Platform Developers**: Building online IDEs, coding bootcamps, interview platforms
2. **Educational Technology Companies**: Running automated code grading systems
3. **Existing Judge0 Users**: Seeking better performance and modern infrastructure
4. **API-First Companies**: Requiring programmatic code execution at scale

## Core Features

### 1. Judge0 API Compatibility Layer

**Endpoints to Support:**
- `POST /submissions` - Create submission
- `GET /submissions/:token` - Get submission status
- `POST /submissions/batch` - Batch submissions
- `GET /submissions/batch` - Batch submission status
- `GET /languages` - List supported languages
- `GET /statuses` - List execution statuses
- `GET /about` - System information

**Request/Response Format:**
- Identical JSON structure to Judge0
- Same authentication mechanisms (API key)
- Same error codes and status messages
- Support for all Judge0 query parameters (base64_encoded, wait, fields, etc.)

**Not Implementing:**
- Persistent submission history (stateless, cache-only storage)

> Note: webhook/callback URLs (`callback_url`) *are* implemented (with SSRF
> protection on the target URL) — this PRD predates that addition and is kept
> here as a historical planning document rather than a living spec.

### 2. Language Support

**Initial Release (Top 20 languages):**
- JavaScript (Node.js)
- Python (2.7, 3.x)
- Java (8, 11, 17)
- C/C++ (GCC, Clang)
- C# (.NET)
- Go
- Rust
- Ruby
- PHP
- TypeScript
- Kotlin
- Swift
- R
- Perl
- Bash
- SQL (MySQL, PostgreSQL)

**Language Code Mapping:**
- Use identical language IDs as Judge0 for compatibility
- Standard language versions only (no custom runtime versions)

### 3. Dual Execution Backend

**Primary: Firecracker microVMs**
- Ultra-fast cold starts (< 100ms)
- Snapshot-based rapid VM creation
- Superior isolation and security
- Lower resource overhead
- **Requirement**: Linux with KVM support

**Fallback: Docker Containers**
- Universal compatibility (works anywhere Docker runs)
- ~2s cold start time
- Standard container isolation
- Works on macOS, Windows, Linux without KVM

**Selection Logic:**
```
if (KVM_AVAILABLE && FIRECRACKER_ENABLED) {
  use Firecracker VM
} else {
  use Docker container
}
```

**Auto-Detection:**
- System checks KVM availability on startup
- Automatically selects appropriate backend
- Logs backend selection for transparency
- Allows manual override via config

### 4. Firecracker Backend (Primary)

**VM Management:**
- Pre-warmed VM pool for common languages
- Snapshot-based rapid VM creation
- Automatic VM lifecycle management
- Resource limits per VM (CPU, memory, disk)

**Isolation Features:**
- Network isolation (no internet access by default)
- Filesystem isolation with read-only base images
- Time-based execution limits
- Memory constraints enforcement

**VM Pool Strategy:**
- Keep warm VMs for top 10 languages
- On-demand creation for less common languages
- Periodic cleanup of idle VMs
- Health monitoring and auto-replacement

### 5. Docker Backend (Fallback)

**Container Management:**
- Pre-built language images
- Docker network isolation (none mode)
- Resource constraints via cgroups
- Automatic cleanup after execution

**Image Architecture:**
```
coderunner-base
├── coderunner-python
├── coderunner-javascript
├── coderunner-java
└── ... (one per language)
```

**Execution Flow:**
1. Spin up container from language image
2. Mount code file as read-only volume
3. Execute with timeout and resource limits
4. Capture output
5. Destroy container

**Resource Limits:**
- CPU: Limited via `--cpus`
- Memory: Limited via `--memory`
- Network: Disabled via `--network=none`
- Disk: tmpfs with size limit

### 6. Execution Pipeline

```
Request → Validation → Queue → Backend Selection → 
VM/Container Assignment → Code Injection → Execution → 
Result Capture → Cache → Response
```

**Queue System:**
- Redis-based job queue (Bull/BullMQ)
- Priority queuing support
- Fair scheduling algorithm
- Dead letter queue for failed executions
- Separate queues for Firecracker vs Docker

**Execution Flow:**
1. Receive submission via API
2. Validate and sanitize input
3. Add to Redis queue
4. Worker picks up job
5. Select backend (Firecracker or Docker)
6. Assign to available execution environment
7. Execute with resource constraints
8. Capture stdout, stderr, exit code, timing
9. Store results in Redis cache (TTL: 1 hour)
10. Return formatted response

### 7. Resource Management

**Configurable Limits:**
- CPU time limit (default: 5 seconds)
- Wall time limit (default: 10 seconds)
- Memory limit (default: 256MB)
- Disk space limit (default: 10MB)
- Output size limit (default: 1MB)

**Firecracker VM Pool:**
- Minimum pool size: 10 (configurable)
- Maximum pool size: 100 (configurable)
- VM reuse after cleanup
- Health check and automatic replacement

**Docker Container Pool:**
- No persistent pool (create on-demand)
- Aggressive cleanup after execution
- Image pre-pulling on startup

## Technical Architecture

### Tech Stack
- **Runtime**: Node.js 20+ (LTS)
- **Framework**: Express.js
- **Primary Backend**: Firecracker (with KVM)
- **Fallback Backend**: Docker
- **Queue**: Redis with BullMQ
- **Cache**: Redis (for results, TTL-based)
- **Monitoring**: Prometheus + Grafana

### System Components

```
┌─────────────────┐
│   API Layer     │ (Express.js)
└────────┬────────┘
         │
┌────────┴────────┐
│  Queue Layer    │ (Redis/BullMQ)
└────────┬────────┘
         │
┌────────┴────────────┐
│   Orchestrator      │ (Backend Selection + VM/Container Manager)
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
┌───┴───┐ ┌──┴────┐
│ F/VMs │ │Docker │
└───────┘ └───────┘
```

### Key Modules

**1. API Server** (`src/api/`)
- Route handlers
- Request validation
- Authentication middleware
- Response formatting
- Rate limiting

**2. Queue Manager** (`src/queue/`)
- Job creation and management
- Priority handling
- Retry logic
- Dead letter queue handling

**3. Backend Detector** (`src/backend/detector.js`)
- KVM availability check
- Backend capability detection
- Configuration validation

**4. Orchestrator** (`src/orchestrator/`)
- Backend selection logic
- Resource allocation
- Health monitoring
- Metrics collection

**5. Firecracker Manager** (`src/backends/firecracker/`)
- VM lifecycle management
- Pool management
- Snapshot handling
- Jailer configuration

**6. Docker Manager** (`src/backends/docker/`)
- Container lifecycle
- Image management
- Resource constraint enforcement
- Cleanup automation

**7. Execution Engine** (`src/executor/`)
- Code compilation (if needed)
- Runtime execution
- Output capture
- Result processing
- Common interface for both backends

**8. Language Adapters** (`src/languages/`)
- Language-specific configurations
- Compiler/interpreter settings
- Runtime environment setup
- Build commands

## API Specification

### Create Submission
```http
POST /submissions
Content-Type: application/json
X-API-Key: your-api-key

{
  "source_code": "print('Hello World')",
  "language_id": 71,
  "stdin": "",
  "expected_output": "Hello World\n",
  "cpu_time_limit": 2.0,
  "memory_limit": 128000
}
```

**Response:**
```json
{
  "token": "abc123-def456-ghi789",
  "status": {
    "id": 1,
    "description": "In Queue"
  }
}
```

### Get Submission (Polling)
```http
GET /submissions/abc123-def456-ghi789?fields=*
X-API-Key: your-api-key
```

**Response (In Progress):**
```json
{
  "token": "abc123-def456-ghi789",
  "status": {
    "id": 2,
    "description": "Processing"
  }
}
```

**Response (Completed):**
```json
{
  "token": "abc123-def456-ghi789",
  "status": {
    "id": 3,
    "description": "Accepted"
  },
  "stdout": "Hello World\n",
  "stderr": null,
  "compile_output": null,
  "time": "0.023",
  "memory": 3456,
  "exit_code": 0,
  "backend": "firecracker"
}
```

### Status Codes (Judge0 Compatible)
1. In Queue
2. Processing
3. Accepted
4. Wrong Answer
5. Time Limit Exceeded
6. Compilation Error
7. Runtime Error (SIGSEGV)
8. Runtime Error (SIGXFSZ)
9. Runtime Error (SIGFPE)
10. Runtime Error (SIGABRT)
11. Runtime Error (NZEC)
12. Runtime Error (Other)
13. Internal Error
14. Exec Format Error

### Batch Submissions
```http
POST /submissions/batch
Content-Type: application/json
X-API-Key: your-api-key

{
  "submissions": [
    {
      "source_code": "print(1)",
      "language_id": 71
    },
    {
      "source_code": "print(2)",
      "language_id": 71
    }
  ]
}
```

**Response:**
```json
[
  {
    "token": "token1"
  },
  {
    "token": "token2"
  }
]
```

### Get Languages
```http
GET /languages
```

**Response:**
```json
[
  {
    "id": 71,
    "name": "Python (3.8.1)"
  },
  {
    "id": 63,
    "name": "JavaScript (Node.js 12.14.0)"
  }
]
```

### System Information
```http
GET /about
```

**Response:**
```json
{
  "version": "1.0.0",
  "backend": "firecracker",
  "fallback": "docker",
  "languages_count": 20,
  "queue_size": 15,
  "active_executions": 8
}
```

## Non-Functional Requirements

### Performance
- P50 latency: < 200ms (excluding code execution)
- P99 latency: < 500ms (excluding code execution)
- Throughput: 1000+ submissions/second (Firecracker)
- Throughput: 200+ submissions/second (Docker fallback)
- Firecracker cold start: < 100ms
- Docker cold start: < 2s

### Security
- Sandbox all code execution
- No network access from VMs/containers
- Resource exhaustion protection
- Input sanitization and validation
- API rate limiting (per API key)
- No persistent file storage

### Scalability
- Horizontal scaling of API servers
- VM/Container pool auto-scaling based on load
- Support for distributed deployment
- Multi-region capability

### Reliability
- 99.9% uptime SLA
- Automatic failover (Firecracker → Docker)
- Graceful degradation
- Comprehensive error handling
- Result caching with TTL

### Observability
- Real-time metrics (execution time, queue depth, backend usage)
- Backend selection tracking
- Structured logging
- Health check endpoints
- Prometheus metrics export

## Pricing Model

### Per-Execution Pricing

**Pricing Tiers:**
```
Firecracker Execution:
- CPU time: $0.0001 per second
- Memory: $0.00001 per MB-second
- Base cost per execution: $0.001

Docker Execution (Fallback):
- CPU time: $0.00015 per second
- Memory: $0.000015 per MB-second  
- Base cost per execution: $0.0015

Example:
- Python script running 2s, using 50MB: 
  Firecracker: $0.001 + (0.0001 × 2) + (0.00001 × 50 × 2) = $0.002
  Docker: $0.0015 + (0.00015 × 2) + (0.000015 × 50 × 2) = $0.003
```

**Billing Features:**
- Real-time usage tracking
- API key-based metering
- Monthly billing cycle
- Usage analytics dashboard
- Prepaid credits option

## Configuration

### Environment Variables
```bash
# Server
PORT=3000
NODE_ENV=production
API_KEY_REQUIRED=true

# Redis
REDIS_URL=redis://localhost:6379
RESULT_CACHE_TTL=3600

# Backend Selection
BACKEND_PRIMARY=firecracker
BACKEND_FALLBACK=docker
AUTO_DETECT_BACKEND=true

# Firecracker
FIRECRACKER_ENABLED=true
FIRECRACKER_BINARY=/usr/bin/firecracker
VM_POOL_MIN=10
VM_POOL_MAX=100
VM_MEMORY_MB=256

# Docker
DOCKER_ENABLED=true
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_NETWORK_MODE=none

# Execution Limits
DEFAULT_CPU_TIME_LIMIT=5
DEFAULT_WALL_TIME_LIMIT=10
DEFAULT_MEMORY_LIMIT=256000
MAX_OUTPUT_SIZE=1048576

# Security
RATE_LIMIT_PER_MINUTE=100
MAX_SOURCE_CODE_SIZE=65536

# Billing
METERING_ENABLED=true
BILLING_EXPORT_INTERVAL=3600
```

## Deployment Model

### Architecture Options

**Option 1: Firecracker-Only (Production)**
```yaml
Requirements:
  - Linux with KVM support
  - 8GB+ RAM
  - 100GB+ disk
  
Components:
  - API servers (Express)
  - Queue workers (Firecracker managers)
  - Redis (queue + cache)
```

**Option 2: Docker-Only (Development/Testing)**
```yaml
Requirements:
  - Docker Desktop (macOS/Windows)
  - Docker Engine (Linux)
  - 4GB+ RAM
  
Components:
  - API servers (Express)
  - Queue workers (Docker managers)
  - Redis (queue + cache)
```

**Option 3: Hybrid (Production with Fallback)**
```yaml
Requirements:
  - Linux with KVM + Docker
  - 16GB+ RAM
  - 200GB+ disk
  
Components:
  - API servers (Express)
  - Queue workers (both backends)
  - Redis (queue + cache)
  - Backend health monitor
```

### Docker Compose Example
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - BACKEND_PRIMARY=firecracker
      - BACKEND_FALLBACK=docker
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /dev/kvm:/dev/kvm
    privileged: true

  worker:
    build: .
    command: npm run worker
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /dev/kvm:/dev/kvm
    privileged: true
    deploy:
      replicas: 4

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Migration Path from Judge0

### Phase 1: API Compatibility ✓
1. Map all Judge0 endpoints
2. Support identical request/response formats
3. Implement language ID compatibility

### Phase 2: Feature Parity ✓
1. Match execution behavior
2. Implement all Judge0 configuration options
3. Polling-based result retrieval

### Phase 3: Enhanced Features
1. Dual backend support
2. Improved performance metrics
3. Better error messages
4. Enhanced monitoring
5. Per-execution pricing

**Migration Steps for Users:**
1. Update base URL in configuration
2. Test with sample submissions on both backends
3. Gradually shift traffic (5% → 25% → 50% → 100%)
4. Monitor performance metrics
5. Adjust resource limits based on usage

## Development Phases

### Phase 1: Core Foundation (Weeks 1-4)
- [x] Basic Express API with Judge0 compatible endpoints
- [x] Backend detection system
- [x] Docker backend with 5 core languages (Python, JavaScript, Java, C++, C)
- [x] Redis queue implementation
- [x] Simple result caching
- [ ] Basic metering

### Phase 2: Firecracker Integration (Weeks 5-8)
- [ ] Firecracker VM setup and configuration
- [ ] VM pool management
- [ ] Snapshot creation for 5 core languages
- [ ] Automatic fallback to Docker
- [ ] Performance benchmarking

### Phase 3: Language Expansion (Weeks 9-12)
- [ ] Add 15+ additional languages
- [ ] Both Firecracker and Docker images
- [ ] Compilation support for compiled languages
- [ ] Enhanced error handling
- [ ] Language testing suite

### Phase 4: Production Hardening (Weeks 13-16)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing (1000+ concurrent)
- [ ] Monitoring and observability (Prometheus)
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Billing system integration

### Phase 5: Polish & Launch (Weeks 17-20)
- [ ] Admin dashboard
- [ ] Usage analytics
- [ ] Multi-region deployment testing
- [ ] Comprehensive documentation
- [ ] Beta user onboarding

## Risk Assessment

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firecracker learning curve | High | Extensive prototyping, fallback to Docker |
| VM cold start latency | Medium | Pre-warmed pools, snapshot optimization |
| Docker slower than expected | Low | Primary focus on Firecracker for production |
| Resource exhaustion | High | Strict limits, monitoring, auto-scaling |
| KVM not available | Medium | Automatic Docker fallback |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Judge0 API changes | Medium | Version pinning, regular compatibility checks |
| Language version drift | Low | Automated testing suite, CI/CD |
| Pricing too high/low | Medium | Market research, pilot program |
| Competition | Medium | Focus on performance, reliability |

## Success Criteria

### Launch Criteria
- [ ] All Judge0 endpoints implemented
- [ ] Both Firecracker and Docker backends working
- [ ] Automatic backend selection
- [ ] 20+ languages supported on both backends
- [ ] < 100ms API latency (P99)
- [ ] < 100ms Firecracker cold start
- [ ] < 2s Docker cold start
- [ ] Security audit passed
- [ ] Load test: 1000 concurrent (Firecracker), 200 concurrent (Docker)
- [ ] Metering system operational
- [ ] Documentation complete
- [ ] Docker deployment tested

### Post-Launch Metrics (3 months)
- 100+ active users/installations
- 99.9% uptime achieved
- Firecracker usage > 80% (in KVM environments)
- Performance benchmarks 3x better than Judge0
- Zero critical security incidents

---


