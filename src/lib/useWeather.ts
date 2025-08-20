// src/lib/useWeather.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Coords,
  LocationState,
  SearchCandidate,
  WeatherData,
  Unit,
  OWMGeocodeResult,
} from "@/types";

const MADISON_AL: LocationState = {
  name: "Madison",
  admin1: "AL",
  country: "US",
  coords: { lat: 34.6993, lon: -86.7483 },
};

export function useWeather(unit: Unit) {
  const [location, setLocation] = useState<LocationState | null>(MADISON_AL);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchWeather = useCallback(
    async (coords: Coords) => {
      setIsLoading(true);
      setGlobalError(null);
      try {
        const qs = new URLSearchParams({
          lat: String(coords.lat),
          lon: String(coords.lon),
          unit,
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
    },
    [unit]
  );

  useEffect(() => {
    if (location?.coords) {
      fetchWeather(location.coords);
    }
  }, [location, fetchWeather]);

  // Reverse geocode helper using OpenWeather (same key as search)
  async function reverseGeocode(coords: Coords): Promise<{
    name: string;
    admin1?: string;
    country?: string;
  }> {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
    if (!apiKey) return { name: "Your Location" };
    try {
      const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${encodeURIComponent(
        coords.lat
      )}&lon=${encodeURIComponent(coords.lon)}&limit=1&appid=${apiKey}`;
      const resp = await fetch(url);
      if (!resp.ok) return { name: "Your Location" };
      const data = (await resp.json()) as OWMGeocodeResult[];
      const first = data?.[0];
      if (!first) return { name: "Your Location" };
      return {
        name: first.name || "Your Location",
        admin1: first.state,
        country: first.country,
      };
    } catch {
      return { name: "Your Location" };
    }
  }

  const requestGeolocation = useCallback(async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGlobalError("Geolocation unavailable in this browser.");
      return null;
    }
    return new Promise<LocationState | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords: Coords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          const meta = await reverseGeocode(coords);
          const loc: LocationState = {
            coords,
            name: meta.name,
            admin1: meta.admin1 || "",
            country: meta.country || "",
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
