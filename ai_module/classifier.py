"""
CivicTrack AI Triage and Department Classifier
Uses Ollama (Gemma4) for intelligent complaint classification, hazard assessment,
and priority SLA triage for municipal governance.
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

SLA_MAP = {
    "P1": 12,   # Critical / Life Safety: 12 Hours
    "P2": 36,   # High Priority: 36 Hours
    "P3": 72,   # Medium / Standard: 72 Hours
    "P4": 168,  # Low / Routine: 7 Days (168 Hours)
}

TRIAGE_SYSTEM_PROMPT = """You are an expert AI municipal triage agent for a city municipal corporation.
Analyze the citizen complaint to determine:
1. Responsible Department (must be one of: "Roads and Infrastructure", "Waste Management", "Water Supply", "Drainage and Sanitation", "Street Lighting", "Other")
2. Issue Sub-Type (e.g. "pothole", "open_manhole", "garbage_dump", "pipe_burst", "dark_street", "sewage_overflow")
3. Hazard Level (float 0.0 to 1.0) based on severity, traffic risk, health risk, or vulnerability.
4. Life Safety (boolean true/false): true if there is an imminent risk of severe injury, electrocution, drowning in manholes, road collapse, or vehicle collisions.
5. Priority Band:
   - "P1": Critical emergencies, life safety hazards, immediate danger near schools/hospitals (SLA: 12 hours)
   - "P2": High severity, major road obstruction, widespread water outage, sewer overflow (SLA: 36 hours)
   - "P3": Medium severity, localized pothole, bin overflowing, minor water leak (SLA: 72 hours)
   - "P4": Low severity, minor cosmetic defects, routine maintenance (SLA: 168 hours)
6. Priority Score: 0 to 100 based on severity and urgency.
7. SLA Target Hours: integer matching the band (P1=12, P2=36, P3=72, P4=168).
8. Hazard Keywords: key risk factors detected (e.g. ["open manhole", "near school", "child danger"]).
9. English Summary: 1 clear, objective sentence summarizing the situation for field officers.
10. Confidence: 0.0 to 1.0.

You MUST reply with ONLY a JSON object:
{
  "department": "<one of the 6 canonical departments>",
  "subType": "<short issue sub type>",
  "hazardLevel": <float 0.0 to 1.0>,
  "lifeSafety": <boolean>,
  "priority": "P1" | "P2" | "P3" | "P4",
  "priorityScore": <integer 0-100>,
  "slaHours": <integer 12 | 36 | 72 | 168>,
  "hazardKeywords": ["<kw1>", "<kw2>"],
  "summary": "<one sentence summary>",
  "confidence": <float 0.0 to 1.0>
}"""


async def triage(title: str, description: str) -> dict:
    """
    Run full AI triage on a complaint using Ollama/Gemma4 with JSON mode.
    Falls back to deterministic rule-based analysis if LLM is offline or times out.
    """
    complaint_text = f"Title: {title.strip()}\nDescription: {description.strip()}" if title else description.strip()

    user_message = f"""Triage the following municipal complaint:

Complaint:
{complaint_text}

Output JSON only."""

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_message},
                    ],
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 1024,
                    },
                },
            )
            response.raise_for_status()

        result = response.json()
        raw_text = result.get("message", {}).get("content", "").strip()

        if not raw_text:
            thinking = result.get("message", {}).get("thinking", "")
            if thinking:
                extracted = _extract_json(thinking)
                if extracted:
                    return _normalize_triage(extracted, title, description)
            return _rule_based_triage(title, description, error="Model returned empty content; rule-based fallback used")

        parsed = _extract_json(raw_text)
        if not parsed:
            return _rule_based_triage(title, description, error="Failed to parse LLM JSON; rule-based fallback used")

        return _normalize_triage(parsed, title, description)

    except (httpx.ConnectError, httpx.TimeoutException) as e:
        err_msg = "Ollama service unavailable or timed out; rule-based fallback applied"
        return _rule_based_triage(title, description, error=err_msg)
    except Exception as e:
        return _rule_based_triage(title, description, error=f"Triage error ({str(e)}); rule-based fallback applied")


async def classify(title: str, description: str) -> dict:
    """
    Simpler endpoint for department classification, delegating to triage.
    """
    triage_result = await triage(title, description)
    return {
        "department": triage_result.get("department", "Other"),
        "confidence": triage_result.get("confidence", 0.7),
        "error": triage_result.get("error"),
        "priority": triage_result.get("priority", "P3"),
        "hazardLevel": triage_result.get("hazardLevel", 0.5),
        "lifeSafety": triage_result.get("lifeSafety", False),
        "slaHours": triage_result.get("slaHours", 72),
        "subType": triage_result.get("subType", "civic_issue"),
        "summary": triage_result.get("summary", ""),
    }


def _normalize_triage(data: dict, title: str, description: str) -> dict:
    """Normalize, clamp, and validate AI triage fields."""
    dept = _match_department(str(data.get("department", "Other")))
    
    # Hazard level & life safety
    try:
        hazard = float(data.get("hazardLevel", 0.5))
        hazard = max(0.0, min(1.0, hazard))
    except (TypeError, ValueError):
        hazard = 0.5

    life_safety = bool(data.get("lifeSafety", False))
    
    # Priority
    priority = str(data.get("priority", "")).upper()
    if priority not in ("P1", "P2", "P3", "P4"):
        if life_safety or hazard >= 0.8:
            priority = "P1"
        elif hazard >= 0.55:
            priority = "P2"
        elif hazard >= 0.3:
            priority = "P3"
        else:
            priority = "P4"

    # Enforce P1 on life safety
    if life_safety and priority != "P1":
        priority = "P1"

    # Score
    try:
        score = int(data.get("priorityScore", 50))
        score = max(0, min(100, score))
    except (TypeError, ValueError):
        score = {"P1": 90, "P2": 70, "P3": 45, "P4": 20}.get(priority, 50)

    # SLA hours
    sla = SLA_MAP.get(priority, 72)

    # Keywords
    kws = data.get("hazardKeywords", [])
    if not isinstance(kws, list):
        kws = [str(kws)] if kws else []

    # Summary
    summary = str(data.get("summary", "")).strip()
    if not summary:
        summary = f"{title or 'Complaint'}: {description[:120]}..."

    # SubType
    sub_type = str(data.get("subType", "civic_issue")).strip()

    try:
        confidence = float(data.get("confidence", 0.8))
        confidence = max(0.1, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.8

    return {
        "department": dept,
        "subType": sub_type,
        "hazardLevel": round(hazard, 2),
        "lifeSafety": life_safety,
        "priority": priority,
        "priorityScore": score,
        "slaHours": sla,
        "hazardKeywords": [str(k) for k in kws[:6]],
        "summary": summary,
        "confidence": round(confidence, 2),
        "error": None,
    }


def _rule_based_triage(title: str, description: str, error: str | None = None) -> dict:
    """
    Deterministic rule-based triage engine when LLM is unavailable.
    Detects safety critical keywords, sensitive locations, and department markers.
    """
    text = f"{title} {description}".lower()

    # Life safety triggers
    life_safety_kws = [
        "open manhole", "deep manhole", "live wire", "sparking", "fallen wire",
        "electrocution", "road collapse", "sinkhole", "deep pit", "child fell",
        "accident", "gas leak", "explosion", "major flood", "danger to life"
    ]
    detected_life_safety = [kw for kw in life_safety_kws if kw in text]
    life_safety = len(detected_life_safety) > 0

    # Sensitive zones
    sensitive_kws = ["school", "hospital", "pedestrian", "bus stand", "metro", "kindergarten", "elderly"]
    detected_sensitive = [kw for kw in sensitive_kws if kw in text]

    # Department classification
    dept_scores = {
        "Roads and Infrastructure": ["pothole", "road", "tar", "asphalt", "footpath", "sidewalk", "divider", "traffic signal", "bridge", "flyover", "speed breaker"],
        "Waste Management": ["garbage", "trash", "waste", "bin", "dump", "litter", "rubbish", "dead animal", "debris"],
        "Water Supply": ["water supply", "pipe leak", "pipeline", "no water", "contaminated water", "dirty water", "water tanker", "borewell", "low pressure"],
        "Drainage and Sanitation": ["drain", "drainage", "sewage", "sewer", "manhole", "gutter", "waterlogging", "mosquito", "overflowing drain"],
        "Street Lighting": ["streetlight", "street light", "lamp", "pole", "dark street", "lighting", "bulb", "fuse", "no light"],
    }

    scores = {}
    for d, kws in dept_scores.items():
        count = sum(1 for kw in kws if kw in text)
        if count > 0:
            scores[d] = count

    dept = max(scores, key=scores.get) if scores else "Other"

    # Calculate Priority and Hazard
    hazard = 0.3
    if life_safety:
        hazard = 0.95
        priority = "P1"
        score = 95
    elif detected_sensitive:
        hazard = 0.75
        priority = "P2"
        score = 75
    elif any(w in text for w in ["overflowing", "blocked", "heavy", "urgent", "broken"]):
        hazard = 0.60
        priority = "P2"
        score = 65
    elif dept in ["Drainage and Sanitation", "Water Supply"]:
        hazard = 0.45
        priority = "P3"
        score = 45
    else:
        priority = "P3"
        score = 40

    sla = SLA_MAP[priority]
    all_kws = list(set(detected_life_safety + detected_sensitive))

    return {
        "department": dept,
        "subType": dept.split()[0].lower() + "_issue",
        "hazardLevel": hazard,
        "lifeSafety": life_safety,
        "priority": priority,
        "priorityScore": score,
        "slaHours": sla,
        "hazardKeywords": all_kws,
        "summary": f"{title or 'Civic issue'} requiring {dept} attention.",
        "confidence": 0.85 if scores else 0.5,
        "error": error,
    }


def _extract_json(text: str) -> dict | None:
    """Extract a JSON object from LLM output, handling markdown code blocks and reasoning text."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try code block extraction
    code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if code_block:
        try:
            return json.loads(code_block.group(1))
        except json.JSONDecodeError:
            pass

    # Try matching first balanced or outer JSON object
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _match_department(dept: str) -> str:
    """Fuzzy-match a department name to the canonical list."""
    dept_lower = dept.strip().lower()

    for d in DEPARTMENTS:
        if d.lower() == dept_lower:
            return d

    for d in DEPARTMENTS:
        if dept_lower in d.lower() or d.lower() in dept_lower:
            return d

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
