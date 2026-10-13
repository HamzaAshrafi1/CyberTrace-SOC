import os
import time
import uuid
import json
import logging
import requests
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from app.schemas import IngestRequest, IngestResponse
from app.services.threat_service import process_threat_log
from app.services.rag_service import query_rag_hybrid, index_document_in_chroma
from app.database import get_db_connection
from app.realtime import router as realtime_router, event_publisher
from app.services.hunt_engine import execute_aql_hunt
from app.services.simulation_engine import run_attack_simulation, get_simulation_runs, ATTACK_CATALOG
import asyncio

load_dotenv()
load_dotenv(dotenv_path="../.env")

# Configure Structured Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aegis-microservice")

# Custom JSON formatter for logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name,
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

# Setup JSON logging for production
for handler in logging.root.handlers:
    handler.setFormatter(JSONFormatter())

app = FastAPI(
    title="Aegis SOC Analytics Microservice",
    description="Python microservice parsing security logs, running threat rule heuristics, and conducting AI-powered RAG operations via LangChain and ChromaDB.",
    version="1.0.0"
)

# CORS Security Hardening
cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000"]  # Default local Next.js client

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# OpenRouter Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Register Real-Time SSE Router
app.include_router(realtime_router, prefix="/api/v1/realtime", tags=["Realtime"])

# Structured Security Log Helper
def write_security_log_py(event_type: str, details: dict, ip_address: str = None, org_id: str = None):
    # 1. Persist to PostgreSQL database SecurityLog table
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                'INSERT INTO "SecurityLog" (id, "organizationId", "eventType", details, "createdAt", "ipAddress") '
                'VALUES (%s, %s, %s, %s, NOW(), %s)',
                (str(uuid.uuid4()), org_id, event_type, json.dumps(details), ip_address)
            )
            conn.commit()
            conn.close()
    except Exception as e:
        logger.error(f"Failed to write security log to PostgreSQL: {str(e)}")

    # 2. Append to secure logs/security.log file
    try:
        logs_dir = os.path.join(os.getcwd(), "logs")
        os.makedirs(logs_dir, exist_ok=True)
        log_file = os.path.join(logs_dir, "security.log")
        log_payload = {
            "timestamp": datetime.now().isoformat(),
            "ipAddress": ip_address,
            "eventType": event_type,
            "details": details,
            "organizationId": org_id
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_payload) + "\n")
    except Exception as e:
        logger.error(f"Failed to write security log to file: {str(e)}")

    # 3. Publish real-time event
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(event_publisher.publish("security_log", {
                "eventType": event_type,
                "details": details,
                "ipAddress": ip_address,
                "organizationId": org_id,
                "createdAt": datetime.now().isoformat()
            }))
        else:
            asyncio.run(event_publisher.publish("security_log", {
                "eventType": event_type,
                "details": details,
                "ipAddress": ip_address,
                "organizationId": org_id,
                "createdAt": datetime.now().isoformat()
            }))
    except Exception as e:
        logger.error(f"Failed to publish realtime security log event: {str(e)}")

# Authenticate every non-ingestion operation before it reaches a handler.
# Ingestion uses its own source API key; health checks contain no tenant data.
@app.middleware("http")
async def service_authentication(request: Request, call_next):
    from app.service_auth import verify_context, assert_tenant
    path = request.url.path
    if path.startswith("/api/v1/") and path not in {"/api/v1/ingest", "/api/v1/flows/ingest"}:
        try:
            claims = verify_context(request.headers.get("x-aegis-context"),
                                    request.headers.get("x-aegis-signature"), path)
            request.state.service_context = claims
            tenant = request.query_params.get("organization_id")
            if request.method == "POST":
                raw_body = await request.body()
                if len(raw_body) > 8 * 1024 * 1024:
                    raise ValueError("Request too large")
                body = json.loads(raw_body)
                if not isinstance(body, dict):
                    raise ValueError("Invalid request object")
                tenant = body.get("organization_id", tenant)
                if path == "/api/v1/realtime/publish":
                    data = body.get("data", {})
                    if not isinstance(data, dict):
                        raise ValueError("Invalid event object")
                    tenant = data.get("organizationId")
                    if not tenant:
                        raise ValueError("Missing tenant")
            if tenant is not None:
                assert_tenant(claims, tenant)
        except (ValueError, TypeError):
            return Response(content=json.dumps({"detail": "Unauthorized service request"}),
                            status_code=403, media_type="application/json")
    return await call_next(request)

# Rate Limiting Middleware
class PythonRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int = 150, window: int = 60):
        super().__init__(app)
        self.limit = limit
        self.window = window
        self.cache = {}

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/health") or request.url.path.startswith("/metrics"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()

        # Clean expired keys
        self.cache = {ip: data for ip, data in self.cache.items() if now < data["reset_time"]}

        if client_ip not in self.cache:
            self.cache[client_ip] = {"count": 1, "reset_time": now + self.window}
        else:
            data = self.cache[client_ip]
            if data["count"] >= self.limit:
                # Log security rate limit violation
                write_security_log_py(
                    event_type="rate_limit",
                    details={"path": request.url.path, "limit": self.limit},
                    ip_address=client_ip
                )
                return Response(
                    content=json.dumps({"detail": "Rate limit exceeded. Too many requests."}),
                    status_code=429,
                    media_type="application/json"
                )
            data["count"] += 1

        return await call_next(request)

app.add_middleware(PythonRateLimitMiddleware, limit=150, window=60)

# Exception Tracking Hook
@app.middleware("http")
async def error_tracking_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        logger.error(f"Unhandled HTTP Exception: {str(exc)}", exc_info=True)
        # Log suspicious / unhandled system crashes
        write_security_log_py(
            event_type="suspicious",
            details={"path": request.url.path, "error": str(exc), "reason": "Unhandled System Error"},
            ip_address=request.client.host if request.client else None
        )
        return Response(
            content=json.dumps({"detail": "Internal Server Error"}),
            status_code=500,
            media_type="application/json"
        )

# Pydantic validation schemas
class IncidentSummaryRequest(BaseModel):
    incident_id: str
    category: str
    description: str
    threat_count: int

class ChatQueryRequest(BaseModel):
    query: str
    organization_id: str
    history: Optional[List[Dict[str, str]]] = Field(default_factory=list)

class DocumentUploadRequest(BaseModel):
    organization_id: str
    document_id: str
    file_name: str
    file_type: str
    base64_data: str = Field(max_length=7 * 1024 * 1024)

# Ingestion endpoint
@app.post("/api/v1/ingest", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_log(
    payload: IngestRequest,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    # Extract API key
    api_key = None
    if authorization:
        if authorization.lower().startswith("bearer "):
            api_key = authorization[7:].strip()
        else:
            api_key = authorization.strip()
    
    if not api_key:
        api_key = payload.apiKey

    client_ip = request.client.host if request.client else "127.0.0.1"

    # API key integrity verification
    if not api_key:
        write_security_log_py(
            event_type="Missing API Key",
            details={"apiKey": None, "source": payload.source, "reason": "Missing API key in request"},
            ip_address=client_ip
        )
        write_security_log_py(
            event_type="Rejected Ingestion Request",
            details={"apiKey": None, "source": payload.source, "reason": "Missing API key"},
            ip_address=client_ip
        )
        raise HTTPException(status_code=401, detail="Unauthorized: Missing or invalid log source API key.")

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute('SELECT 1 FROM "LogSource" WHERE "apiKey" = %s LIMIT 1', (api_key,))
            row = cursor.fetchone()
            if not row:
                # Log invalid API key security event
                write_security_log_py(
                    event_type="Invalid API Key",
                    details={"apiKeyPresent": bool(api_key), "source": payload.source, "reason": "Invalid API key"},
                    ip_address=client_ip
                )
                write_security_log_py(
                    event_type="Rejected Ingestion Request",
                    details={"apiKeyPresent": bool(api_key), "source": payload.source, "reason": "Invalid API key"},
                    ip_address=client_ip
                )
                raise HTTPException(status_code=401, detail="Unauthorized: Invalid log source API key.")
        conn.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("API key lookup database unavailable")
        raise HTTPException(status_code=503, detail="Ingestion database unavailable")

    try:
        result = process_threat_log(
            source=payload.source,
            ip=payload.ip,
            message=payload.message,
            api_key=api_key,
            source_event_id=payload.eventId,
            event_time=payload.eventTime,
            is_simulated=payload.isSimulated,
        )
        return IngestResponse(
            detected=result["detected"],
            attack_type=result["attack_type"],
            severity=result["severity"],
            incident_created=result["incident_created"],
            trace_id=result.get("trace_id"),
            event_id=result.get("event_id"),
            duplicate=result.get("duplicate", False)
        )
    except ValueError as ve:
        logger.warning(f"Log Ingestion validation failure: {str(ve)}")
        write_security_log_py(
            event_type="Rejected Ingestion Request",
            details={"apiKeyPresent": bool(api_key), "source": payload.source, "reason": str(ve)},
            ip_address=client_ip
        )
        raise HTTPException(status_code=409 if "Event ID already used" in str(ve) else 401, detail=str(ve))
    except Exception as e:
        logger.error(f"Log Ingestion process failure: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process ingestion: {str(e)}")

# AI Threat Summarizer endpoint
@app.post("/api/v1/summarize", tags=["AI Operations"])
async def summarize_incident(request: IncidentSummaryRequest):
    if not OPENROUTER_API_KEY:
        return {
            "summary": f"### Heuristic Security Advisory: {request.incident_id}\n\nWarning: SQL signature validation active. Aggregate alerts count: {request.threat_count}.",
            "provider": "local_heuristics"
        }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis-soc.com",
        "X-Title": "Aegis SOC SaaS"
    }

    prompt = f"""
    You are an expert Cybersecurity Incident Response Officer. Analyze this security alert and write a brief threat summary report:
    
    Incident ID: {request.incident_id}
    Incident Category: {request.category}
    Operational Description: {request.description}
    Alarms Count: {request.threat_count}
    
    Generate your report strictly in Markdown, containing these sections:
    1. Executive Summary (2 sentences)
    2. Root Cause Diagnostics
    3. Remediation Actions (Numbered lists)
    """

    payload = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=12)
        response_json = response.json()
        summary = response_json["choices"][0]["message"]["content"]
        return {
            "summary": summary,
            "provider": "openrouter_llama3"
        }
    except Exception as e:
        logger.error(f"Failed to fetch AI summary from OpenRouter: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch AI summary from OpenRouter: {str(e)}")

# RAG chat
@app.post("/api/v1/chat", tags=["AI Operations"])
async def query_rag_chat(request: ChatQueryRequest):
    try:
        result = query_rag_hybrid(
            organization_id=request.organization_id,
            query=request.query,
            history=request.history or []
        )
        return result
    except Exception as e:
        logger.error(f"RAG query execution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

# Document upload
@app.post("/api/v1/document/upload", tags=["AI Operations"])
async def upload_document(request: DocumentUploadRequest):
    try:
        result = index_document_in_chroma(
            organization_id=request.organization_id,
            document_id=request.document_id,
            file_name=request.file_name,
            file_type=request.file_type,
            base64_data=request.base64_data
        )
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        logger.error(f"Document upload indexing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document upload processing failed: {str(e)}")

# Utilities / Healthchecks
@app.get("/health/live", tags=["Utilities"])
def health_live():
    return {"status": "live", "timestamp": datetime.utcnow().isoformat() + "Z"}

@app.get("/health/ready", tags=["Utilities"])
def health_ready(response: Response):
    db_status = "disconnected"
    chroma_status = "disconnected"
    ai_status = "unconfigured"
    
    is_ready = True
    
    # 1. Database Connection check
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"failed: {str(e)}"
        is_ready = False

    # 2. ChromaDB Heartbeat check
    try:
        from app.services.vector_provider import ChromaDBProvider
        provider = ChromaDBProvider()
        hb = provider.client.heartbeat()
        if hb is not None:
            chroma_status = "connected"
        else:
            chroma_status = "failed: heartbeat returned None"
            is_ready = False
    except Exception as e:
        chroma_status = f"failed: {str(e)}"
        is_ready = False

    # 3. AI provider Configuration check
    if os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY"):
        ai_status = "configured"
    else:
        ai_status = "unconfigured"
        is_ready = False

    if not is_ready:
        response.status_code = 503

    return {
        "status": "ready" if is_ready else "unready",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "database": db_status,
        "chromadb": chroma_status,
        "ai_provider": ai_status
    }

# --- Threat Hunting Endpoints ---
class HuntSearchRequest(BaseModel):
    organization_id: str
    query: str
    sources: Optional[List[str]] = None
    limit: Optional[int] = 50
    offset: Optional[int] = 0

class AIHuntRequest(BaseModel):
    organization_id: str
    query: str

@app.post("/api/v1/hunt/search", tags=["Threat Hunting"])
async def run_hunt_search(request: HuntSearchRequest):
    try:
        results, total = execute_aql_hunt(
            organization_id=request.organization_id,
            query_str=request.query,
            sources=request.sources,
            limit=request.limit or 50,
            offset=request.offset or 0
        )
        return {"results": results, "total": total}
    except Exception as e:
        logger.error(f"AQL search route failure: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/hunt/ai", tags=["Threat Hunting"])
async def translate_ai_hunt(request: AIHuntRequest):
    nl_query = request.query
    
    if not OPENROUTER_API_KEY:
        query_lower = nl_query.lower()
        if "brute force" in query_lower:
            return {
                "query": "attack:BRUTE_FORCE AND date:last7days",
                "explanation": "Searches for brute force attacks from the last 7 days."
            }
        elif "critical" in query_lower:
            return {
                "query": "severity:CRITICAL AND status:open",
                "explanation": "Searches for unresolved critical threats/incidents."
            }
        elif "ip" in query_lower:
            return {
                "query": "severity:HIGH OR severity:CRITICAL",
                "explanation": "Searches for high and critical events to identify top IPs."
            }
        else:
            return {
                "query": "severity:HIGH OR severity:CRITICAL",
                "explanation": "Searches for high and critical events (Fallback)."
            }
            
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis-soc.com",
        "X-Title": "Aegis SOC SaaS"
    }
    
    system_prompt = """You are the Aegis SOC AI Threat Hunter Assistant.
Translate the user's natural language request into a valid Aegis Query Language (AQL) search query.

AQL syntax supports fields:
- severity: (e.g. CRITICAL, HIGH, MEDIUM, LOW)
- sourceIp: (e.g. 192.168.1.10)
- attack: (e.g. SQL_INJECTION, BRUTE_FORCE, XSS, etc.)
- status: (e.g. open, resolved, investigating)
- mitre: (e.g. T1190)
- country: (e.g. India, Russia, China, USA)
- date: (e.g. last24hours, last7days, last30days)
- ioc: (e.g. malicious, suspicious, clean)

Logical operators:
- AND
- OR
- NOT
- Parentheses ()

Examples:
- "Show brute force attacks from last week" -> attack:BRUTE_FORCE AND date:last7days
- "Find unresolved critical incidents" -> severity:CRITICAL AND status:open
- "Search for traffic from Russia or China" -> country:Russia OR country:China

Return ONLY a JSON object with keys "query" and "explanation". Do not wrap in markdown or add extra text.
"""
    
    payload = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": nl_query}
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=8.0)
        res_json = response.json()
        content = res_json["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        logger.warning(f"Failed to fetch AI hunt query translation: {e}")
        query_lower = nl_query.lower()
        if "brute force" in query_lower:
            return {
                "query": "attack:BRUTE_FORCE AND date:last7days",
                "explanation": "Searches for brute force attacks from the last 7 days."
            }
        else:
            return {
                "query": "severity:HIGH OR severity:CRITICAL",
                "explanation": "Searches for high and critical events (Fallback)."
            }

# --- Attack Simulation Lab Endpoints ---
class SimulateRequest(BaseModel):
    organization_id: str
    attack_type: str

class AILogRequest(BaseModel):
    prompt: str

@app.post("/api/v1/lab/simulate", tags=["Attack Simulation Lab"])
async def trigger_simulation(request: SimulateRequest):
    try:
        run_data = run_attack_simulation(request.organization_id, request.attack_type)
        return run_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Simulation trigger failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/lab/runs", tags=["Attack Simulation Lab"])
async def list_simulation_runs(organization_id: str, limit: int = 50):
    try:
        runs = get_simulation_runs(organization_id, limit)
        return {"runs": runs}
    except Exception as e:
        logger.error(f"Failed to list simulation runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/lab/ai-generate", tags=["Attack Simulation Lab"])
async def generate_ai_attack_logs(request: AILogRequest):
    prompt = request.prompt
    
    if not OPENROUTER_API_KEY:
        # Fallback to local heuristic logs
        prompt_lower = prompt.lower()
        if "sql" in prompt_lower:
            return {"logs": ["198.51.100.15 - [SIMULATED SQLi] payload: ' OR 1=1 --"]}
        elif "brute" in prompt_lower:
            return {"logs": ["203.0.113.111 - [SIMULATED BRUTE FORCE] failed login attempt for admin"]}
        elif "ddos" in prompt_lower:
            return {"logs": ["185.220.101.4 - [SIMULATED DDoS] volumetric request rate spike 12000 req/sec"]}
        else:
            return {"logs": ["192.168.1.50 - [SIMULATED TELEMETRY] anomalous traffic pattern detected"]}
            
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis-soc.com",
        "X-Title": "Aegis SOC SaaS"
    }
    
    system_prompt = """You are an offensive security log generator.
Generate a realistic raw text log or a list of logs simulating the requested attack vector (e.g. SQL Injection, XSS, DDoS, Privilege Escalation).
Return ONLY the raw logs as a JSON array of strings in a key named "logs". Do not include any explanations or markdown formatting outside the JSON structure.
Format:
{
  "logs": [
    "log line 1",
    "log line 2"
  ]
}
"""
    
    payload = {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=10.0)
        res_json = response.json()
        content = res_json["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        logger.warning(f"AI attack log generation failed: {e}")
        return {"logs": [f"Simulated attack log: {prompt} (Fallback)"]}

# Flow collection is separate from regex log detection. No clean/threat verdict
# is emitted until an explicitly compatible model or flow rule runs.
class FlowIngestRequest(BaseModel):
    raw_record: str = Field(min_length=1, max_length=65536)
    capture_id: str = Field(min_length=1, max_length=200)
    is_simulated: bool = False

@app.post("/api/v1/flows/ingest", tags=["Flow Collection"])
def collect_flow(payload: FlowIngestRequest, authorization: Optional[str] = Header(None)):
    from app.services.flow_service import ingest_flow, FlowUnauthorized, FlowConflict
    api_key = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None
    try:
        return ingest_flow(payload.raw_record, payload.capture_id, api_key, payload.is_simulated)
    except FlowUnauthorized:
        raise HTTPException(status_code=401, detail="Invalid source credentials")
    except FlowConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.exception("Flow collection failed")
        raise HTTPException(status_code=503, detail="Flow storage unavailable")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

