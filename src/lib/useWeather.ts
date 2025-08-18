"use client";

import { useState, useEffect } from "react";
import type { Coords, LocationState, WeatherData } from "../types";

export function useWeather() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Reverse geocode from lat/lon
  async function reverseLookup(c: Coords): Promise<LocationState> {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`
      );
      const j = await res.json();
      return {
        coords: c,
        name: j.city || j.locality || "Your area",
        admin1: j.principalSubdivision,
        country: j.countryCode,
      };
    } catch {
      return { coords: c, name: "Unknown location" };
    }
  }

  // Get the user’s geolocation and reverse lookup
  async function requestGeolocation(): Promise<LocationState | null> {
    if (!navigator.geolocation) {
      setGlobalError("Your browser doesn’t support geolocation.");
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          const loc = await reverseLookup(coords);
          resolve(loc);
        },
        () => {
          setGlobalError("Could not get your location. Please allow location access.");
          resolve(null);
        },
        { timeout: 10000 }
      );
    });
  }

  // Fetch weather + alerts
  async function fetchWeatherData(coords: Coords): Promise<WeatherData | null> {
    try {
      const qs = new URLSearchParams({
        lat: coords.lat.toString(),
        lon: coords.lon.toString(),
        unit: "imperial",
      });
      const res = await fetch(`/api/weather?${qs.toString()}`);
      if (!res.ok) throw new Error("Weather fetch failed");
      return await res.json();
    } catch {
      setGlobalError("Unable to fetch weather data.");
      return null;
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const loc = await requestGeolocation();
      if (!loc) {
        setIsLoading(false);
        return;
      }
      setLocation(loc);
      const data = await fetchWeatherData(loc.coords);
      setWeatherData(data);
      setIsLoading(false);
    })();
  }, []);

  return { location, weatherData, isLoading, globalError };
}
