"""
CivicTrack AI Department Classifier
Uses Ollama (Gemma4) to classify citizen complaints into municipal departments.
Uses the /api/chat endpoint with system+user messages for best results with Gemma4.
"""

import json
import re
import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "gemma4"

DEPARTMENTS = [
    "Roads and Infrastructure",
    "Waste Management",
    "Water Supply",
    "Drainage and Sanitation",
    "Street Lighting",
    "Other",
]

SYSTEM_MESSAGE = """You are a municipal complaint classifier for a city civic body.
Your job is to read a citizen's complaint and classify it into EXACTLY ONE of these departments:

1. Roads and Infrastructure — potholes, road damage, broken footpaths, bridges, traffic signals, road construction, flyovers, speed bumps, road signs
2. Waste Management — garbage collection, garbage piles, waste bins, littering, solid waste, recycling, dumping, overflowing bins, dead animals
3. Water Supply — water shortage, dirty water, water leakage, burst pipes, water tankers, water pressure, water contamination, bore wells, water meters
4. Drainage and Sanitation — clogged drains, overflowing drains, sewage, open drains, manholes, flooding due to drains, stagnant water, mosquito breeding
5. Street Lighting — broken streetlights, dark areas, flickering lights, damaged poles, no lighting, faulty wiring of street lights
6. Other — anything that does not clearly fit the above 5 departments

You MUST respond with ONLY a valid JSON object in this exact format, nothing else:
{"department": "<exact department name from the list>", "confidence": <number between 0.0 and 1.0>}

Rules:
- Pick the single MOST relevant department.
- confidence should reflect how clearly the complaint maps to that department (1.0 = very clear match, 0.5 = ambiguous).
- If unsure, use "Other" with a lower confidence.
- Do NOT add any explanation or text outside the JSON."""


async def classify(title: str, description: str) -> dict:
    """
    Classify a complaint into a department using Ollama/Gemma4.

    Returns:
        dict with keys: department (str), confidence (float), error (str|None)
    """
    complaint_text = f"Title: {title}\nDescription: {description}" if title else description

    user_message = f"""Classify this complaint into one department.

Complaint:
{complaint_text}

Respond with ONLY the JSON object: {{"department": "...", "confidence": ...}}"""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_MESSAGE},
                        {"role": "user", "content": user_message},
                    ],
                    "stream": False,
                    "options": {
                        "temperature": 0.1,   # Low temperature for deterministic classification
                        "num_predict": 512,   # Enough room for thinking + response in Gemma4
                    },
                },
            )
            response.raise_for_status()

        result = response.json()

        # Gemma4 uses chat format — response is in message.content
        raw_text = result.get("message", {}).get("content", "").strip()

        # If content is empty, the model may have used all tokens for thinking
        # Check the thinking field as fallback
        if not raw_text:
            thinking = result.get("message", {}).get("thinking", "")
            if thinking:
                # Try to extract department from the thinking text using keyword matching
                return _classify_from_thinking(thinking)
            return {
                "department": "Other",
                "confidence": 0.0,
                "error": "Model returned empty response. Try increasing num_predict.",
            }

        # Parse the JSON from the LLM response
        parsed = _extract_json(raw_text)
        if parsed is None:
            return {
                "department": "Other",
                "confidence": 0.0,
                "error": f"Could not parse LLM response: {raw_text[:200]}",
            }

        department = parsed.get("department", "Other")
        confidence = parsed.get("confidence", 0.0)

        # Validate department name — fuzzy match to handle minor LLM variations
        department = _match_department(department)

        # Clamp confidence to [0, 1]
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            confidence = 0.5

        return {"department": department, "confidence": round(confidence, 2), "error": None}

    except httpx.ConnectError:
        return {
            "department": None,
            "confidence": 0.0,
            "error": "Cannot connect to Ollama. Is it running? (ollama serve)",
        }
    except httpx.TimeoutException:
        return {
            "department": None,
            "confidence": 0.0,
            "error": "Ollama request timed out. The model may still be loading.",
        }
    except Exception as e:
        return {
            "department": None,
            "confidence": 0.0,
            "error": f"Classification failed: {str(e)}",
        }


def _classify_from_thinking(thinking: str) -> dict:
    """
    Fallback: if Gemma4 spent all tokens on thinking and didn't produce
    a final content response, extract the department from its reasoning.
    """
    thinking_lower = thinking.lower()

    # Look for explicit department mentions in thinking
    scores = {}
    for dept in DEPARTMENTS:
        if dept == "Other":
            continue
        # Count how many times the department is mentioned
        count = thinking_lower.count(dept.lower())
        if count > 0:
            scores[dept] = count

    if not scores:
        # Try keyword matching on the thinking text
        keywords = {
            "Roads and Infrastructure": ["road", "pothole", "bridge", "footpath", "traffic", "flyover"],
            "Waste Management": ["waste", "garbage", "trash", "bin", "dump", "litter", "rubbish"],
            "Water Supply": ["water supply", "pipe", "tank", "bore", "leak"],
            "Drainage and Sanitation": ["drain", "sewer", "manhole", "flood", "sanit", "stagnant"],
            "Street Lighting": ["streetlight", "light", "lamp", "pole", "dark"],
        }
        for dept, kws in keywords.items():
            for kw in kws:
                if kw in thinking_lower:
                    scores[dept] = scores.get(dept, 0) + 1

    if scores:
        best_dept = max(scores, key=scores.get)
        # Check for explicit match phrases like "This falls under" or "belongs to"
        confidence = 0.75 if any(
            phrase in thinking_lower
            for phrase in ["this falls under", "belongs to", "classified as", "the answer is", "most relevant"]
        ) else 0.6
        return {"department": best_dept, "confidence": confidence, "error": None}

    return {"department": "Other", "confidence": 0.3, "error": None}


def _extract_json(text: str) -> dict | None:
    """Extract a JSON object from LLM output, handling markdown code blocks and extra text."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if code_block:
        try:
            return json.loads(code_block.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding any JSON object in the text
    json_match = re.search(r"\{[^{}]*\}", text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _match_department(dept: str) -> str:
    """Fuzzy-match a department name to the canonical list."""
    dept_lower = dept.strip().lower()

    # Exact match (case-insensitive)
    for d in DEPARTMENTS:
        if d.lower() == dept_lower:
            return d

    # Substring match
    for d in DEPARTMENTS:
        if dept_lower in d.lower() or d.lower() in dept_lower:
            return d

    # Keyword-based fallback
    keywords = {
        "Roads and Infrastructure": ["road", "pothole", "bridge", "footpath", "traffic", "flyover"],
        "Waste Management": ["waste", "garbage", "trash", "bin", "dump", "litter", "rubbish"],
        "Water Supply": ["water", "pipe", "tank", "bore", "leak", "supply"],
        "Drainage and Sanitation": ["drain", "sewer", "manhole", "flood", "sanit", "stagnant"],
        "Street Lighting": ["light", "lamp", "pole", "dark", "street light"],
    }
    for d, kws in keywords.items():
        if any(kw in dept_lower for kw in kws):
            return d

    return "Other"
