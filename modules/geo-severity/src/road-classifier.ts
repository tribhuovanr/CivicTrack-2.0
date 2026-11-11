/**
 * Road classifier using Nominatim reverse-geocoding.
 * Never throws — returns "unknown" on any error or timeout.
 */

import { RoadClassSchema } from "@civictrack/contracts";
import type { RoadClass } from "@civictrack/contracts";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

interface NominatimResponse {
  extratags?: Record<string, string>;
  address?: Record<string, string>;
  type?: string;
  class?: string;
  namedetails?: Record<string, string>;
  // Nominatim puts road type info in various places
  addresstype?: string;
  osm_type?: string;
  // The highway tag for a nearby road comes via extratags
}

/** Map OSM highway tag values to our RoadClass enum. */
function highwayToRoadClass(highway: string): RoadClass {
  switch (highway) {
    case "motorway":
    case "trunk":
      return "highway";
    case "primary":
      return "arterial";
    case "secondary":
      return "collector";
    case "tertiary":
    case "residential":
    case "living_street":
    case "unclassified":
      return "local";
    default:
      return "unknown";
  }
}

/**
 * Classify the road type at the given coordinates via Nominatim reverse geocode.
 * Returns "unknown" on error or timeout.
 */
export async function classifyRoad(
  lat: number,
  lon: number,
  timeoutMs = 8_000,
): Promise<RoadClass> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "16");
  url.searchParams.set("extratags", "1");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          // Nominatim policy requires a descriptive User-Agent
          "User-Agent": "CivicTrack/2.0 (civic-complaint-management)",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return "unknown";

    const data = (await response.json()) as NominatimResponse;

    // extratags may contain the highway classification
    const highway = data.extratags?.["highway"] ?? "";
    if (highway) {
      return highwayToRoadClass(highway);
    }

    // Fall back to the top-level class field (Nominatim sometimes uses it)
    if (data.class === "highway" && data.type) {
      return highwayToRoadClass(data.type);
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

// Re-export types consumed by callers
export { RoadClassSchema };
export type { RoadClass };
