// lib/useWeather.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type Unit = "imperial" | "metric";

export type Coords = { lat: number; lon: number };

export type SearchCandidate = {
  coords: Coords;
  name: string;
  admin1?: string | null;
  country?: string | null;
};

export type LocationState = SearchCandidate & {};

type WeatherData = {
  current: any;
  hourly: any;
  daily: any;
  alerts: any[];
};

const MADISON_AL: LocationState = {
  name: "Madison",
  admin1: "Alabama",
  country: "US",
  coords: { lat: 34.6993, lon: -86.7483 },
};

export function useWeather() {
  const [location, setLocation] = useState<LocationState | null>(MADISON_AL);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (coords: Coords) => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      const qs = new URLSearchParams({
        lat: String(coords.lat),
        lon: String(coords.lon),
      });
      const res = await fetch(`/api/weather?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await res.json()) as WeatherData;
      setWeatherData(json);
    } catch (err: any) {
      console.error("Weather fetch failed:", err);
      setGlobalError("Unable to fetch weather data.");
      setWeatherData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location?.coords) {
      fetchWeather(location.coords);
    }
  }, [location, fetchWeather]);

  const requestGeolocation = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGlobalError("Geolocation unavailable in this browser.");
      return null;
    }
    return new Promise<LocationState | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          const loc: LocationState = {
            coords,
            name: "Your Location",
            admin1: "",
            country: "",
          };
          setLocation(loc);
          resolve(loc);
        },
        (err) => {
          console.warn("Geolocation error:", err);
          setGlobalError("Permission denied for geolocation.");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
      );
    });
  }, []);

  return {
    location,
    weatherData,
    isLoading,
    globalError,
    requestGeolocation,
    setLocation,
  };
}
