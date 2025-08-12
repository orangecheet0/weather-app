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
   Types
   ========================= */

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

/* =========================
   Helpers
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

// Local-safe date label so daily dates aren’t off by one
function shortDate(isoOrYmd: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    const dt = new Date(y, m - 1, d); // local midnight
    return dt.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
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
  const temp = unit === "imperial" ? "F" : "C";
  const wind = unit === "imperial" ? "mph" : "km/h";
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    detailLat: String(lat),
    detailLon: String(lon),
    zoom: String(zoom),
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
    metricWind: wind,
    metricTemp: temp,
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

/* ===== Background theme (time+weather aware) ===== */

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

/* ===== US state helpers for "City, State" search disambiguation ===== */

const US_STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
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
   Full-screen Radar Panel
   ========================= */

function MapPanel({
  coords,
  unit,
  className,
}: {
  coords: Coords;
  unit: Unit;
  className?: string;
}) {
  const [full, setFull] = useState(false);
  const href = useMemo(() => windyUrl(coords, unit, 8), [coords, unit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    if (full) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const frame = (
    <iframe
      title="Radar Map"
      src={href}
      className="w-full h-full rounded-xl border border-white/10 shadow-xl"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );

  return (
    <>
      <div
        className={clsx("relative rounded-xl overflow-hidden", "bg-black/20 ring-1 ring-white/10", className)}
        style={{ height: "640px" }}
      >
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Open map in a new tab"
          >
            <ExternalLink className="h-4 w-4" />
            New tab
          </a>
          <button
            onClick={() => setFull(true)}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Expand to full screen"
            aria-expanded={full}
          >
            <Maximize2 className="h-4 w-4" />
            Expand
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
            <X className="h-4 w-4" />
            Close
          </button>
          <div className="absolute inset-0 p-4 md:p-6 lg:p-8">
            <div className="h-full w-full rounded-2xl ring-1 ring-white/10 overflow-hidden bg-black/40">
              <iframe
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
   Main Page
   ========================= */

export default function Page() {
  const router = useRouter();

  const [unit, setUnit] = useState<Unit>("imperial");
  const [query, setQuery] = useState("");
  const [activePlace, setActivePlace] = useState<{ name: string; admin1?: string; country?: string } | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  // Loading state
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingHourly, setLoadingHourly] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const [current, setCurrent] = useState<CurrentBlock | null>(null);
  const [daily, setDaily] = useState<DailyBlock[]>([]);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Geolocation/alerts
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  // Sharing & tabs
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"now" | "hours" | "radar" | "alerts">("now");

  // AbortControllers
  const ctrlGeo = useRef<AbortController | null>(null);
  const ctrlForecast = useRef<AbortController | null>(null);
  const ctrlAlerts = useRef<AbortController | null>(null);

  /* ----- Boot ----- */
  useEffect(() => {
    const usp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const uParam = usp?.get("u");
    if (uParam === "metric" || uParam === "imperial") setUnit(uParam);

    // 1) From URL ?lat=..&lon=..
    const latStr = usp?.get("lat");
    const lonStr = usp?.get("lon");
    if (latStr && lonStr) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const c = { lat, lon };
        setCoords(c);
        reverseLookup(c);
        return;
      }
    }

    // 2) Try geolocation; if it doesn't succeed, fallback to default (Huntsville)
    (async () => {
      const ok = await requestGeolocation(false);
      if (!ok) {
        setCoords({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
        setActivePlace({ name: DEFAULT_CITY.name, admin1: DEFAULT_CITY.admin1, country: DEFAULT_CITY.country });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----- Keep URL shareable ----- */
  useEffect(() => {
    if (!coords) return;
    const usp = new URLSearchParams(window.location.search);
    usp.set("lat", String(coords.lat.toFixed(4)));
    usp.set("lon", String(coords.lon.toFixed(4)));
    usp.set("u", unit);
    router.replace(`?${usp.toString()}`);
  }, [coords, unit, router]);

  /* ----- Forecast fetching ----- */
  useEffect(() => {
    if (!coords) return;
    fetchForecast(coords, unit);
  }, [coords, unit]);

  /* ----- Alerts ----- */
  useEffect(() => {
    if (!coords) return;
    fetchAlerts(coords);
  }, [coords]);

  /* =========================
     API calls
     ========================= */

  async function reverseLookup(c: Coords) {
    try {
      ctrlGeo.current?.abort();
      ctrlGeo.current = new AbortController();
      const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${c.lat}&longitude=${c.lon}&language=en&format=json`;
      const res = await fetch(url, { signal: ctrlGeo.current.signal });
      const data = await res.json();
      const first = data?.results?.[0];
      if (first) setActivePlace({ name: first.name, admin1: first.admin1, country: first.country_code });
    } catch {
      // ignore
    }
  }

  // Enter submits
  function onSubmitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    runSearch();
  }

  // City, State aware search
  async function runSearch() {
    const raw = query.trim();
    if (!raw) return;

    try {
      ctrlGeo.current?.abort();
      ctrlGeo.current = new AbortController();

      let city = raw;
      let desiredState: string | null = null;

      const commaIdx = raw.indexOf(",");
      if (commaIdx > -1) {
        city = raw.slice(0, commaIdx).trim();
        const statePart = raw.slice(commaIdx + 1).trim();
        desiredState = resolveStateName(statePart);
      } else {
        const parts = raw.split(/\s+/);
        if (parts.length >= 2) {
          const maybeState = parts[parts.length - 1];
          const resolved = resolveStateName(maybeState);
          if (resolved) {
            desiredState = resolved;
            city = parts.slice(0, -1).join(" ");
          }
        }
      }

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=10&language=en&format=json`;
      const res = await fetch(url, { signal: ctrlGeo.current.signal });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      type GeoResult = {
        name: string;
        latitude: number;
        longitude: number;
        country_code?: string;
        country?: string;
        admin1?: string;
        population?: number | null;
      };

      const results: GeoResult[] = Array.isArray(data?.results) ? data.results : [];
      if (results.length === 0) {
        setGeoError(`No matches. Try a city + state, like "Huntsville, AL".`);
        return;
      }

      const us = results.filter((r) => r.country_code === "US");
      let pick: GeoResult | undefined;

      if (desiredState) {
        const pool = us.length ? us : results;
        const stateMatches = pool.filter((r) => norm(r.admin1 || "") === norm(desiredState as string));
        pick = stateMatches.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
        if (!pick) {
          setGeoError(`No city "${city}" found in ${desiredState}.`);
          return;
        }
      } else {
        pick = (us.length ? us : results).sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
      }

      setActivePlace({ name: pick.name, admin1: pick.admin1, country: pick.country_code });
      setCoords({ lat: pick.latitude, lon: pick.longitude });
      setGeoError(null);
      setGeoNotice(null);
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Search error");
    }
  }

  // Try IP-based geolocation as a backup (HTTPS, no key required)
  async function ipGeoGuess(): Promise<boolean> {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) return false;
      const j = await res.json();
      const lat = Number(j?.latitude);
      const lon = Number(j?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

      setCoords({ lat, lon });
      setActivePlace({
        name: j?.city || "Your area",
        admin1: j?.region || undefined,
        country: j?.country_code || undefined,
      });
      setGeoNotice("Using approximate location based on your IP (may be off by ~25–50 miles).");
      return true;
    } catch {
      return false;
    }
  }

  // Robust geolocation: returns true/false so we can fallback cleanly
  async function requestGeolocation(userInitiated: boolean): Promise<boolean> {
    if (!window.isSecureContext) {
      setGeoError("Location requires HTTPS. Please use https://alweather.org");
      return false;
    }
    if (!navigator.geolocation) {
      setGeoError("Your browser doesn’t support location.");
      return false;
    }

    setGeoLoading(true);
    setGeoError(null);
    setGeoNotice(null);

    const result = await new Promise<boolean>((resolve) => {
      const success = (pos: GeolocationPosition) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        reverseLookup(c);
        setGeoLoading(false);
        setGeoError(null);
        setGeoNotice(null);
        resolve(true);
      };

      const finalFail = async (err: GeolocationPositionError) => {
        // Try IP fallback before giving up
        const usedIp = await ipGeoGuess();
        setGeoLoading(false);
        if (usedIp) {
          resolve(true);
          return;
        }

        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError(
              userInitiated
                ? "Location permission denied. Enable it in your browser settings for alweather.org."
                : "We couldn’t access your location. Tap “Use my location” and allow permission."
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError("Location unavailable. Try again or check your device’s location services.");
            break;
          case err.TIMEOUT:
          default:
            setGeoError("Timed out getting location. Try again.");
        }
        resolve(false);
      };

      const firstOpts: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 };
      const secondOpts: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

      navigator.geolocation.getCurrentPosition(
        success,
        (err) => {
          if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
            // Retry once with high-accuracy
            navigator.geolocation.getCurrentPosition(success, finalFail, secondOpts);
          } else {
            finalFail(err);
          }
        },
        firstOpts
      );
    });

    return result;
  }

  async function fetchForecast(c: Coords, unit: Unit) {
    try {
      setLoadingCurrent(true);
      setLoadingDaily(true);
      setLoadingHourly(true);

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

      const d: DailyBlock[] = (data?.daily?.time || []).map((t: string, i: number) => ({
        date: t,
        tmax: data?.daily?.temperature_2m_max?.[i] ?? null,
        tmin: data?.daily?.temperature_2m_min?.[i] ?? null,
        precipSum: data?.daily?.precipitation_sum?.[i] ?? null,
        weatherCode: data?.daily?.weather_code?.[i] ?? null,
      }));
      setDaily(d);
      setLoadingDaily(false);

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
      setLoadingCurrent(false);
      setLoadingDaily(false);
      setLoadingHourly(false);
    }
  }

  async function fetchAlerts(c: Coords) {
    try {
      setLoadingAlerts(true);
      ctrlAlerts.current?.abort();
      ctrlAlerts.current = new AbortController();
      const url = `https://api.weather.gov/alerts/active?point=${c.lat},${c.lon}`;
      const res = await fetch(url, {
        headers: { Accept: "application/geo+json" },
        signal: ctrlAlerts.current.signal,
      });
      if (!res.ok) throw new Error("Alerts unavailable");
      const data = await res.json();

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

      const items: AlertItem[] = (Array.isArray(data?.features) ? data.features : []).map((f: NWSFeature) => ({
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
      setAlerts(items);
      setLoadingAlerts(false);
    } catch {
      setAlerts([]);
      setLoadingAlerts(false);
    }
  }

  /* =========================
     Derived
     ========================= */

  const placeLabel = useMemo(() => {
    if (!activePlace) return "";
    const parts = [activePlace.name, activePlace.admin1, activePlace.country].filter(Boolean);
    return parts.join(", ");
  }, [activePlace]);

  const themeKey = useMemo<ThemeKey>(() => pickTheme(current?.weatherCode ?? null, current?.time), [current]);
  const today = daily[0];
  const nextHour = hourly[0];

  /* =========================
     UI
     ========================= */

  return (
    <div className={clsx("relative min-h-screen text-slate-100 selection:bg-sky-300/40 bg-gradient-to-br", THEMES[themeKey])}>
      {/* soft animated glows */}
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
      <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/60 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-sky-300" aria-hidden />
            <span className="font-semibold tracking-wide bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              AlWeather
            </span>
          </motion.div>

          <div className="ml-auto flex items-center gap-2 w-full max-w-2xl">
            {/* Search form – Enter submits */}
            <form onSubmit={onSubmitSearch} className="flex items-center gap-2 w-full">
              <label htmlFor="city" className="sr-only">
                Search city
              </label>
              <input
                id="city"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city (e.g., Huntsville, AL)"
                className="w-full rounded-xl bg-slate-900/60 ring-1 ring-white/10 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                aria-label="Search"
                disabled={!query.trim()}
                className="inline-flex items-center justify-center rounded-xl ring-1 ring-white/10 px-3 py-2 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="h-5 w-5" aria-hidden />
              </button>
            </form>

            {/* Use my location */}
            <button
              onClick={async () => {
                const ok = await requestGeolocation(true);
                if (!ok && !coords) {
                  setCoords({ lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon });
                  setActivePlace({ name: DEFAULT_CITY.name, admin1: DEFAULT_CITY.admin1, country: DEFAULT_CITY.country });
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl ring-1 ring-white/10 px-3 py-2 hover:bg-white/5"
              aria-label="Use my location"
              disabled={geoLoading}
            >
              {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              <span className="text-sm">{geoLoading ? "Locating..." : "Use my location"}</span>
            </button>

            {/* Unit toggle */}
            <div role="group" aria-label="Unit" className="hidden sm:flex rounded-xl overflow-hidden ring-1 ring-white/10">
              <button
                onClick={() => setUnit("imperial")}
                className={clsx("px-3 py-2 text-sm", unit === "imperial" ? "bg-sky-600 text-white" : "bg-slate-900/60 hover:bg-white/5")}
                aria-pressed={unit === "imperial"}
              >
                °F / mph
              </button>
              <button
                onClick={() => setUnit("metric")}
                className={clsx("px-3 py-2 text-sm", unit === "metric" ? "bg-sky-600 text-white" : "bg-slate-900/60 hover:bg-white/5")}
                aria-pressed={unit === "metric"}
              >
                °C / km/h
              </button>
            </div>

            {/* Share */}
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                } catch {}
              }}
              className="hidden md:inline-flex items-center gap-2 rounded-xl ring-1 ring-white/10 px-3 py-2 hover:bg-white/5"
              aria-label="Copy share link"
            >
              <Share2 className="h-4 w-4" />
              <span className="text-sm">{copied ? "Copied!" : "Share"}</span>
            </button>
          </div>
        </div>

        {/* Geolocation banners */}
        {geoError && (
          <div className="mx-auto max-w-6xl px-4 pb-3 -mt-2">
            <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-3 py-2 text-rose-100 text-sm" role="status" aria-live="polite">
              {geoError}
            </div>
          </div>
        )}
        {geoNotice && (
          <div className="mx-auto max-w-6xl px-4 pb-3 -mt-2">
            <div className="flex items-center gap-2 rounded-xl bg-sky-500/10 ring-1 ring-sky-400/30 px-3 py-2 text-sky-100 text-sm">
              <Info className="h-4 w-4" />
              <span>{geoNotice}</span>
            </div>
          </div>
        )}
      </header>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 mt-3">
          <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 px-3 py-2 text-amber-100">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              <span className="font-semibold">{alerts.length}</span> active alert{alerts.length > 1 ? "s" : ""} near{" "}
              {placeLabel || "your location"}. Check the Alerts tab for details.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-8">
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-white/10 bg-white/5">
          {/* subtle motion aura */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(2,132,199,0.25), transparent)" }}
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="relative grid gap-6 p-6 md:grid-cols-2 md:items-center">
            {/* Left: current summary */}
            <div>
              <div className="flex items-center gap-2 text-slate-300">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{placeLabel || "Locating..."}</span>
              </div>

              {loadingCurrent ? (
                <div className="mt-3">
                  <Skeleton lines={3} />
                </div>
              ) : current ? (
                <div className="mt-2">
                  <div className="flex items-end gap-4">
                    <span className="text-6xl md:text-7xl font-bold tracking-tight drop-shadow-sm">
                      {formatTemp(current.temperature, unit)}
                    </span>
                    <div className="text-slate-200">
                      <div className="flex items-center gap-2">
                        {weatherIcon(current.weatherCode)}
                        <span className="text-sm">Feels like {formatTemp(current.apparent, unit)}</span>
                      </div>
                      {today && (
                        <div className="mt-1 text-sm text-slate-200/90 flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <ArrowUp className="h-4 w-4" /> {formatTemp(today.tmax, unit)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ArrowDown className="h-4 w-4" /> {formatTemp(today.tmin, unit)}
                          </span>
                          {typeof nextHour?.precipProb === "number" && <span>{nextHour.precipProb}% precip next hr</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Metric
                      icon={<Thermometer className="h-4 w-4" />}
                      label="Humidity"
                      value={current.humidity != null ? `${Math.round(current.humidity)}%` : "—"}
                    />
                    <Metric
                      icon={<Droplets className="h-4 w-4" />}
                      label="Precip"
                      value={current.precipitation != null ? `${current.precipitation}${unit === "imperial" ? " in" : " mm"}` : "—"}
                    />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={formatWind(current.windSpeed, unit)} />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Gusts" value={formatWind(current.windGust, unit)} />
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Empty label="No data" />
                </div>
              )}
            </div>

            {/* Right: radar preview big */}
            <div>{coords ? <MapPanel coords={coords} unit={unit} /> : <Skeleton lines={8} />}</div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mx-auto max-w-6xl px-4 mt-6 inline-flex rounded-2xl ring-1 ring-white/10 overflow-hidden">
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
            className={clsx("px-4 py-2 text-sm", tab === t.id ? "bg-sky-600 text-white" : "bg-slate-900/60 hover:bg-white/5")}
            aria-pressed={tab === t.id}
            aria-controls={`panel-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <main id="content" className="mx-auto max-w-6xl px-4 pb-16">
        {/* NOW */}
        {tab === "now" && (
          <section id="panel-now" className="mt-6 grid gap-6 md:grid-cols-3">
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
                    <span className="text-slate-200">feels like {formatTemp(current.apparent, unit)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Metric icon={<Thermometer className="h-4 w-4" />} label="Humidity" value={current.humidity != null ? `${Math.round(current.humidity)}%` : "—"} />
                    <Metric icon={<Droplets className="h-4 w-4" />} label="Precip" value={current.precipitation != null ? `${current.precipitation}${unit === "imperial" ? " in" : " mm"}` : "—"} />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Wind" value={formatWind(current.windSpeed, unit)} />
                    <Metric icon={<Wind className="h-4 w-4" />} label="Gusts" value={formatWind(current.windGust, unit)} />
                  </div>
                </div>
              ) : (
                <Empty label="No data" />
              )}
            </Card>

            {/* 7-day forecast */}
            <Card className="md:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <Cloud className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-semibold">7-day forecast</h2>
              </div>
              {loadingDaily ? (
                <Skeleton lines={5} />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {daily.map((d, i) => (
                    <div key={d.date} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 hover:bg-white/10 transition">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 text-sm">{i === 0 ? "Today" : shortDate(d.date)}</span>
                        {weatherIcon(d.weatherCode)}
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="text-xl font-semibold">{formatTemp(d.tmax, unit)}</span>
                        <span className="text-slate-300">{formatTemp(d.tmin, unit)}</span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1">
                        Precip:{" "}
                        {d.precipSum != null
                          ? unit === "imperial"
                            ? `${d.precipSum.toFixed(2)} in`
                            : `${d.precipSum.toFixed(1)} mm`
                          : "—"}
                      </div>
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
                <ul className="divide-y divide-white/10">
                  {hourly.map((h) => (
                    <li key={h.time} className="flex items-center gap-4 py-2">
                      <span className="w-24 text-sm text-slate-200">{shortTime(h.time)}</span>
                      <span className="w-24">{formatTemp(h.temperature, unit)}</span>
                      <span className="w-24 text-sm text-slate-300">{h.precipProb != null ? `${h.precipProb}%` : "—"} precip</span>
                      <span className="flex-1" aria-hidden>
                        <div className="h-1 rounded bg-white/10">
                          <div className="h-1 rounded bg-sky-500" style={{ width: `${Math.min(100, Math.max(0, h.precipProb ?? 0))}%` }} />
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
        {tab === "radar" && coords && (
          <section id="panel-radar" className="mt-6">
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <CloudRain className="h-5 w-5" aria-hidden />
                <h2 className="text-lg font-semibold">Live radar (Windy)</h2>
              </div>
              <MapPanel coords={coords} unit={unit} />
            </Card>
          </section>
        )}

        {/* ALERTS */}
        {tab === "alerts" && (
          <section id="panel-alerts" className="mt-6">
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />
                <h2 className="text-lg font-semibold">Active alerts</h2>
              </div>
              {loadingAlerts ? (
                <Skeleton lines={6} />
              ) : alerts.length === 0 ? (
                <p className="text-sm text-slate-200">No active alerts for this location.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {alerts.map((a) => (
                    <details key={a.id} className="group rounded-xl bg-white/5 ring-1 ring-white/10">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                        <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", chipColor(a.severity))}>
                          {a.severity || "Unknown"}
                        </span>
                        <span className="font-medium">{a.event}</span>
                        <span className="ml-auto text-xs text-slate-300">
                          {a.effective ? new Date(a.effective).toLocaleString() : ""}
                        </span>
                      </summary>
                      <div className="px-4 pb-4 text-sm text-slate-100">
                        {a.headline && <p className="mb-2 font-semibold">{a.headline}</p>}
                        {a.areaDesc && <p className="mb-2 text-slate-200">Areas: {a.areaDesc}</p>}
                        {a.description && <p className="whitespace-pre-wrap">{a.description}</p>}
                        {a.instruction && <p className="mt-2 whitespace-pre-wrap font-medium">{a.instruction}</p>}
                        {a.ends && <p className="mt-2 text-xs text-slate-300">Ends: {new Date(a.ends).toLocaleString()}</p>}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-slate-300/80">
          Data: Open-Meteo (forecast, geocoding). Alerts: NWS (best-effort). Built with Next.js & Tailwind.
        </p>
      </main>
    </div>
  );
}

/* =========================
   Small components
   ========================= */

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("rounded-3xl bg-slate-900/60 p-4 ring-1 ring-white/10 shadow-xl shadow-slate-950/30 backdrop-blur", className)}>{children}</div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
      {icon}
      <div>
        <div className="text-xs text-slate-300">{label}</div>
        <div className="text-sm font-medium text-slate-100">{value}</div>
      </div>
    </div>
  );
}

function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-white/10 mb-2" />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-200">
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
