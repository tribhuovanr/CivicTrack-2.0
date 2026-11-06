# CivicTrack AI Module

NLP-based department classification for citizen complaints using **Ollama** with the **Gemma** model.

## Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com) installed and running
- Gemma model pulled: `ollama pull gemma4`

## Setup

```bash
cd ai_module

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
# Make sure Ollama is running (in a separate terminal)
ollama serve

# Start the API server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### `POST /api/classify`
Classify a complaint description into a department.

**Request:**
```json
{
  "title": "Large pothole near school",
  "description": "Big pothole near the school gate causing accidents"
}
```

**Response:**
```json
{
  "department": "Roads and Infrastructure",
  "confidence": 0.95,
  "error": null
}
```

### `GET /api/departments`
Returns the list of valid departments.

### `GET /api/health`
Health check — verifies Ollama connectivity and lists available models.

## Architecture

```
Citizen types complaint
       │
       ▼
React Frontend ──POST /api/classify──▶ FastAPI (this module)
       │                                      │
       │                                      ▼
       │                              Ollama API (localhost:11434)
       │                                      │
       │                                      ▼
       │                              Gemma LLM processes prompt
       │                                      │
       ◀──────── {department, confidence} ─────┘
       │
       ▼
Store complaint with AI classification
```
