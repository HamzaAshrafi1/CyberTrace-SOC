import os
import base64
import io
import time
import json
import uuid
from typing import List, Dict, Any

from app.database import get_db_connection
from app.services.vector_provider import ChromaDBProvider

# Dynamic imports with fallbacks to avoid import crashes if pip install is still running
try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.embeddings import Embeddings

# 1. Embeddings interface implementation
def get_embeddings_model():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("Real embeddings unavailable: configure OPENAI_API_KEY and reindex documents")
    from langchain_openai import OpenAIEmbeddings
    return OpenAIEmbeddings(openai_api_key=key, model="text-embedding-3-small")


# Initialize vector provider
from functools import lru_cache

@lru_cache(maxsize=1)
def get_vector_provider():
    return ChromaDBProvider()

# 2. Document extraction functions
def extract_text_from_txt(content_bytes: bytes) -> List[Dict[str, Any]]:
    text = content_bytes.decode("utf-8", errors="ignore")
    return [{"text": text, "page": 1}]

def extract_text_from_pdf(content_bytes: bytes) -> List[Dict[str, Any]]:
    if not pypdf:
        raise ImportError("pypdf is not installed. PDF parsing unavailable.")
    
    pdf_file = io.BytesIO(content_bytes)
    reader = pypdf.PdfReader(pdf_file)
    pages = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append({"text": text, "page": idx + 1})
    return pages

def extract_text_from_docx(content_bytes: bytes) -> List[Dict[str, Any]]:
    if not docx:
        raise ImportError("python-docx is not installed. DOCX parsing unavailable.")
    
    docx_file = io.BytesIO(content_bytes)
    doc = docx.Document(docx_file)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    text = "\n".join(full_text)
    return [{"text": text, "page": 1}]


# 3. Vector database indexing pipeline
def index_document_in_chroma(
    organization_id: str, 
    document_id: str, 
    file_name: str, 
    file_type: str, 
    base64_data: str
) -> Dict[str, Any]:
    file_bytes = base64.b64decode(base64_data, validate=True)
    if len(file_bytes) > 5 * 1024 * 1024:
        raise ValueError("Document exceeds 5 MiB limit")
    
    # Extract
    if file_type.lower() == "pdf":
        pages = extract_text_from_pdf(file_bytes)
    elif file_type.lower() in ("docx", "doc"):
        pages = extract_text_from_docx(file_bytes)
    else:  # txt / default
        pages = extract_text_from_txt(file_bytes)

    # Chunk
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    
    chunk_ids = []
    texts = []
    metadatas = []
    
    for page_data in pages:
        page_text = page_data["text"]
        page_num = page_data["page"]
        
        chunks = splitter.split_text(page_text)
        for chunk_idx, chunk in enumerate(chunks):
            chunk_ids.append(f"{document_id}_p{page_num}_c{chunk_idx}")
            texts.append(chunk)
            metadatas.append({
                "page_number": page_num,
                "snippet": chunk
            })

    if not texts:
        return {"status": "error", "message": "No text extracted from document."}

    # Embed
    embedder = get_embeddings_model()
    embeddings = embedder.embed_documents(texts)

    # Index
    get_vector_provider().index_document_chunks(
        organization_id=organization_id,
        document_id=document_id,
        document_name=file_name,
        chunk_ids=chunk_ids,
        texts=texts,
        metadatas=metadatas,
        embeddings=embeddings
    )

    return {
        "status": "success",
        "chunks_count": len(texts),
        "pages_count": len(pages)
    }


# 4. Hybrid platform query resolver
def get_platform_context(organization_id: str) -> str:
    """
    Fetch tenant-isolated database operational statistics to inject into the LLM context.
    """
    conn = get_db_connection()
    context_parts = []
    try:
        with conn.cursor() as cursor:
            # A. Fetch active incidents (unresolved)
            cursor.execute(
                'SELECT title, severity, status, "assignedTo" FROM "Incident" WHERE "organizationId" = %s AND status != \'resolved\' ORDER BY "createdAt" DESC LIMIT 5',
                (organization_id,)
            )
            incidents = cursor.fetchall()
            if incidents:
                context_parts.append("### Active / Unresolved Incident Tickets:")
                for inc in incidents:
                    context_parts.append(f"- Incident: {inc[0]} (Severity: {inc[1]}, Status: {inc[2]}, Assigned to: {inc[3]})")
            else:
                context_parts.append("### Active / Unresolved Incident Tickets: None found.")

            # B. Fetch recent threat events count & highlights
            cursor.execute(
                'SELECT severity, COUNT(*) FROM "ThreatEvent" WHERE "organizationId" = %s GROUP BY severity',
                (organization_id,)
            )
            threats = cursor.fetchall()
            if threats:
                context_parts.append("### Ingested Threat Event Stats (Total by Severity):")
                for th in threats:
                    context_parts.append(f"- Severity {th[0]}: {th[1]} events")
            else:
                context_parts.append("### Ingested Threat Event Stats: No threat events ingested yet.")

            # C. Fetch compliance checklist score highlights
            cursor.execute(
                'SELECT framework, score, status FROM "ComplianceCheck" WHERE "organizationId" = %s ORDER BY "createdAt" DESC LIMIT 5',
                (organization_id,)
            )
            checks = cursor.fetchall()
            if checks:
                context_parts.append("### Compliance Audit Checklist Scoring:")
                for ch in checks:
                    context_parts.append(f"- Framework {ch[0]}: Score {ch[1]}% ({ch[2].upper()})")
            else:
                context_parts.append("### Compliance Audit Checklist Scoring: No compliance audits executed yet.")
    except Exception as e:
        context_parts.append(f"Error fetching database context metrics: {str(e)}")
    finally:
        conn.close()

    return "\n".join(context_parts)


# 5. RAG query processor with diagnostics & heuristics fallback
def query_rag_hybrid(
    organization_id: str, 
    query: str, 
    history: List[Dict[str, str]]
) -> Dict[str, Any]:
    start_time = time.time()
    
    # Embedding query
    embedder = get_embeddings_model()
    query_embedding = embedder.embed_query(query)

    # Retrieval from vector database (Top 5 chunks)
    chunks = get_vector_provider().query_similar_chunks(
        organization_id=organization_id,
        query_embedding=query_embedding,
        limit=5
    )
    
    latency_ms = int((time.time() - start_time) * 1000)

    # Compile Citations and unique documents
    sources = []
    unique_doc_ids = set()
    for chunk in chunks:
        doc_name = chunk["metadata"].get("document_name", "Unknown Document")
        page_num = chunk["metadata"].get("page_number", 1)
        snippet = chunk["metadata"].get("snippet", chunk["text"])
        doc_id = chunk["metadata"].get("document_id")
        
        if doc_id:
            unique_doc_ids.add(doc_id)
            
        sources.append({
            "document_name": doc_name,
            "page_number": int(page_num),
            "snippet": snippet
        })

    diagnostics = {
        "mode": "real_embeddings",
        "retrievedChunks": len(chunks),
        "latencyMs": latency_ms,
        "sourceDocsCount": len(unique_doc_ids)
    }

    # Fetch live PostgreSQL context (Hybrid RAG)
    platform_context = get_platform_context(organization_id)

    # OpenRouter API prompt synthesis
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
    
    if openrouter_api_key:
        import requests
        
        # Prepare context blocks
        docs_context = "\n\n".join([
            f"--- Reference Document: {s['document_name']} (Page {s['page_number']}) ---\n{s['snippet']}" 
            for s in sources
        ])
        
        # Format conversation history
        history_str = ""
        for msg in history:
            role = "Analyst" if msg["role"] == "user" else "Advisor"
            history_str += f"{role}: {msg['content']}\n"

        system_prompt = f"""You are Aegis SOC AI, an agentic security chatbot. 
Your goal is to answer the user security query utilizing the provided reference document context and real-time security operations database logs.

=== REAL-TIME SOC OPERATIONS DATA ===
{platform_context}

=== RETRIEVED DOCUMENT CONTEXTS ===
{docs_context}
"""

        user_content = f"""Here is the conversation history:
{history_str}

User Query: {query}
Answer the user's query clearly, referencing the operational data and retrieved documents where appropriate. Include markdown formatting.
"""

        headers = {
            "Authorization": f"Bearer {openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aegis-soc.com",
            "X-Title": "Aegis SOC Chatbot"
        }
        
        payload = {
            "model": "meta-llama/llama-3.1-8b-instruct:free",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]
        }
        
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=12
            )
            response.raise_for_status()
            res_json = response.json()
            answer = res_json["choices"][0]["message"]["content"]
            return {
                "response": answer,
                "sources": sources,
                "diagnostics": diagnostics
            }
        except Exception as e:
            # Fallback to local heuristic parsing if API call fails
            pass

    # Heuristic Fallback Response (when API keys are missing or OpenRouter fails)
    query_lower = query.lower()
    
    if "incident" in query_lower:
        # Check active incident list from database
        if "### Active / Unresolved Incident Tickets:" in platform_context:
            tickets_block = platform_context.split("### Active / Unresolved Incident Tickets:")[1].split("###")[0].strip()
            answer = f"### Live SOC Incident Triage Summary\n\nI queried the live PostgreSQL database for unresolved security tickets in this organization. Here are the active incidents:\n\n{tickets_block}\n\n*Remediation recommendation: Check the Incident Hub panel to assign operator triages.*"
        else:
            answer = "### Live SOC Incident Triage Summary\n\nCurrently, there are no active/unresolved incidents registered in the PostgreSQL database for this B2B tenant."
            
    elif "threat" in query_lower or "sql" in query_lower or "xss" in query_lower or "brute force" in query_lower:
        if "### Ingested Threat Event Stats" in platform_context:
            threats_block = platform_context.split("### Ingested Threat Event Stats")[1].split("###")[0].strip()
            answer = f"### Threat Analytics Overview\n\nI completed a database audit scan of organization threat telemetry logs. Here is the severity distribution:\n\n{threats_block}\n\n*Heuristic Advisory: If critical severity events are active, ensure they are linked to an active incident queue.*"
        else:
            answer = "### Threat Analytics Overview\n\nNo threat logs were found in the PostgreSQL databases. Ensure your application and firewalls push logs to the SOC Log Ingestion workstation."
            
    elif "compliance" in query_lower or "gap" in query_lower or "iso" in query_lower or "soc2" in query_lower or "gdpr" in query_lower:
        if "### Compliance Audit Checklist" in platform_context:
            compliance_block = platform_context.split("### Compliance Audit Checklist")[1].split("###")[0].strip()
            answer = f"### Compliance Diagnostic Report\n\nI queried your recent framework audit check runs. Here is your compliance rating breakdown:\n\n{compliance_block}\n\n*Audit Advisory: Go to the Compliance Posture Workspace panel to recheck warnings or deficiencies.*"
        else:
            answer = "### Compliance Diagnostic Report\n\nNo compliance check history has been registered yet. Go to the Compliance Posture Workspace to select target frameworks and run a live audit."
            
    elif "executive" in query_lower or "summary" in query_lower:
        answer = f"### Aegis Executive Security Summary\n\nBased on a hybrid RAG query combining PostgreSQL operational data and vector chunks:\n\n1. **Operations Status:** Unassigned incident tickets are listed under Incidents Hub.\n2. **Compliance Rating:** Audit ratings are updated in Compliance Posture.\n3. **Knowledge Base:** I retrieved {len(chunks)} relevant document vector slices to augment this advice."
        
    elif len(chunks) > 0:
        # Match from uploaded text chunks
        top_snippet = chunks[0]["text"]
        answer = f"### Retrieved Knowledge Base Advisory\n\nI extracted this relevant paragraph matching your query from your uploaded compliance policies:\n\n> \"{top_snippet}\"\n\n*Aegis AI recommendations have been customized according to the document text retrieved from the vector store.*"
    else:
        answer = f"### Aegis Security Bot Assistance\n\nGreetings! I am the Aegis AI Threat Advisor. I did not find any matching reference documents in ChromaDB or specific indicators for your query: \"{query}\".\n\nTry asking about:\n- *\"What critical incidents are currently active?\"*\n- *\"Are there any compliance gaps?\"*\n- *\"Provide an executive security summary.\"*"

    return {
        "response": answer,
        "sources": sources,
        "diagnostics": diagnostics
    }
