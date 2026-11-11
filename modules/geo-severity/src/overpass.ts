/**
 * Overpass API client for nearby POI lookup around a geographic coordinate.
 */

import type { SensitiveSiteType } from "@civictrack/contracts";

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const AMENITY_PATTERN =
  "school|kindergarten|university|college|hospital|clinic|doctors|pharmacy|bus_stop|bus_station|marketplace|market|place_of_worship|mosque|temple|church";

/**
 * Query Overpass API for nearby amenities within `radiusM` metres of `lat`/`lon`.
 * Returns an empty array on HTTP error or timeout — never throws.
 */
export async function queryNearbyPOIs(
  lat: number,
  lon: number,
  radiusM: number,
  timeoutMs = 10_000,
): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:10];
(
  node["amenity"~"${AMENITY_PATTERN}"](around:${radiusM},${lat},${lon});
  way["amenity"~"${AMENITY_PATTERN}"](around:${radiusM},${lat},${lon});
);
out center;`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return [];

    const data = (await response.json()) as OverpassResponse;
    return Array.isArray(data.elements) ? data.elements : [];
  } catch {
    // Absorb network errors, timeouts, parse errors
    return [];
  }
}

/** Map an OSM amenity tag value to our canonical SensitiveSiteType. */
export function amenityToSiteType(amenity: string): SensitiveSiteType | null {
  switch (amenity) {
    case "school":
    case "kindergarten":
    case "university":
    case "college":
      return "school";
    case "hospital":
    case "clinic":
    case "doctors":
    case "pharmacy":
      return "hospital";
    case "bus_stop":
    case "bus_station":
      return "bus_stop";
    case "marketplace":
    case "market":
      return "market";
    case "place_of_worship":
    case "mosque":
    case "temple":
    case "church":
      return "worship_place";
    default:
      return null;
  }
}
