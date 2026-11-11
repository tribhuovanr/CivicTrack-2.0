"""
CivicTrack AI Module — FastAPI Backend
Provides /api/triage and /api/classify endpoints for NLP-based municipal triage
and department classification using Ollama (Gemma4).

Run:  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from ai_module.classifier import classify, triage, DEPARTMENTS
except ImportError:
    from classifier import classify, triage, DEPARTMENTS

app = FastAPI(
    title="CivicTrack AI Triage Module",
    description="NLP-based complaint triage, department classification, hazard assessment, and SLA priority using Ollama (Gemma4)",
    version="2.0.0",
)

# CORS — allow Vite dev server, local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ComplaintAnalysisRequest(BaseModel):
    title: str = Field(default="", description="Complaint title")
    description: str = Field(..., min_length=3, description="Complaint description text")


class TriageResponse(BaseModel):
    department: str = Field(description="Classified department name")
    subType: str = Field(default="civic_issue", description="Issue sub-type")
    hazardLevel: float = Field(default=0.5, description="Hazard severity score between 0.0 and 1.0")
    lifeSafety: bool = Field(default=False, description="Whether immediate life safety risk exists")
    priority: str = Field(default="P3", description="Priority band: P1 (Critical), P2 (High), P3 (Medium), P4 (Low)")
    priorityScore: int = Field(default=50, description="Priority score 0-100")
    slaHours: int = Field(default=72, description="Target SLA resolution hours")
    hazardKeywords: list[str] = Field(default=[], description="Detected risk keywords")
    summary: str = Field(default="", description="One-line objective English summary")
    confidence: float = Field(default=0.8, description="Classification confidence score 0.0-1.0")
    error: str | None = Field(default=None, description="Notice/error message if fallback occurred")


class ClassifyResponse(BaseModel):
    department: str | None = Field(description="Classified department name")
    confidence: float = Field(description="Confidence score 0.0–1.0")
    error: str | None = Field(default=None, description="Error message if classification failed")
    priority: str | None = Field(default="P3")
    hazardLevel: float | None = Field(default=0.5)
    lifeSafety: bool | None = Field(default=False)
    slaHours: int | None = Field(default=72)
    subType: str | None = Field(default="civic_issue")
    summary: str | None = Field(default="")


@app.post("/api/triage", response_model=TriageResponse)
async def triage_complaint(req: ComplaintAnalysisRequest):
    """
    Full AI Triage analysis on a complaint:
    Determines Department, SubType, Hazard Level, Life Safety, Priority Band, SLA, and Summary.
    """
    result = await triage(req.title, req.description)
    return TriageResponse(**result)


@app.post("/api/classify", response_model=ClassifyResponse)
async def classify_complaint(req: ComplaintAnalysisRequest):
    """
    Classify a complaint description into a municipal department using Ollama/Gemma4.
    """
    result = await classify(req.title, req.description)
    return ClassifyResponse(**result)


@app.get("/api/departments")
async def list_departments():
    """Return the list of valid departments (for frontend sync)."""
    return {"departments": DEPARTMENTS}


@app.get("/api/health")
async def health():
    """Health check — verifies service and Ollama connectivity."""
    import httpx

    ollama_status = "unreachable"
    models = []
    error = None

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                ollama_status = "connected"
                models = [m.get("name") for m in resp.json().get("models", [])]
    except Exception as e:
        error = str(e)

    return {
        "status": "ok",
        "service": "CivicTrack AI Triage Module",
        "ollama": ollama_status,
        "models": models,
        "error": error,
    }
