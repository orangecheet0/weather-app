"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import debounce from "lodash.debounce";

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
} from "@/types";

const DEFAULT_CITY: LocationState = {
  name: "Huntsville",
  admin1: "Alabama",
  country: "US",
  coords: { lat: 34.7304, lon: -86.5861 },
};

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
  const [searchCandidates, setSearchCandidates] =
    useState<SearchCandidate[] | null>(null);

  const fetchControllerRef = useRef<AbortController | null>(null);

  // Debounced suggestions fetcher
  const fetchSuggestions = useMemo(
    () =>
      debounce(async (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) {
          setSearchCandidates(null);
          return;
        }

        setIsSearching(true);

        try {
          const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
          if (!apiKey) {
            setIsSearching(false);
            return;
          }

          const normQuery = normalizeQuery(trimmed);
          const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
            normQuery
          )}&limit=5&appid=${apiKey}`;
          const res = await fetch(owmUrl);

          if (!res.ok) {
            setIsSearching(false);
            return;
          }

          const data = (await res.json()) as OWMGeocodeResult[];
          if (data && data.length > 0) {
            setSearchCandidates(
              data.map((result) => ({
                coords: { lat: result.lat, lon: result.lon },
                name: result.name,
                admin1: result.state,
                country: result.country,
              }))
            );
          } else {
            setSearchCandidates(null);
          }
        } finally {
          setIsSearching(false);
        }
      }, 300),
    []
  );

  // Update suggestions as user types
  useEffect(() => {
    fetchSuggestions(query);
    return () => fetchSuggestions.cancel();
  }, [query, fetchSuggestions]);

  // Search handler
  async function runSearch(rawQuery: string) {
    const raw = rawQuery.trim();
    if (!raw) return;

    setIsSearching(true);
    setGlobalError(null);
    setWeatherData(null);
    setSearchCandidates(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OpenWeatherMap API key is missing. Please contact support."
        );
      }

      const normQuery = normalizeQuery(raw);
      const owmUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        normQuery
      )}&limit=5&appid=${apiKey}`;

      const res = await fetch(owmUrl);
      if (!res.ok) {
        throw new Error(`Search failed with status ${res.status}`);
      }

      const data = (await res.json()) as OWMGeocodeResult[];
      if (!data || data.length === 0) {
        setGlobalError(`No matches found for "${raw}".`);
        return;
      }

      // If multiple results, let user choose
      if (data.length > 1) {
        setSearchCandidates(
          data.map((r) => ({
            coords: { lat: r.lat, lon: r.lon },
            name: r.name,
            admin1: r.state,
            country: r.country,
          }))
        );
        return;
      }

      // One result only
      const result = data[0];
      const newLoc = {
        coords: { lat: result.lat, lon: result.lon },
        name: result.name,
        admin1: result.state,
        country: result.country,
      };

      setLocation(newLoc);
      navigateToLocation(newLoc, true);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : "Search error. Please try again."
      );
    } finally {
      setIsSearching(false);
      setIsLoading(false);
    }
  }

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

  // Reverse lookup
  async function reverseLookup(c: Coords, isInitialLoad = false) {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Reverse geocode failed.");

      const j = await res.json();
      const newLocation = {
        coords: c,
        name: j.city || j.locality || "Your area",
        admin1: j.principalSubdivision,
        country: j.countryCode,
      };
      setLocation(newLocation);
      navigateToLocation(newLocation, !isInitialLoad);
    } catch (e) {
      const newLocation = { coords: c, name: "Unknown location" };
      setLocation(newLocation);
      navigateToLocation(newLocation, !isInitialLoad);
    }
  }
  // Request geolocation
  async function requestGeolocation(): Promise<boolean> {
    if (!navigator.geolocation) {
      setGlobalError(
        "Your browser doesn’t support geolocation. Please search manually."
      );
      return false;
    }

    setGeoLoading(true);
    setGlobalError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };

          if (pos.coords.accuracy > 1000) {
            setGlobalError(
              "Location accuracy is low. Try enabling high-accuracy GPS."
            );
          }

          reverseLookup(c, true);
          setGeoLoading(false);
          resolve(true);
        },
        (err) => {
          let message =
            "Could not get location. Please enable it or search manually.";
          if (err.message.includes("Permissions policy")) {
            message =
              "Geolocation is blocked by a permissions policy. Please enable location access.";
          }
          setGlobalError(message);
          setGeoLoading(false);
          resolve(false);
        },
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
      );
    });
  }

  // --- SIDE EFFECTS ---
  // Main data fetching
  useEffect(() => {
    if (!location) return;

    async function fetchAllData() {
      setIsLoading(true);
      setGlobalError(null);
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = new AbortController();

      try {
        const res = await fetch(
          `/api/weather?lat=${location.coords.lat}&lon=${location.coords.lon}&unit=${unit}`,
          { signal: fetchControllerRef.current.signal }
        );
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to fetch weather data.");
        }

        const data: WeatherData = await res.json();
        setWeatherData(data);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setGlobalError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllData();
    return () => fetchControllerRef.current?.abort();
  }, [location, unit]);

  // Load initial unit & location
  useEffect(() => {
    const savedUnit = localStorage.getItem("weatherUnit");
    if (savedUnit === "metric" || savedUnit === "imperial") {
      setUnit(savedUnit);
    }

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

  // Save unit to localStorage
  useEffect(() => {
    localStorage.setItem("weatherUnit", unit);
  }, [unit]);

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

  // --- RENDER ---
  return (
    <div
      className={clsx(
        "relative min-h-screen text-slate-100 selection:bg-sky-300/40 bg-gradient-to-br transition-colors duration-1000",
        THEMES[themeKey]
      )}
    >
      {/* Header (unchanged) */}
      {/* ...keep your existing <header> block here... */}

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
