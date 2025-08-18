"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import debounce from "lodash.debounce";

import Header from "@/components/Header";
import CurrentWeatherCard from "@/components/CurrentWeatherCard";
import DailyForecast from "@/components/DailyForecast";
import HourlyForecast from "@/components/HourlyForecast";
import AlertsPanel from "@/components/AlertsPanel";
import MapPanel from "@/components/MapPanel";

import { normalizeQuery, pickTheme } from "@/utils/formatters";

import type {
  Coords,
  Unit,
  LocationState,
  WeatherData,
  SearchCandidate,
  OWMGeocodeResult,
  ThemeKey,
  AlertItem,
} from "@/types";

const DEFAULT_CITY: LocationState = {
  name: "Huntsville",
  admin1: "Alabama",
  country: "US",
  coords: { lat: 34.7304, lon: -86.5861 },
};

const THEMES = {
  clearDay: "from-sky-300 via-sky-500 to-indigo-700",
  clearNight: "from-indigo-900 via-slate-950 to-black",
  cloudy: "from-slate-700 via-slate-900 to-slate-950",
  rain: "from-sky-700 via-slate-950 to-slate-950",
  snow: "from-cyan-200 via-slate-800 to-slate-950",
  storm: "from-indigo-800 via-slate-950 to-black",
} as const;

export default function Page() {
  const router = useRouter();

  // --- STATE ---
  const [unit, setUnit] = useState<Unit>("imperial");
  const [location, setLocation] = useState<LocationState | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchControllerRef = useRef<AbortController | null>(null);

  // --- SIDE EFFECTS: initial location detection ---
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const lat = parseFloat(usp.get("lat") || "");
    const lon = parseFloat(usp.get("lon") || "");

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      reverseLookup({ lat, lon }, true);
      return;
    }

    (async () => {
      const geoSuccess = await requestGeolocation();
      if (!geoSuccess) {
        setLocation(DEFAULT_CITY);
        navigateToLocation(DEFAULT_CITY, false);
      }
    })();
  }, []);

  // --- Fetch data when location or unit changes ---
  useEffect(() => {
    if (!location) return;

    async function fetchAllData() {
      if (!location) return; // Guard
      setIsLoading(true);
      setGlobalError(null);

      // Abort any existing fetch
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = new AbortController();

      try {
        // 1) OpenWeather data (unchanged)
        const res = await fetch(
          `/api/weather?lat=${location.coords.lat}&lon=${location.coords.lon}&unit=${unit}`,
          { signal: fetchControllerRef.current.signal }
        );
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to fetch weather data.");
        }
        const data: WeatherData = await res.json();

        // 2) NWS Alerts
        const nwsRes = await fetch(
          `https://api.weather.gov/alerts/active?point=${location.coords.lat},${location.coords.lon}`,
          {
            headers: {
              "User-Agent": "alweather (https://alweather.org)",
            },
          }
        );
        let alerts: AlertItem[] = [];
        if (nwsRes.ok) {
          const j = await nwsRes.json();
          if (j.features && Array.isArray(j.features)) {
            alerts = j.features.map((f: any) => ({
              id: f.id,
              event: f.properties.event,
              headline: f.properties.headline,
              description: f.properties.description,
              instruction: f.properties.instruction,
              areaDesc: f.properties.areaDesc,
            }));
          }
        }

        // Replace alerts with NWS alerts
        data.alerts = alerts;

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
    return () => fetchControllerRef.current?.abort();
  }, [location, unit]);

  const placeLabel = useMemo(() => {
    if (!location) return "Loading location...";
    return [location.name, location.admin1].filter(Boolean).join(", ");
  }, [location]);

  const themeKey = useMemo<ThemeKey>(
    () =>
      pickTheme(
        weatherData?.current?.weather_code ?? null,
        weatherData?.current?.time
      ),
    [weatherData]
  );
  // --- Navigation helpers ---
  function navigateToLocation(loc: LocationState, shouldPush: boolean) {
    const usp = new URLSearchParams();
    usp.set("lat", loc.coords.lat.toFixed(4));
    usp.set("lon", loc.coords.lon.toFixed(4));
    const newUrl = `?${usp.toString()}`;
    if (shouldPush) {
      router.push(newUrl, { scroll: false });
    } else {
      router.replace(newUrl, { scroll: false });
    }
  }

  async function reverseLookup(c: Coords, isInitialLoad = false) {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`
      );
      if (!res.ok) throw new Error("Reverse geocode failed.");
      const j = await res.json();
      const newLoc = {
        coords: c,
        name: j.city || j.locality || "Your area",
        admin1: j.principalSubdivision,
        country: j.countryCode,
      };
      setLocation(newLoc);
      navigateToLocation(newLoc, !isInitialLoad);
    } catch (_) {
      const newLoc = { coords: c, name: "Unknown location" };
      setLocation(newLoc);
      navigateToLocation(newLoc, !isInitialLoad);
    }
  }

  async function requestGeolocation(): Promise<boolean> {
    if (!navigator.geolocation) {
      setGlobalError("Your browser doesn’t support geolocation.");
      return false;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          reverseLookup({ lat: pos.coords.latitude, lon: pos.coords.longitude }, true);
          resolve(true);
        },
        () => {
          setGlobalError("Could not get your location. Please allow location access.");
          resolve(false);
        },
        { timeout: 10000 }
      );
    });
  }

  // --- RENDER ---
  return (
    <div
      className={clsx(
        "relative min-h-screen text-slate-100 selection:bg-sky-300/40 bg-gradient-to-br transition-colors duration-1000",
        THEMES[themeKey]
      )}
    >
      <Header
        unit={unit}
        onUnitChange={setUnit}
        onLocationSelected={(loc) => setLocation(loc)}
        requestGeolocation={requestGeolocation}
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{placeLabel}</h1>
        </div>

        {globalError && (
          <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-center text-red-100 ring-1 ring-red-500/50">
            <p className="font-semibold">An error occurred:</p>
            <p>{globalError}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-sky-300" />
          </div>
        )}

        {!isLoading && weatherData && location && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
              <CurrentWeatherCard data={weatherData.current} unit={unit} />
              <HourlyForecast data={weatherData.hourly} unit={unit} />
              <AlertsPanel alerts={weatherData.alerts} />
            </div>

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
