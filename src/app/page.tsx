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
  Sun,
  AlertTriangle,
  LocateFixed,
} from "lucide-react";

/* =========================
   Types
   ========================= */

type Unit = "imperial" | "metric";

interface Coords {
  lat: number;
  lon: number;
}

interface LocationState {
  coords: Coords;
  name: string;
  admin1?: string;
  country?: string;
}

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
   Helpers
   ========================= */

const DEFAULT_CITY: LocationState = {
  name: "Huntsville",
  admin1: "Alabama",
  country: "US",
  coords: { lat: 34.7304, lon: -86.5861 },
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
  console.log("Windy map coords:", { lat, lon }); // Debug log
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
  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm">
        <p className="text-sm text-slate-300">No active weather alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Weather Alerts</h2>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded-xl bg-red-900/40 p-4 ring-1 ring-red-500/50"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-red-100">{alert.properties?.event || "Alert"}</h3>
          </div>
          <p className="mt-2 text-sm text-red-100">{alert.properties?.headline}</p>
          <p className="mt-1 text-xs text-red-200">{alert.properties?.areaDesc}</p>
          <p className="mt-2 text-sm text-red-100">{alert.properties?.description}</p>
          {alert.properties?.instruction && (
            <p className="mt-2 text-sm text-red-100">Instructions: {alert.properties.instruction}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Map Display ---
function MapPanel({ coords, unit }: { coords: Coords; unit: Unit }) {
  return (
    <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm">
      <h2 className="text-lg font-semibold mb-4">Weather Radar</h2>
      <iframe
        src={windyUrl(coords, unit)}
        className="w-full h-64 rounded-lg"
        title="Weather Radar Map"
        allow="geolocation"
      />
    </div>
  );
}

/* =========================
   Main Component
   ========================= */

export default function Page() {
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [unit, setUnit] = useState<Unit>("imperial");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const fetchControllerRef = useRef<AbortController | null>(null);

  // --- API CALLS (Client-side Geocoding) ---

  const navigateToLocation = (loc: LocationState, shouldPush: boolean) => {
    const usp = new URLSearchParams();
    usp.set("lat", loc.coords.lat.toFixed(4));
    usp.set("lon", loc.coords.lon.toFixed(4));
    const newUrl = `?${usp.toString()}`;

    if (shouldPush) {
      router.push(newUrl, { scroll: false });
    } else {
      router.replace(newUrl, { scroll: false });
    }
  };

  async function reverseLookup(c: Coords, isInitialLoad = false) {
    console.log("Reverse lookup coords:", c); // Debug log
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Reverse geocode failed.");
      const j = await res.json();
      const name = j.city || j.locality || "Your area";
      const newLocation = { coords: c, name, admin1: j.principalSubdivision, country: j.countryCode };
      setLocation(newLocation);
      console.log("Set location:", newLocation); // Debug log
      navigateToLocation(newLocation, !isInitialLoad);
    } catch (e: unknown) {
      console.error("Reverse geocoding error:", e);
      const newLocation = { coords: c, name: "Unknown location" };
      setLocation(newLocation);
      navigateToLocation(newLocation, !isInitialLoad);
    }
  }

  async function runSearch(query: string) {
    const raw = query.trim();
    if (!raw) {
      return;
    }

    setIsSearching(true);
    setGlobalError(null);
    setWeatherData(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
      if (!apiKey) {
        throw new Error("OpenWeatherMap API key is missing. Please contact support.");
      }
      const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(raw)}&limit=1&appid=${apiKey}`;      const res = await fetch(owmUrl);

      if (!res.ok) {
        const statusText = res.statusText || "Unknown error";
        throw new Error(`Geocoding search failed with status ${res.status}: ${statusText}. Please try again later.`);
      }
      const data = await res.json();

      if (!data || data.length === 0) {
        setGlobalError(`No matches found for "${raw}". Please try a different city.`);
        return;
      }

      const result = data[0];
      const newLocation = {
        coords: { lat: result.lat, lon: result.lon },
        name: result.name,
        admin1: result.state,
        country: result.country,
      };

      setLocation(newLocation);
      console.log("Search result:", newLocation); // Debug log
      navigateToLocation(newLocation, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Search error. Please try again.";
      setGlobalError(message);
      console.error("Search error:", e);
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  }

  async function requestGeolocation(): Promise<boolean> {
    if (!navigator.geolocation) {
      setGlobalError("Your browser doesn’t support geolocation. Please search for a city manually.");
      return false;
    }

    setGeoLoading(true);
    setGlobalError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          console.log("Geolocation success:", { lat: c.lat, lon: c.lon, accuracy: pos.coords.accuracy }); // Debug log
          if (pos.coords.accuracy > 1000) {
            console.warn("Low geolocation accuracy:", pos.coords.accuracy);
            setGlobalError("Location accuracy is low. Try enabling high-accuracy GPS or searching manually.");
          }
          reverseLookup(c, true);
          setGeoLoading(false);
          resolve(true);
        },
        (err) => {
          console.error("Geolocation error:", err);
          let errorMessage = "Could not get location. Please enable it in your browser settings or search manually.";
          if (err.message.includes("Permissions policy")) {
            errorMessage = "Geolocation is blocked by a permissions policy. Please enable location access in your browser settings or search manually.";
          }
          setGlobalError(errorMessage);
          setGeoLoading(false);
          resolve(false);
        },
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
      );
    });
  }

  // --- SIDE EFFECTS ---

  // Main data fetching effect
  useEffect(() => {
    if (!location) return;

    async function fetchAllData() {
      if (!location?.coords) return; // Additional null check for TypeScript
      setIsLoading(true);
      setGlobalError(null);
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = new AbortController();

      try {
        const res = await fetch(`/api/weather?lat=${location.coords.lat}&lon=${location.coords.lon}&unit=${unit}`, {
          signal: fetchControllerRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch weather data.");
        }

        const data: WeatherData = await res.json();
        setWeatherData(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setGlobalError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();

    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [location, unit]);

  // Load initial state from localStorage and URL, and handle location
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
        reverseLookup({ lat, lon }, true);
        return;
      }
    }

    (async () => {
      const isGeoSuccess = await requestGeolocation();
      if (!isGeoSuccess) {
        setLocation(DEFAULT_CITY);
        navigateToLocation(DEFAULT_CITY, false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps for mount-only effect; suppress ESLint warning

  // Save unit to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("weatherUnit", unit);
  }, [unit]);

  // --- DERIVED STATE ---
  const placeLabel = useMemo(() => {
    if (!location) return "Loading location...";
    return [location.name, location.admin1].filter(Boolean).join(", ");
  }, [location]);

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
            <form onSubmit={(e) => { e.preventDefault(); runSearch(query); }} className="relative w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any city..."
                className="w-full rounded-lg bg-slate-900/60 px-3 py-1.5 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-sky-300" />
              )}
            </form>
            <button
              onClick={() => requestGeolocation()}
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
        {globalError && (
          <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-center text-red-100 ring-1 ring-red-500/50">
            <p className="font-semibold">An error occurred:</p>
            <p>{globalError}</p>
          </div>
        )}

        {/* --- Loading Spinner --- */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-sky-300" />
          </div>
        )}

        {/* --- Weather Data Display --- */}
        {!isLoading && weatherData && location && (
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
              <MapPanel coords={location.coords} unit={unit} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}