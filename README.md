# 🚀 Workflow Engine

[![CI/CD Pipeline](https://github.com/yourusername/workflow-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/workflow-engine/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

A **high-performance, distributed workflow automation engine** built with **Node.js**, **React**, and **Python**. Designed for **enterprise-grade scalability**, **production resilience**, and **developer productivity**.  

---

## 🌟 Key Features

- 🎨 **Visual Workflow Editor** – Intuitive drag-and-drop UI with React Flow  
- 🔗 **Core Node Types** – HTTP, Database, Python, Conditional, Transformer  
- ⚡ **Distributed Execution** – Redis + Bull-powered worker queues  
- 📡 **Live Monitoring** – Real-time execution tracking via WebSockets  
- 🐳 **Production Ready** – Dockerized, cloud-native, CI/CD pipeline ready  
- 🔒 **Security First** – JWT auth, rate limiting, sanitization, headers  
- 📈 **Horizontal Scaling** – Redis-backed scaling for high throughput  
- 🍏 **Apple Silicon Optimized** – Native performance on M1/M2  

---

## 📊 Architecture Overview

```mermaid
graph TB
   A[React Frontend] -->|REST API| B[Node.js Backend]
   A -->|WebSocket| B
   B --> C[Redis Queue]
   B --> D[PostgreSQL]
   C --> E[Worker Processes]
   E --> F[Python Executor]
   B --> G[Monitoring & Metrics]
````

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

```bash
git clone https://github.com/yourusername/workflow-engine.git
cd workflow-engine

docker-compose up -d
open http://localhost:3000
```

### Option 2: Manual Setup

```bash
# Prerequisites
brew install node@20 python@3.11 redis postgresql

# Backend setup
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# Redis
redis-server

# Open App
open http://localhost:5173
```

---

## 🛠️ Development

### Project Structure

```
workflow-engine/
├── backend/
│   ├── src/
│   │   ├── api/          # REST API routes
│   │   ├── config/       # Configuration management
│   │   ├── core/         # Workflow engine core
│   │   ├── db/           # DB models & migrations
│   │   ├── middleware/   # Express middleware
│   │   ├── nodes/        # Node implementations
│   │   ├── queue/        # Queue workers
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   └── stores/       # State management
│   └── package.json
├── python-executor/      # Python script runner
└── docker-compose.yml
```

### Available Scripts

#### Backend

```bash
npm run dev       # Start dev server
npm run test      # Run tests
npm run lint      # Run linter
npm run migrate   # Database migrations
npm run build     # Build for production
npm start         # Start production
```

#### Frontend

```bash
npm run dev       # Dev server
npm run build     # Build production
npm run preview   # Preview build
```

---

## ⚙️ Configuration

### Environment Variables

`.env` for backend:

```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://user:pass@localhost:5432/workflow_engine

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your-secret-key
BCRYPT_ROUNDS=10

RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

---

## 📦 Node Types

* **HTTP Node** – API requests
* **Database Node** – SQL queries
* **Python Node** – Execute sandboxed Python
* **Conditional Node** – Branch logic
* **Transformer Node** – Data manipulation

---

## 🔒 Security

* ✅ JWT-based authentication
* ✅ Per-IP rate limiting
* ✅ Input sanitization
* ✅ Configurable CORS
* ✅ Helmet security headers
* ✅ Secrets managed via env
* ✅ Audit & activity logging

---

## 📈 Performance

* 🚀 1000+ concurrent workflows
* ⏱ Sub-100ms execution latency
* 🧩 Redis-backed horizontal scaling
* 🔄 Automatic retries + exponential backoff
* 💾 Streaming for large datasets

---

## 🧪 Testing

```bash
npm test
npm run test:coverage
npm test -- --testPathPattern=workflow
npm run test:watch
```

---

## 📊 Monitoring & Observability

* Endpoints: `/health`, `/ready`, `/metrics`
* Logging: Pino (pretty dev, JSON prod)
* Metrics: Workflow timings, node stats, queue depth, API latency

---

## 🚢 Deployment

### Docker

```bash
docker build -t workflow-engine .
docker run -d -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_HOST=redis \
  workflow-engine
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-engine
spec:
  replicas: 3
  selector:
    matchLabels:
      app: workflow-engine
  template:
    metadata:
      labels:
        app: workflow-engine
    spec:
      containers:
      - name: workflow-engine
        image: workflow-engine:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
```

---

## 🤝 Contributing

1. Fork
2. Branch: `feature/awesome`
3. Commit: `feat: add awesome`
4. Push & PR

**Guidelines:**

* Add tests
* Follow ESLint
* Update docs
* Use JSDoc
* Conventional commits

---

## 📄 API Overview

### Auth

```http
POST /api/auth/login
```

### Workflows

```http
POST /api/workflows
POST /api/workflows/:id/execute
GET /api/executions/:id
```

### WebSockets

```javascript
ws://localhost:3001

{ "type": "subscribe", "channel": "execution:123" }
{ "type": "node:completed", "nodeId": "abc", "result": {...} }
```

---

## 🐛 Troubleshooting

* **Port in use** → `lsof -i :3001 && kill -9 <PID>`
* **Redis fail** → `redis-server`
* **Migrations fail** → `npm run migrate:rollback && npm run migrate`

Debug:

```bash
DEBUG=* npm run dev
DEBUG=knex:query npm run dev
```

---

## 📚 Resources

* Documentation
* API Reference
* Examples
* Changelog

---

## 📝 License

MIT – see [LICENSE](./LICENSE)

---

## 🙏 Acknowledgments

* React Flow
* BullMQ
* Redis
* PostgreSQL
* OSS Community

---

## 💬 Support

* GitHub Issues
* Discussions
* Discord Community

---

🔥 **Production-grade automation, built to scale.**

