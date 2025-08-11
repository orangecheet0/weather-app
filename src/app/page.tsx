"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  TriangleAlert,
} from "lucide-react";

// -----------------------------
// Types
// -----------------------------

type Unit = "imperial" | "metric";

interface Coords {
  lat: number;
  lon: number;
}

interface CurrentBlock {
  time: string;
  temperature: number;
  humidity: number | null;
  apparent: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  weatherCode: number | null;
}

interface DailyBlock {
  date: string;
  tmax: number | null;
  tmin: number | null;
  precipSum: number | null;
  weatherCode: number | null;
}

interface HourlyPoint {
  time: string;
  temperature: number | null;
  precipProb: number | null;
  weatherCode: number | null;
}

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

// -----------------------------
// Helpers
// -----------------------------

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

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric" });
}


function weatherIcon(code: number | null) {
  // Very compact mapping for demonstration
  if (code == null) return <Cloud className="h-6 w-6" aria-hidden />;
  if ([0].includes(code)) return <Sun className="h-6 w-6" aria-hidden />; // Clear
  if ([1, 2, 3].includes(code)) return <Cloud className="h-6 w-6" aria-hidden />; // Partly/Cloudy
  if ([45, 48].includes(code)) return <CloudFog className="h-6 w-6" aria-hidden />; // Fog
  if ([51, 53, 55, 61, 63, 65].includes(code)) return <CloudRain className="h-6 w-6" aria-hidden />; // Rain
  if ([80, 81, 82].includes(code)) return <CloudDrizzle className="h-6 w-6" aria-hidden />; // Showers
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow className="h-6 w-6" aria-hidden />; // Snow
  if ([95, 96, 99].includes(code)) return <CloudLightning className="h-6 w-6" aria-hidden />; // Thunder
  return <Cloud className="h-6 w-6" aria-hidden />;
}

function windyEmbedUrl(c: Coords, unit: Unit) {
  // Uses documented embed params for units
  const base = "https://embed.windy.com/embed2.html";
  const params = new URLSearchParams({
    lat: String(c.lat),
    lon: String(c.lon),
    detailLat: String(c.lat),
    detailLon: String(c.lon),
    zoom: "7",
    level: "surface",
    overlay: "radar",
    product: "radar",
    menu: "false",
    message: "true",
    marker: "true",
    calendar: "now",
    pressure: "true",
    type: "map",
    location: "coordinates",
    detail: "true",
    metricWind: unit === "imperial" ? "mph" : "kph",
    metricTemp: unit === "imperial" ? "F" : "C",
  }).toString();
  return `${base}?${params}`;
}

// -----------------------------
// Main Component
// -----------------------------

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [unit, setUnit] = useState<Unit>(() => (searchParams.get("u") === "metric" ? "metric" : "imperial"));
  const [query, setQuery] = useState("");
  const [activePlace, setActivePlace] = useState<{ name: string; admin1?: string; country?: string } | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  // Panels state
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingHourly, setLoadingHourly] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const [current, setCurrent] = useState<CurrentBlock | null>(null);
  const [daily, setDaily] = useState<DailyBlock[]>([]);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  // AbortControllers for cancellation
  const ctrlGeo = useRef<AbortController | null>(null);
  const ctrlForecast = useRef<AbortController | null>(null);
  const ctrlAlerts = useRef<AbortController | null>(null);

  // -------------
  // Boot
  // -------------
  useEffect(() => {
    // 1) From URL ?lat=..&lon=..&u=..
    const latStr = searchParams.get("lat");
    const lonStr = searchParams.get("lon");
    if (latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setCoords({ lat, lon });
        reverseLookup({ lat, lon });
        return;
      }
    }

    // 2) Try geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setCoords(c);
          reverseLookup(c);
        },
        () => {
          // 3) Fallback
          setCoords({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
          setActivePlace({ name: DEFAULT_CITY.name, admin1: DEFAULT_CITY.admin1, country: DEFAULT_CITY.country });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCoords({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
      setActivePlace({ name: DEFAULT_CITY.name, admin1: DEFAULT_CITY.admin1, country: DEFAULT_CITY.country });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------
  // Keep URL shareable
  // -------------
  useEffect(() => {
    if (!coords) return;
    const usp = new URLSearchParams(window.location.search);
    usp.set("lat", String(coords.lat.toFixed(4)));
    usp.set("lon", String(coords.lon.toFixed(4)));
    usp.set("u", unit);
    router.replace(`?${usp.toString()}`);
  }, [coords, unit, router]);

  // -------------
  // Forecast fetching (re-runs on unit or coords change)
  // -------------
  useEffect(() => {
    if (!coords) return;
    fetchForecast(coords, unit);
  }, [coords, unit]);

  // -------------
  // Alerts (best effort; CORS may block in some regions)
  // -------------
  useEffect(() => {
    if (!coords) return;
    fetchAlerts(coords);
  }, [coords]);

  // -----------------------------
  // API calls
  // -----------------------------

  async function reverseLookup(c: Coords) {
    try {
      ctrlGeo.current?.abort();
      ctrlGeo.current = new AbortController();
      const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${c.lat}&longitude=${c.lon}&language=en&format=json`;
      const res = await fetch(url, { signal: ctrlGeo.current.signal });
      const data = await res.json();
      const first = data?.results?.[0];
      if (first) setActivePlace({ name: first.name, admin1: first.admin1, country: first.country_code });
    } catch { /* ignore */ }
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    try {
      setError(null);
      ctrlGeo.current?.abort();
      ctrlGeo.current = new AbortController();
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
      const res = await fetch(url, { signal: ctrlGeo.current.signal });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) {
        setError("No matches. Try a city + state, like \"Huntsville, AL\".");
        return;
      }
      setActivePlace({ name: first.name, admin1: first.admin1, country: first.country_code });
      setCoords({ lat: first.latitude, lon: first.longitude });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Search error";
      setError(message);
    }
  }

  async function fetchForecast(c: Coords, unit: Unit) {
    try {
      setLoadingCurrent(true);
      setLoadingDaily(true);
      setLoadingHourly(true);
      setError(null);

      ctrlForecast.current?.abort();
      ctrlForecast.current = new AbortController();

      const temperature_unit = unit === "imperial" ? "fahrenheit" : "celsius";
      const wind_speed_unit = unit === "imperial" ? "mph" : "kmh";
      const precipitation_unit = unit === "imperial" ? "inch" : "mm";

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(c.lat),
        longitude: String(c.lon),
        timezone: "auto",
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "precipitation",
          "wind_speed_10m",
          "wind_gusts_10m",
          "weather_code",
        ].join(","),
        hourly: ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
        daily: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "weather_code"].join(","),
        forecast_days: "7",
        temperature_unit,
        wind_speed_unit,
        precipitation_unit,
      }).toString();

      const res = await fetch(url.toString(), { signal: ctrlForecast.current.signal });
      if (!res.ok) throw new Error("Forecast failed");
      const data = await res.json();

      // Current
      setCurrent({
        time: data?.current?.time,
        temperature: data?.current?.temperature_2m ?? null,
        humidity: data?.current?.relative_humidity_2m ?? null,
        apparent: data?.current?.apparent_temperature ?? null,
        precipitation: data?.current?.precipitation ?? null,
        windSpeed: data?.current?.wind_speed_10m ?? null,
        windGust: data?.current?.wind_gusts_10m ?? null,
        weatherCode: data?.current?.weather_code ?? null,
      });
      setLoadingCurrent(false);

      // Daily
      const d: DailyBlock[] = (data?.daily?.time || []).map((t: string, i: number) => ({
        date: t,
        tmax: data?.daily?.temperature_2m_max?.[i] ?? null,
        tmin: data?.daily?.temperature_2m_min?.[i] ?? null,
        precipSum: data?.daily?.precipitation_sum?.[i] ?? null,
        weatherCode: data?.daily?.weather_code?.[i] ?? null,
      }));
      setDaily(d);
      setLoadingDaily(false);

      // Hourly (next 48 hours)
      const hours: HourlyPoint[] = (data?.hourly?.time || [])
        .map((t: string, i: number) => ({
          time: t,
          temperature: data?.hourly?.temperature_2m?.[i] ?? null,
          precipProb: data?.hourly?.precipitation_probability?.[i] ?? null,
          weatherCode: data?.hourly?.weather_code?.[i] ?? null,
        }))
        .slice(0, 48);
      setHourly(hours);
      setLoadingHourly(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to load forecast";
      setError(message);
      setLoadingCurrent(false);
      setLoadingDaily(false);
      setLoadingHourly(false);
    }
  }

  async function fetchAlerts(c: Coords) {
    try {
      setLoadingAlerts(true);
      setAlertError(null);
      ctrlAlerts.current?.abort();
      ctrlAlerts.current = new AbortController();
      const url = `https://api.weather.gov/alerts/active?point=${c.lat},${c.lon}`;
      const res = await fetch(url, {
        // Note: browsers can't set a custom User-Agent; NWS works without it for most requests.
        headers: { Accept: "application/geo+json" },
        signal: ctrlAlerts.current.signal,
      });
      if (!res.ok) throw new Error("Alerts unavailable");
      const data = await res.json();
      type NWSFeature = { id?: string; properties?: { event?: string; headline?: string; severity?: string; effective?: string; ends?: string; description?: string; instruction?: string; areaDesc?: string; }; };
      const items: AlertItem[] = (Array.isArray(data?.features) ? data.features : []).map((f: NWSFeature) => ({
        id: f?.id || f?.properties?.id || crypto.randomUUID(),
        event: f?.properties?.event,
        headline: f?.properties?.headline,
        severity: f?.properties?.severity,
        effective: f?.properties?.effective,
        ends: f?.properties?.ends,
        description: f?.properties?.description,
        instruction: f?.properties?.instruction,
        areaDesc: f?.properties?.areaDesc,
      }));
      setAlerts(items);
      setLoadingAlerts(false);
    } catch {
      setAlertError("Weather alerts are currently unavailable. Try again later.");
      setLoadingAlerts(false);
    }
  }

  // -----------------------------
  // UI bits
  // -----------------------------

  const placeLabel = useMemo(() => {
    if (!activePlace) return "";
    const parts = [activePlace.name, activePlace.admin1, activePlace.country].filter(Boolean);
    return parts.join(", ");
  }, [activePlace]);

  const [tab, setTab] = useState<"now" | "hours" | "radar" | "alerts">("now");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/60 border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
            <Sun className="h-6 w-6" aria-hidden />
            <span className="font-semibold tracking-wide">AlWeather</span>
          </motion.div>
          <div className="ml-auto flex items-center gap-2 w-full max-w-xl">
            <label htmlFor="city" className="sr-only">Search city</label>
            <input
              id="city"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search city (e.g., Huntsville, AL)"
              className="w-full rounded-xl bg-slate-800/70 ring-1 ring-slate-700 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              onClick={runSearch}
              aria-label="Search"
              className="inline-flex items-center justify-center rounded-xl ring-1 ring-slate-700 px-3 py-2 hover:bg-slate-800/80"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
            <div role="group" aria-label="Unit" className="hidden sm:flex rounded-xl overflow-hidden ring-1 ring-slate-700">
              <button
                onClick={() => setUnit("imperial")}
                className={clsx(
                  "px-3 py-2 text-sm",
                  unit === "imperial" ? "bg-sky-600 text-white" : "bg-slate-800/60 hover:bg-slate-800"
                )}
                aria-pressed={unit === "imperial"}
              >
                °F / mph
              </button>
              <button
                onClick={() => setUnit("metric")}
                className={clsx(
                  "px-3 py-2 text-sm",
                  unit === "metric" ? "bg-sky-600 text-white" : "bg-slate-800/60 hover:bg-slate-800"
                )}
                aria-pressed={unit === "metric"}
              >
                °C / km/h
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main id="content" className="mx-auto max-w-6xl px-4 pb-16">
        {/* Location crumb */}
        <div className="flex items-center gap-2 pt-6 text-slate-300">
          <MapPin className="h-4 w-4" aria-hidden />
          <span className="text-sm">{placeLabel || "Locating..."}</span>
        </div>

        {/* Tabs */}
        <div className="mt-4 inline-flex rounded-2xl ring-1 ring-slate-800 overflow-hidden">
          {(
            [
              { id: "now", label: "Now" },
              { id: "hours", label: "Next 48h" },
              { id: "radar", label: "Radar" },
              { id: "alerts", label: "Alerts" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "px-4 py-2 text-sm",
                tab === t.id ? "bg-sky-600 text-white" : "bg-slate-900 hover:bg-slate-800"
              )}
              aria-pressed={tab === t.id}
              aria-controls={`panel-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panels */}
        {/* NOW */}
        {tab === "now" && (
          <section id="panel-now" className="mt-6 grid gap-6 md:grid-cols-3">
            {/* Current big card */}
            <Card>
              {loadingCurrent ? (
                <Skeleton lines={6} />
              ) : current ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    {weatherIcon(current.weatherCode)}
                    <h2 className="text-lg font-semibold">Current conditions</h2>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-5xl font-bold tracking-tight">{formatTemp(current.temperature, unit)}</span>
                    <span className="text-slate-400">feels like {formatTemp(current.apparent, unit)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Metric icon={<Thermometer className="h-4 w-4" />} label="Humidity" value={current.humidity != null ? `${Math.round(current.humidity)}%` : "—"} />
                    <Metric icon={<Droplets className="h-4 w-4" />} label="Precip" value={current.precipitation != null ? `${current.precipitation}` + (unit === "imperial" ? " in" : " mm") : "—"} />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={formatWind(current.windSpeed, unit)} />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Gusts" value={formatWind(current.windGust, unit)} />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-rose-300">{error}</p>
                  )}
                </div>
              ) : (
                <Empty label="No data" />
              )}
            </Card>

            {/* 7-day forecast */}
            <Card className="md:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <Cloud className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-semibold">7‑day forecast</h2>
              </div>
              {loadingDaily ? (
                <Skeleton lines={5} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {daily.map((d) => (
                    <div key={d.date} className="rounded-xl bg-slate-800/40 p-3 ring-1 ring-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 text-sm">{shortDate(d.date)}</span>
                        {weatherIcon(d.weatherCode)}
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-xl font-semibold">{formatTemp(d.tmax, unit)}</span>
                        <span className="text-slate-400">{formatTemp(d.tmin, unit)}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Precip: {d.precipSum != null ? (unit === "imperial" ? `${d.precipSum.toFixed(2)} in` : `${d.precipSum.toFixed(1)} mm`) : "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* HOURS */}
        {tab === "hours" && (
          <section id="panel-hours" className="mt-6">
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <ClockIcon />
                <h2 className="text-lg font-semibold">Next 48 hours</h2>
              </div>
              {loadingHourly ? (
                <Skeleton lines={10} />
              ) : (
                <ul className="divide-y divide-slate-800">
                  {hourly.map((h) => (
                    <li key={h.time} className="flex items-center gap-4 py-2">
                      <span className="w-24 text-sm text-slate-300">{shortTime(h.time)}</span>
                      <span className="w-24">{formatTemp(h.temperature, unit)}</span>
                      <span className="w-24 text-sm text-slate-400">{h.precipProb != null ? `${h.precipProb}%` : "—"} precip</span>
                      <span className="flex-1" aria-hidden>
                        <div className="h-1 rounded bg-slate-800">
                          <div
                            className="h-1 rounded bg-sky-500"
                            style={{ width: `${Math.min(100, Math.max(0, h.precipProb ?? 0))}%` }}
                          />
                        </div>
                      </span>
                      <span className="ml-auto">{weatherIcon(h.weatherCode)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        )}

        {/* RADAR */}
        {tab === "radar" && (
          <section id="panel-radar" className="mt-6">
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <CloudRain className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-semibold">Live radar (Windy)</h2>
              </div>
              {!coords ? (
                <Skeleton lines={8} />
              ) : (
                <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-slate-800">
                  <iframe
                    title="Radar"
                    className="h-full w-full"
                    src={windyEmbedUrl(coords, unit)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </Card>
          </section>
        )}

        {/* ALERTS */}
        {tab === "alerts" && (
          <section id="panel-alerts" className="mt-6">
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <TriangleAlert className="h-5 w-5 text-amber-400" aria-hidden />
                <h2 className="text-lg font-semibold">Active alerts</h2>
              </div>
              {loadingAlerts ? (
                <Skeleton lines={6} />
              ) : alertError ? (
                <p className="text-sm text-rose-300">{alertError}</p>
              ) : alerts.length === 0 ? (
                <p className="text-sm text-slate-300">No active alerts for this location.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {alerts.map((a) => (
                    <details key={a.id} className="group rounded-xl bg-slate-800/40 ring-1 ring-slate-800">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                        <span className={clsx(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          chipColor(a.severity)
                        )}>
                          {a.severity || "Unknown"}
                        </span>
                        <span className="font-medium">{a.event}</span>
                        <span className="ml-auto text-xs text-slate-400">{a.effective ? new Date(a.effective).toLocaleString() : ""}</span>
                      </summary>
                      <div className="px-4 pb-4 text-sm text-slate-200">
                        {a.headline && <p className="mb-2 font-semibold">{a.headline}</p>}
                        {a.areaDesc && <p className="mb-2 text-slate-300">Areas: {a.areaDesc}</p>}
                        {a.description && (
                          <p className="whitespace-pre-wrap text-slate-200">{a.description}</p>
                        )}
                        {a.instruction && (
                          <p className="mt-2 whitespace-pre-wrap font-medium">{a.instruction}</p>
                        )}
                        {a.ends && (
                          <p className="mt-2 text-xs text-slate-400">Ends: {new Date(a.ends).toLocaleString()}</p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-slate-500">
          Data: Open‑Meteo (forecast, geocoding). Alerts: NWS (best‑effort). UI built for speed & clarity.
        </p>
      </main>
    </div>
  );
}

// -----------------------------
// Small components
// -----------------------------

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-2xl bg-slate-900/70 p-4 ring-1 ring-slate-800 shadow-xl shadow-slate-950/30", className)}>
      {children}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2 ring-1 ring-slate-800">
      {icon}
      <div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-slate-800/60 mb-2" />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-300">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function chipColor(sev?: string) {
  const s = (sev || "").toLowerCase();
  if (s.includes("extreme") || s.includes("severe")) return "bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/30";
  if (s.includes("moderate")) return "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30";
  if (s.includes("minor")) return "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30";
  return "bg-slate-700/30 text-slate-200 ring-1 ring-slate-600/40";
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="currentColor" d="M12 1.75A10.25 10.25 0 1 0 22.25 12 10.262 10.262 0 0 0 12 1.75Zm.75 5a.75.75 0 0 0-1.5 0v5.19l-3.1 1.79a.75.75 0 1 0 .75 1.3l3.35-1.94A.75.75 0 0 0 12.75 12Z" />
    </svg>
  );
}
