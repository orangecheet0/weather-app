"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Sun,
} from "lucide-react";
import { Coords, Unit } from "@/types";

export const THEMES = {
  clearDay: "from-sky-300 via-sky-500 to-indigo-700",
  clearNight: "from-indigo-900 via-slate-950 to-black",
  cloudy: "from-slate-700 via-slate-900 to-slate-950",
  rain: "from-sky-700 via-slate-950 to-slate-950",
  snow: "from-cyan-200 via-slate-800 to-slate-950",
  storm: "from-indigo-800 via-slate-950 to-black",
} as const;

export type ThemeKey = keyof typeof THEMES;

export function useWeatherFormatting() {
  function formatTemp(t: number | null | undefined, unit: Unit) {
    if (t === null || t === undefined || Number.isNaN(t)) return "—";
    return `${Math.round(t)}°${unit === "imperial" ? "F" : "C"}`;
  }

  function formatWind(w: number | null | undefined, unit: Unit) {
    if (w === null || w === undefined || Number.isNaN(w)) return "—";
    return `${Math.round(w)} ${unit === "imperial" ? "mph" : "km/h"}`;
  }

  function formatUV(uv: number | null | undefined) {
    if (uv === null || uv === undefined || Number.isNaN(uv)) return "—";
    return Math.round(uv).toString();
  }

  function shortDate(isoOrYmd: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
      const [y, m, d] = isoOrYmd.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }
    const d = new Date(isoOrYmd);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function shortTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric" });
  }

  function weatherIcon(code: number | null) {
    if (code == null) return <Cloud className="h-6 w-6" aria-hidden />;
    if ([0].includes(code)) return <Sun className="h-6 w-6" aria-hidden />;
    if ([1, 2, 3].includes(code)) return <Cloud className="h-6 w-6" aria-hidden />;
    if ([45, 48].includes(code)) return <CloudFog className="h-6 w-6" aria-hidden />;
    if ([51, 53, 55, 61, 63, 65].includes(code)) return <CloudRain className="h-6 w-6" aria-hidden />;
    if ([80, 81, 82].includes(code)) return <CloudDrizzle className="h-6 w-6" aria-hidden />;
    if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow className="h-6 w-6" aria-hidden />;
    if ([95, 96, 99].includes(code)) return <CloudLightning className="h-6 w-6" aria-hidden />;
    return <Cloud className="h-6 w-6" aria-hidden />;
  }

  function windyUrl(coords: Coords, unit: Unit, zoom = 8): string {
    const { lat, lon } = coords;
    const metricTemp = unit === "imperial" ? "°F" : "°C";
    const metricWind = unit === "imperial" ? "mph" : "km/h";
    const p = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      detailLat: String(lat),
      detailLon: String(lon),
      zoom: String(zoom),
      level: "surface",
      overlay: "radar",
      product: "ecmwf",
      radarRange: "-1",
      menu: "",
      message: "",
      marker: "",
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

  function pickTheme(code: number | null | undefined, isoTime?: string): ThemeKey {
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

  return {
    formatTemp,
    formatWind,
    formatUV,
    shortDate,
    shortTime,
    weatherIcon,
    windyUrl,
    pickTheme,
  };
}
