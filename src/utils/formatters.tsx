import {
  Sun,
  Moon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";

import type { Coords, Unit } from "@/types";

/* =========================
   Lookup tables
   ========================= */

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

/* =========================
   Utility & Formatter Functions
   ========================= */

export function normalizeQuery(input: string): string {
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // If US state is entered as full name, convert to code
  if (parts.length >= 2 && parts[1].length > 2) {
    const stateName = parts[1].toLowerCase();
    if (US_STATES[stateName]) {
      parts[1] = US_STATES[stateName];
    }
  }

  // State and country codes should be uppercase
  if (parts[1]) parts[1] = parts[1].toUpperCase();
  if (parts[2]) parts[2] = parts[2].toUpperCase();

  return parts.join(",");
}

export function formatTemp(t: number | null | undefined, unit: Unit) {
  if (t === null || t === undefined || Number.isNaN(t)) return "—";
  return `${Math.round(t)}°${unit === "imperial" ? "F" : "C"}`;
}

export function formatWind(w: number | null | undefined, unit: Unit) {
  if (w === null || w === undefined || Number.isNaN(w)) return "—";
  return `${Math.round(w)} ${unit === "imperial" ? "mph" : "km/h"}`;
}

export function formatUV(uv: number | null | undefined) {
  if (uv === null || uv === undefined || Number.isNaN(uv)) return "—";
  return Math.round(uv).toString();
}

export function shortDate(isoOrYmd: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const d = new Date(isoOrYmd);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}

/**
 * Returns an icon component for the given Open-Meteo weather_code.
 * If `isDay` is false, a moon icon is used for clear / partly cloudy codes.
 */
export function weatherIcon(code: number, isDay: boolean = true) {
  switch (code) {
    case 0:
      return isDay ? <Sun /> : <Moon />;
    case 1:
    case 2:
      return isDay ? <Sun /> : <Moon />;
    case 3:
      return <Cloud />;
    case 45:
    case 48:
      return <CloudFog />;
    case 51:
    case 53:
    case 55:
      return <CloudDrizzle />;
    case 61:
    case 63:
    case 65:
      return <CloudRain />;
    case 71:
    case 73:
    case 75:
      return <CloudSnow />;
    case 95:
      return <CloudLightning />;
    default:
      return isDay ? <Sun /> : <Moon />;
  }
}

/**
 * Windy embed URL builder.
 * - When unit === "imperial":
 *    - metricTemp=us (Windy's flag for Fahrenheit)
 *    - metricWind=mph
 *    - metricRain=inch  ✅ (fixed)
 * - When unit === "metric":
 *    - metricTemp=°C
 *    - metricWind=km/h
 *    - metricRain=mm
 */
export function windyUrl(coords: Coords, unit: Unit, zoom = 8): string {
  const { lat, lon } = coords;

  const metricTemp = unit === "imperial" ? "us" : "°C";
  const metricWind = unit === "imperial" ? "mph" : "km/h";
  const metricRain = unit === "imperial" ? "inch" : "mm"; // ✅ fixed

  const p = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    detailLat: lat.toFixed(6),
    detailLon: lon.toFixed(6),
    zoom: String(zoom),
    level: "surface",
    overlay: "radar",
    product: "ecmwf",
    radarRange: "-1",
    menu: "",
    message: "",
    marker: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    pressure: "",
    detail: "",
    type: "map",
    location: "coordinates",
    calendar: "now",
    metricTemp,
    metricWind,
    metricRain,
  });

  return `https://embed.windy.com/embed2?${p.toString()}`;
}
