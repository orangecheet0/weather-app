"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  Loader2,
  MapPin,
  Search,
  Sun,
  Thermometer,
  Wind,
  AlertTriangle,
  Share2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Maximize2,
  X,
  LocateFixed,
  Info,
} from "lucide-react";

/* =========================
   Types (Slightly modified for new data structure)
   ========================= */

type Unit = "imperial" | "metric";

interface Coords {
  lat: number;
  lon: number;
}

// This now holds all our weather data in one object
interface WeatherData {
  current: CurrentBlock;
  daily: DailyBlock;
  hourly: HourlyBlock;
  alerts: AlertItem[];
}

interface CurrentBlock {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number | null;
  apparent_temperature: number | null;
  precipitation: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  uv_index?: number | null;
}

interface DailyBlock {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  weather_code: (number | null)[];
  uv_index_max?: (number | null)[];
}

interface HourlyBlock {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation_probability: (number | null)[];
  weather_code: (number | null)[];
  uv_index?: (number | null)[];
}

type NWSFeature = {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    effective?: string;
    ends?: string;
    description?: string;
    instruction?: string;
    areaDesc?: string;
  };
};

interface AlertItem {
  id: string;
  event: string;
  headline?: string;
  severity?: string;
  effective?: string;
  ends?: string;
  description?: string;
  instruction?: string;
  areaDesc?: string;
}

/* =========================
   Helpers (Mostly unchanged)
   ========================= */

const DEFAULT_CITY = {
  name: "Huntsville",
  admin1: "Alabama",
  country: "US",
  lat: 34.7304,
  lon: -86.5861,
};

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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

const THEMES = {
  clearDay: "from-sky-300 via-sky-500 to-indigo-700",
  clearNight: "from-indigo-900 via-slate-950 to-black",
  cloudy: "from-slate-700 via-slate-900 to-slate-950",
  rain: "from-sky-700 via-slate-950 to-slate-950",
  snow: "from-cyan-200 via-slate-800 to-slate-950",
  storm: "from-indigo-800 via-slate-950 to-black",
} as const;

type ThemeKey = keyof typeof THEMES;

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

const US_STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Carolina", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico",
};

function norm(s: string) {
  return s.replace(/\./g, "").trim().toLowerCase();
}
function resolveStateName(input: string): string | null {
  if (!input) return null;
  const abbr = input.trim().toUpperCase();
  if (US_STATE_ABBR_TO_NAME[abbr]) return US_STATE_ABBR_TO_NAME[abbr];
  const full = Object.values(US_STATE_ABBR_TO_NAME).find((n) => norm(n) === norm(input));
  return full || null;
}

/* =========================
   Small UI Components
   ========================= */

// --- Current Weather Display ---
function CurrentWeatherCard({ data, unit }: { data: CurrentBlock; unit: Unit }) {
  return (
    <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current Weather</h2>
        <p className="text-sm text-slate-300">{shortTime(data.time)}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-sky-300">{weatherIcon(data.weather_code)}</div>
          <div className="text-5xl font-light tracking-tighter">{formatTemp(data.temperature_2m, unit)}</div>
        </div>
        <div className="space-y-1 text-right text-sm">
          <div>
            Feels like: <span className="font-medium">{formatTemp(data.apparent_temperature, unit)}</span>
          </div>
          <div>
            Wind: <span className="font-medium">{formatWind(data.wind_speed_10m, unit)}</span>
          </div>
          <div>
            Gusts: <span className="font-medium">{formatWind(data.wind_gusts_10m, unit)}</span>
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-sky-300" />
          <span>Humidity: {data.relative_humidity_2m}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-sky-300" />
          <span>UV Index: {formatUV(data.uv_index)}</span>
        </div>
      </div>
    </div>
  );
}

// --- Daily Forecast Display ---
function DailyForecast({ data, unit }: { data: DailyBlock; unit: Unit }) {
  return (
    <div className="space-y-2">
      {data.time.map((t, i) => (
        <div
          key={t}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg bg-slate-900/30 p-2 px-3 ring-1 ring-white/10"
        >
          <div className="font-medium">{shortDate(t)}</div>
          <div className="flex items-center gap-2 text-slate-300">{weatherIcon(data.weather_code[i])}</div>
          <div className="flex items-center gap-2 font-medium">
            <span className="text-slate-300">{formatTemp(data.temperature_2m_min[i], unit)}</span>
            <span className="text-white">{formatTemp(data.temperature_2m_max[i], unit)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Hourly Forecast Display ---
function HourlyForecast({ data, unit }: { data: HourlyBlock; unit: Unit }) {
  const now = new Date();
  const startIndex = data.time.findIndex((t) => new Date(t) > now);

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
      {data.time.slice(startIndex, startIndex + 24).map((t, i) => (
        <div
          key={t}
          className="w-24 shrink-0 snap-start space-y-3 rounded-xl bg-slate-900/30 p-3 text-center ring-1 ring-white/10"
        >
          <p className="text-sm font-medium">{shortTime(t)}</p>
          <div className="mx-auto flex h-6 w-6 items-center justify-center text-sky-300">
            {weatherIcon(data.weather_code[startIndex + i])}
          </div>
          <p className="font-semibold">{formatTemp(data.temperature_2m[startIndex + i], unit)}</p>
          {data.precipitation_probability[startIndex + i] !== null && data.precipitation_probability[startIndex + i]! > 5 && (
            <p className="text-xs text-sky-300">{data.precipitation_probability[startIndex + i]}%</p>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Alerts Display ---
function AlertsPanel({ alerts }: { alerts: NWSFeature[] }) {
  // Convert NWS Features to our internal AlertItem type
  const alertItems: AlertItem[] = alerts.map((f: NWSFeature) => ({
    id: f?.id || crypto.randomUUID(),
    event: f?.properties?.event ?? "Alert",
    headline: f?.properties?.headline,
    severity: f?.properties?.severity,
    effective: f?.properties?.effective,
    ends: f?.properties?.ends,
    description: f?.properties?.description,
    instruction: f?.properties?.instruction,
    areaDesc: f?.properties?.areaDesc,
  }));

  if (alertItems.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 text-center text-slate-300 ring-1 ring-white/10 backdrop-blur-sm">
        No active alerts for this area.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alertItems.map((alert) => (
        <details
          key={alert.id}
          className="group cursor-pointer rounded-xl bg-yellow-900/20 p-4 ring-1 ring-yellow-500/50 backdrop-blur-sm"
        >
          <summary className="flex items-center justify-between text-lg font-semibold text-yellow-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              {alert.event}
            </div>
            <span className="text-sm font-normal text-yellow-300 transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="mt-4 space-y-4 border-t border-yellow-500/30 pt-4 text-yellow-200/90">
            <p className="font-semibold">{alert.headline}</p>
            <p className="whitespace-pre-wrap">{alert.description}</p>
            {alert.instruction && <p className="whitespace-pre-wrap font-semibold">{alert.instruction}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

// --- Map Panel (Unchanged) ---
function MapPanel({ coords, unit, className }: { coords: Coords; unit: Unit; className?: string }) {
  const [full, setFull] = useState(false);
  const hrefBase = useMemo(() => windyUrl(coords, unit, 8), [coords, unit]);
  const frameKey = `${coords.lat.toFixed(5)}:${coords.lon.toFixed(5)}:${unit}`;
  const href = `${hrefBase}&v=${encodeURIComponent(frameKey)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    if (full) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const frame = (
    <iframe
      key={frameKey}
      title="Radar Map"
      src={href}
      className="h-full w-full rounded-xl border border-white/10 shadow-xl"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );

  return (
    <>
      <div
        className={clsx("relative overflow-hidden rounded-xl", "bg-black/20 ring-1 ring-white/10", className)}
        style={{ height: "640px" }}
      >
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Open map in a new tab"
          >
            <ExternalLink className="h-4 w-4" /> New tab
          </a>
          <button
            onClick={() => setFull(true)}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Expand to full screen"
            aria-expanded={full}
          >
            <Maximize2 className="h-4 w-4" /> Expand
          </button>
        </div>
        <div className="absolute inset-0">{frame}</div>
      </div>
      {full && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            onClick={() => setFull(false)}
            className="absolute right-4 top-4 z-[101] inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            title="Close full-screen map"
          >
            <X className="h-4 w-4" /> Close
          </button>
          <div className="absolute inset-0 p-4 md:p-6 lg:p-8">
            <div className="h-full w-full overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
              <iframe
                key={`full-${frameKey}`}
                title="Radar Map (Full Screen)"
                src={href}
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================
   Main Page Component
   ========================= */

export default function Page() {
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [unit, setUnit] = useState<Unit>("imperial");
  const [query, setQuery] = useState("");
  const [activePlace, setActivePlace] = useState<{ name: string; admin1?: string; country?: string } | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  // A single state for all fetched weather data
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  // A single loading state and a single error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Geolocation specific loading/error states
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  // Abort controller for fetch requests
  const fetchControllerRef = useRef<AbortController | null>(null);

  // --- SIDE EFFECTS ---

  // Load initial state from localStorage and URL
  useEffect(() => {
    const savedUnit = localStorage.getItem("weatherUnit");
    if (savedUnit === "metric" || savedUnit === "imperial") {
      setUnit(savedUnit);
    }
    
    const usp = new URLSearchParams(window.location.search);
    const latStr = usp.get("lat");
    const lonStr = usp.get("lon");
    
    if (latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setCoords({ lat, lon });
        reverseLookup({ lat, lon });
        return;
      }
    }

    // Fallback to geolocation, then to default
    (async () => {
      const ok = await requestGeolocation(false);
      if (!ok) {
        setCoords(DEFAULT_CITY);
        setActivePlace(DEFAULT_CITY);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save unit to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("weatherUnit", unit);
  }, [unit]);
  
  // Keep URL shareable and up-to-date
  useEffect(() => {
    if (!coords) return;
    const usp = new URLSearchParams();
    usp.set("lat", String(coords.lat.toFixed(4)));
    usp.set("lon", String(coords.lon.toFixed(4)));
    router.replace(`?${usp.toString()}`, { scroll: false });
  }, [coords, router]);

  // Main data fetching effect
  useEffect(() => {
    if (!coords) return;

    async function fetchWeatherData() {
      setIsLoading(true);
      setError(null);
      
      // Abort previous request if it's still running
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = new AbortController();
      
      try {
        const res = await fetch(`/api/weather?lat=${coords!.lat}&lon=${coords!.lon}&unit=${unit}`, {
          signal: fetchControllerRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch data.");
        }

        const data: WeatherData = await res.json();
        setWeatherData(data);

      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchWeatherData();

    // Cleanup function to abort on component unmount
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [coords, unit]);


  // --- API CALLS (Client-side Geocoding) ---

  async function reverseLookup(c: Coords) {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("reverse geocode failed");
      const j = await res.json();
      const name = j.city || j.locality || "Your area";
      setActivePlace({ name, admin1: j.principalSubdivision, country: j.countryCode });
    } catch {
      // ignore; coords are still usable
    }
  }

  async function runSearch(query: string) {
    const raw = query.trim();
    if (!raw) return;

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(raw)}&count=1&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      const result = data?.results?.[0];
      if (!result) {
        setError(`No matches for "${raw}".`);
        return;
      }
      
      const c = { lat: result.latitude, lon: result.longitude };
      setActivePlace({ name: result.name, admin1: result.admin1, country: result.country_code });
      setCoords(c);
      setError(null);

    } catch (e: any) {
      setError(e.message || "Search error");
    }
  }
  
  async function requestGeolocation(userInitiated: boolean): Promise<boolean> {
     if (!navigator.geolocation) {
       setGeoError("Your browser doesn’t support location.");
       return false;
     }

     setGeoLoading(true);
     setGeoError(null);

     return new Promise((resolve) => {
       navigator.geolocation.getCurrentPosition(
         (pos) => {
           const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
           setCoords(c);
           reverseLookup(c);
           setGeoLoading(false);
           resolve(true);
         },
         (err) => {
           setGeoError("Could not get location. Please enable it in your browser settings.");
           setGeoLoading(false);
           resolve(false);
         },
         { timeout: 10000 }
       );
     });
   }

  // --- DERIVED STATE ---
  const placeLabel = useMemo(() => {
    if (!activePlace) return "Loading location...";
    return [activePlace.name, activePlace.admin1].filter(Boolean).join(", ");
  }, [activePlace]);

  const themeKey = useMemo<ThemeKey>(
    () => pickTheme(weatherData?.current?.weather_code ?? null, weatherData?.current?.time),
    [weatherData]
  );
  
  // --- RENDER ---
  return (
    <div className={clsx("relative min-h-screen text-slate-100 selection:bg-sky-300/40 bg-gradient-to-br transition-colors duration-1000", THEMES[themeKey])}>
      {/* Background Glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-20 -right-20 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(35% 35% at 50% 50%, rgba(56,189,248,0.25), transparent)" }}
          animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 -left-16 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(35% 35% at 50% 50%, rgba(99,102,241,0.18), transparent)" }}
          animate={{ y: [0, 24, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/60 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-sky-300" />
            <span className="font-semibold tracking-wide bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              AlWeather
            </span>
          </motion.div>
          
          <div className="ml-auto flex w-full max-w-md items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any city..."
                className="w-full rounded-lg bg-slate-900/60 px-3 py-1.5 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </form>
             <button
                onClick={() => requestGeolocation(true)}
                className="inline-flex items-center justify-center rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50"
                aria-label="Use my location"
                disabled={geoLoading}
              >
                {geoLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
              </button>
          </div>
          
          <div role="group" className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
            <button onClick={() => setUnit("imperial")} className={clsx("px-3 py-1.5 text-sm", unit === "imperial" ? "bg-sky-600" : "hover:bg-white/5")}>°F</button>
            <button onClick={() => setUnit("metric")} className={clsx("px-3 py-1.5 text-sm", unit === "metric" ? "bg-sky-600" : "hover:bg-white/5")}>°C</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{placeLabel}</h1>
        </div>

        {/* --- Global Error Display --- */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-center text-red-100 ring-1 ring-red-500/50">
            <p className="font-semibold">An error occurred:</p>
            <p>{error}</p>
          </div>
        )}

        {/* --- Loading Spinner --- */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-sky-300" />
          </div>
        )}

        {/* --- Weather Data Display --- */}
        {!isLoading && weatherData && coords && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column (Current, Hourly, Alerts) */}
            <div className="space-y-8 lg:col-span-2">
              <CurrentWeatherCard data={weatherData.current} unit={unit} />
              <HourlyForecast data={weatherData.hourly} unit={unit} />
              <AlertsPanel alerts={weatherData.alerts} />
            </div>

            {/* Right Column (Daily, Map) */}
            <div className="space-y-8">
              <DailyForecast data={weatherData.daily} unit={unit} />
              <MapPanel coords={coords} unit={unit} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}