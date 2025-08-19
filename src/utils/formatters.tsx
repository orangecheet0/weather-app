import {
  Cloud,
  Sun,
  Moon,
  CloudFog,
  CloudRain,
  CloudDrizzle,
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

export function weatherIcon(code: number, isDay: boolean = true) {
  switch (code) {
    case 0:
      // Clear sky
      return isDay ? <Sun /> : <Moon />;
    case 1:
    case 2:
      // Partly cloudy
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
      return <Sun />;
  }
}

export function windyUrl(coords: Coords, unit: Unit, zoom = 8): string {
  const { lat, lon } = coords;
  const metricTemp = unit === "imperial" ? "°F" : "°C";
  const metricWind = unit === "imperial" ? "mph" : "km/h";
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
    metricWind,
    metricTemp,
  });

  return `https://embed.windy.com/embed2.html?${p.toString()}`;
}

export function pickTheme(code: number | null | undefined, isoTime?: string): ThemeKey {
  const hour = isoTime ? new Date(isoTime).getHours() : new Date().getHours();
  const night = hour < 6 || hour >= 18;

  if (code == null) return night ? "clearNight" : "cloudy";
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";

  if (night) return "clearNight";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";

  return "clearDay";
}

export type ThemeKey =
  | "clearDay"
  | "clearNight"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm";
