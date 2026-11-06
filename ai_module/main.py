"""
CivicTrack AI Module — FastAPI Backend
Provides /api/classify endpoint for NLP-based department classification.

Run:  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from classifier import classify, DEPARTMENTS

app = FastAPI(
    title="CivicTrack AI Module",
    description="NLP-based complaint department classifier using Ollama (Gemma)",
    version="1.0.0",
)

# CORS — allow the Vite dev server and common local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClassifyRequest(BaseModel):
    title: str = Field(default="", description="Complaint title")
    description: str = Field(..., min_length=5, description="Complaint description text")


class ClassifyResponse(BaseModel):
    department: str | None = Field(description="Classified department name")
    confidence: float = Field(description="Confidence score 0.0–1.0")
    error: str | None = Field(default=None, description="Error message if classification failed")


@app.post("/api/classify", response_model=ClassifyResponse)
async def classify_complaint(req: ClassifyRequest):
    """
    Classify a complaint description into a municipal department using Ollama/Gemma.

    Returns the predicted department and a confidence score.
    If the LLM is unreachable or fails, returns an error with department=null
    so the frontend can fall back to manual selection.
    """
    result = await classify(req.title, req.description)
    return ClassifyResponse(**result)


@app.get("/api/departments")
async def list_departments():
    """Return the list of valid departments (for frontend sync)."""
    return {"departments": DEPARTMENTS}


@app.get("/api/health")
async def health():
    """Health check — also verifies Ollama connectivity."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return {"status": "ok", "ollama": "connected", "models": models}
    except Exception as e:
        return {"status": "degraded", "ollama": "unreachable", "error": str(e)}
