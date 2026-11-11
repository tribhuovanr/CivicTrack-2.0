/**
 * GeoAnalyser — computes LocationSeverity for a lat/lon coordinate.
 *
 * Uses:
 *   - Overpass API  → nearby sensitive sites (schools, hospitals, etc.)
 *   - Nominatim     → road classification
 *
 * Does NOT use Gemma4/LLM.
 */

import {
  LocationSeveritySchema,
  type LocationSeverity,
  type NearbySensitiveSite,
  type SensitiveSiteType,
} from "@civictrack/contracts";
import { queryNearbyPOIs, amenityToSiteType, type OverpassElement } from "./overpass.js";
import { classifyRoad } from "./road-classifier.js";

export type { LocationSeverity };
export { LocationSeveritySchema };

// ---------------------------------------------------------------------------
// Haversine distance utility
// ---------------------------------------------------------------------------

/** Compute the great-circle distance in metres between two WGS-84 coordinates. */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// GeoAnalyser configuration
// ---------------------------------------------------------------------------

export interface GeoAnalyserConfig {
  overpassTimeoutMs?: number;
  nominatimTimeoutMs?: number;
  /** Radius in metres for the Overpass POI query. Default: 300 */
  radiusM?: number;
  /** Minimum number of nearby sensitive sites to set hotspotFlag=true. Default: 2 */
  hotspotThreshold?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract the best coordinate pair from an Overpass element. */
function elementCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat !== undefined && el.lon !== undefined) {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center?.lat !== undefined && el.center.lon !== undefined) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

/** Determine whether a lat/lon pair represents a valid, non-null location. */
function isValidCoord(lat: number, lon: number): boolean {
  return !(lat === 0 && lon === 0);
}

// ---------------------------------------------------------------------------
// GeoAnalyser
// ---------------------------------------------------------------------------

export class GeoAnalyser {
  private readonly overpassTimeoutMs: number;
  private readonly nominatimTimeoutMs: number;
  private readonly radiusM: number;
  private readonly hotspotThreshold: number;

  constructor(config: GeoAnalyserConfig = {}) {
    this.overpassTimeoutMs = config.overpassTimeoutMs ?? 10_000;
    this.nominatimTimeoutMs = config.nominatimTimeoutMs ?? 8_000;
    this.radiusM = config.radiusM ?? 300;
    this.hotspotThreshold = config.hotspotThreshold ?? 2;
  }

  async analyse(lat: number, lon: number): Promise<LocationSeverity> {
    // Guard: null-island / invalid coords
    if (!isValidCoord(lat, lon)) {
      return LocationSeveritySchema.parse({
        locationCriticality: 0.1,
        wardId: null,
        nearbySensitiveSites: [],
        roadClass: "unknown",
        hotspotFlag: false,
        insideCityBoundary: false,
        reasons: ["Coordinates unavailable — using default criticality"],
      });
    }

    // Fan out both API calls concurrently
    const [elements, roadClass] = await Promise.all([
      queryNearbyPOIs(lat, lon, this.radiusM, this.overpassTimeoutMs),
      classifyRoad(lat, lon, this.nominatimTimeoutMs),
    ]);

    // -----------------------------------------------------------------------
    // Build the nearest-site-per-type map
    // -----------------------------------------------------------------------
    const nearestPerType = new Map<SensitiveSiteType, NearbySensitiveSite>();

    for (const el of elements) {
      const amenity = el.tags?.["amenity"] ?? "";
      const siteType = amenityToSiteType(amenity);
      if (!siteType) continue;

      const coords = elementCoords(el);
      if (!coords) continue;

      const distanceM = haversineDistanceM(lat, lon, coords.lat, coords.lon);
      const name =
        el.tags?.["name"] ??
        el.tags?.["name:en"] ??
        amenity.replace(/_/g, " ");

      const existing = nearestPerType.get(siteType);
      if (!existing || distanceM < existing.distanceM) {
        nearestPerType.set(siteType, { type: siteType, name, distanceM });
      }
    }

    const nearbySensitiveSites = Array.from(nearestPerType.values());

    // -----------------------------------------------------------------------
    // Compute locationCriticality
    // -----------------------------------------------------------------------
    let criticality = 0.1;
    const reasons: string[] = [];

    const school = nearestPerType.get("school");
    if (school && school.distanceM <= 100) {
      criticality += 0.3;
      reasons.push(`School within ${Math.round(school.distanceM)}m (${school.name})`);
    }

    const hospital = nearestPerType.get("hospital");
    if (hospital && hospital.distanceM <= 200) {
      criticality += 0.2;
      reasons.push(`Hospital within ${Math.round(hospital.distanceM)}m (${hospital.name})`);
    }

    const busStop = nearestPerType.get("bus_stop");
    if (busStop && busStop.distanceM <= 100) {
      criticality += 0.15;
      reasons.push(`Bus stop within ${Math.round(busStop.distanceM)}m`);
    }

    const market = nearestPerType.get("market");
    if (market && market.distanceM <= 150) {
      criticality += 0.1;
      reasons.push(`Market within ${Math.round(market.distanceM)}m (${market.name})`);
    }

    const worship = nearestPerType.get("worship_place");
    if (worship && worship.distanceM <= 150) {
      criticality += 0.1;
      reasons.push(`Place of worship within ${Math.round(worship.distanceM)}m`);
    }

    switch (roadClass) {
      case "highway":
        criticality += 0.25;
        reasons.push("Located on highway road");
        break;
      case "arterial":
        criticality += 0.2;
        reasons.push("Located on arterial road");
        break;
      case "collector":
        criticality += 0.1;
        reasons.push("Located on collector road");
        break;
    }

    // Clamp to [0, 1]
    const locationCriticality = Math.min(1, Math.max(0, criticality));

    if (reasons.length === 0) {
      reasons.push("No significant nearby sensitive sites or major roads detected");
    }

    return LocationSeveritySchema.parse({
      locationCriticality,
      wardId: null,
      nearbySensitiveSites,
      roadClass,
      hotspotFlag: nearbySensitiveSites.length >= this.hotspotThreshold,
      insideCityBoundary: true,
      reasons,
    });
  }
}
