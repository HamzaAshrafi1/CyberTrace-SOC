# Aegis SOC Deployment & Operations Handbook

This handbook provides instructions for local development, Dockerized staging, production cloud deployments, structured backups, point-in-time disaster recovery, and environment restorations.

---

## 1. System Architecture Blueprint

Below is the conceptual cloud architecture for Aegis SOC:

```mermaid
graph TD
    User([Security Operator / CISO]) -->|HTTPS| ALB[AWS Application Load Balancer]
    ALB -->|Route / | ECS_Next[ECS Next.js Container]
    ALB -->|Route /api/v1/*| ECS_Python[ECS FastAPI Service]
    
    subgraph "Docker VPC Container Network"
        ECS_Next -->|Proxy /api/v1/health/ready| ECS_Python
        ECS_Next -->|Session Sync Cache| Redis[(AWS ElastiCache Redis)]
    end

    subgraph "Database & Storage Layer"
        ECS_Python -->|Vector Sync / HTTP| Chroma[(ChromaDB Standalone Node)]
        ECS_Python -->|Write SecurityEvent / Telemetry| Neon[(Neon PostgreSQL - Multi-Tenant DB)]
        ECS_Next -->|Write User Roles / Audits| Neon
        ECS_Python -->|S3 Upload Files| S3[(Amazon S3 Bucket)]
    end

    subgraph "External Providers"
        ECS_Next -->|Auth SSO API| Clerk[Clerk Auth Gateway]
        ECS_Python -->|LLM API completions| OpenRouter[OpenRouter AI Gateway]
    end
```

---

## 2. Environment Variables Reference

Configure these parameters in `.env` (or via container orchestrators):

| Parameter | Required | Scope | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | App + Python | Connection string targeting Neon PostgreSQL. |
| `REDIS_URL` | No (Prod Yes) | Next.js | Connection string targeting Redis for production rate limiting. |
| `AEGIS_SERVICE_URL` | **Yes** | Next.js | Endpoint targeting the FastAPI microservice. |
| `CHROMA_HOST` | No (Prod Yes)| Python | Host targeting standalone ChromaDB node. If empty, defaults to local file persistence. |
| `CHROMA_PORT` | No | Python | Port targeting standalone ChromaDB. Defaults to `8000`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes** | Next.js | Clerk publishable key. |
| `CLERK_SECRET_KEY` | **Yes** | Next.js | Clerk secret key. |
| `OPENROUTER_API_KEY` | **Yes** | Python | OpenRouter API Key for Llama-3 model summaries. |
| `OPENAI_API_KEY` | No | Python | Optional OpenAI key for generating actual embeddings. |
| `CORS_ORIGINS` | No | Python | Comma-separated CORS allowed origins. Defaults to local Next.js node. |

---

## 3. Local Development Startup

Follow these steps to run the services bare-metal:

### Prerequisites:
- Node.js 18+
- Python 3.10+
- Neon Database URL configured in `.env`

### Frontend Node:
```bash
# Install packages
npm install

# Run migration
npx prisma generate
npx prisma migrate dev

# Start development server
npm run dev
```

### Python Backend Node:
```bash
# Navigate to directory
cd python-service

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate # On Windows
source venv/bin/activate # On Unix/macOS

# Install libraries
pip install -r requirements.txt

# Start backend microservice daemon
python app/main.py
```

---

## 4. Dockerized Local Setup

Run the entire isolated platform locally via Docker Compose:

```bash
# 1. Export required credentials
export DATABASE_URL="postgresql://user:password@endpoint.neon.tech/neondb"
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
export CLERK_SECRET_KEY="sk_test_..."
export OPENROUTER_API_KEY="sk-or-v1-..."

# 2. Build and boot services in detached mode
docker compose up --build -d

# 3. Verify logs
docker compose logs -f nextjs-frontend
docker compose logs -f fastapi-service
```

---

## 5. Production AWS Deployment Guide

Aegis is optimized to run on AWS ECS (Elastic Container Service) with AWS Fargate.

### Container Registries (ECR)
Build, tag, and push Next.js and Python Docker containers to AWS ECR:
```bash
# NextJS image
docker build -t aegis-frontend:latest .
docker tag aegis-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/aegis-frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/aegis-frontend:latest

# FastAPI image
docker build -t aegis-backend:latest ./python-service
docker tag aegis-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/aegis-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/aegis-backend:latest
```

### ECS Fargate Tasks Setup
- Create ECS Task Definitions for frontend (port 3000) and backend (port 8000).
- Mount an AWS EFS volume or use ECS persistent block storage for ChromaDB (`/chroma/data`) if running a separate Chroma container.
- Associate Fargate tasks with an AWS Application Load Balancer (ALB) that routes paths:
  - `/api/health/*` and other routes to Next.js.
  - `/api/v1/ingest` and `/api/v1/chat` to the FastAPI task target group.

---

## 6. Backup, Persistence & Restore Runbooks

### Database Backup Strategy (Neon PostgreSQL)
1. **Automated Backups:** Neon provides automatic daily snapshots of the database with 30-day retention.
2. **Ad-hoc Backups (CLI):** Export schema and database contents via `pg_dump`:
   ```bash
   pg_dump -d $DATABASE_URL -F c -b -v -f aegis_backup_$(date +%F).dump
   ```
3. **Database Branching:** Use Neon's instant branching to create non-disruptive, copy-on-write database branches for testing migrations before running them in production:
   ```bash
   neon branch create --name test-migration-branch --project-id $PROJECT_ID
   ```

### Point-In-Time Database Restoration (Neon PITR)
To restore the production database to a specific time (e.g. before an accidental truncation or breach):
1. Navigate to the Neon Console -> Project -> Branches.
2. Click **Create Branch**.
3. Select **Point in time** as the source.
4. Input the precise UTC time to restore to.
5. Once the branch is generated, switch your environment's `DATABASE_URL` to point to the newly restored branch's connection string.
6. Verify schemas and test connectivity.
7. Switch ALB traffic to the restored stack.

### Vector Persistence Strategy (ChromaDB)
- Standalone Chroma containers mount `/chroma/data` to a persistent block device (EBS/EFS).
- Nightly cron snapshot tasks should tar the directory and push backups to an AWS S3 bucket:
  ```bash
  tar -czf chroma_snapshot_$(date +%F).tar.gz /chroma/data
  aws s3 cp chroma_snapshot_*.tar.gz s3://aegis-soc-backups/vector-snapshots/
  ```
- **ChromaDB Recovery:**
  To restore the vector indexes:
  1. Retrieve the latest tar snapshot from S3.
  2. Extract it into the `/chroma/data` directory mapped to the Chroma container.
  3. Re-launch the Chroma DB docker service.

---

## 7. Disaster Recovery Procedures (SLAs)

Aegis is targeted for:
- **RTO (Recovery Time Objective):** < 30 Minutes
- **RPO (Recovery Point Objective):** < 4 Hours

### In the Event of Region Failover:
1. Spin up the Next.js and FastAPI container tasks in the secondary disaster recovery region (e.g. `us-west-2` if primary is `us-east-1`).
2. Restore Vector Database from the S3 cross-region-replicated snapshot.
3. Repoint Route53 global DNS records to the secondary ALB.
4. Validate that all active organizations onboarding, incident tracking, and chat features operate normally.

---

## 8. Environment Restoration Verification Checklist

Run these diagnostics post-restoration to verify system status:

- [ ] **Next.js Heartbeat:** Query `GET /api/health/live`. Verify HTTP 200 OK.
- [ ] **System Readiness:** Query `GET /api/health/ready`. Verify all items in `checks` JSON (database, backend_service, chromadb, ai_provider) return `"connected"` / `"configured"`.
- [ ] **Security Logs Sync:** Verify that rate limiting, auth blocks, and suspicious query detections are stored in the database `SecurityLog` table and appended to `/logs/security.log`.
- [ ] **ChromaDB Ingestion:** Index a test file via `/api/v1/document/upload` and confirm embedding retrieval operates normally.
