"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Coords, WeatherData, Unit } from "@/types";

const DEFAULT_CITY = {
  name: "Huntsville",
  admin1: "Alabama",
  country: "US",
  lat: 34.7304,
  lon: -86.5861,
};

export function useWeather() {
  const router = useRouter();

  const [unit, setUnit] = useState<Unit>("imperial");
  const [query, setQuery] = useState("");
  const [activePlace, setActivePlace] = useState<{ name: string; admin1?: string; country?: string } | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const fetchControllerRef = useRef<AbortController | null>(null);

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
        const c = { lat, lon };
        setCoords(c);
        reverseLookup(c);
        return;
      }
    }

    (async () => {
      const ok = await requestGeolocation();
      if (!ok) {
        setCoords(DEFAULT_CITY);
        setActivePlace(DEFAULT_CITY);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("weatherUnit", unit);
  }, [unit]);

  useEffect(() => {
    if (!coords) return;
    const usp = new URLSearchParams();
    usp.set("lat", String(coords.lat.toFixed(4)));
    usp.set("lon", String(coords.lon.toFixed(4)));
    router.replace(`?${usp.toString()}`, { scroll: false });
  }, [coords, router]);

  useEffect(() => {
    if (!coords) return;

    async function fetchWeatherData() {
      if (!coords) return;
      setIsLoading(true);
      setError(null);

      fetchControllerRef.current?.abort();
      fetchControllerRef.current = new AbortController();

      try {
        const res = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}&unit=${unit}`, {
          signal: fetchControllerRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch data.");
        }

        const data: WeatherData = await res.json();
        setWeatherData(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchWeatherData();

    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [coords, unit]);

  async function reverseLookup(c: Coords) {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${c.lat}&longitude=${c.lon}&localityLanguage=en`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("reverse geocode failed");
      const j = await res.json();
      const name = j.city || j.locality || "Your area";
      setActivePlace({ name, admin1: j.principalSubdivision, country: j.countryCode });
    } catch {
      // ignore
    }
  }

  async function runSearch(rawQuery: string) {
    const raw = rawQuery.trim();
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Search error";
      setError(message);
    }
  }

  async function requestGeolocation(): Promise<boolean> {
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
        () => {
          setGeoError("Could not get location. Please enable it in your browser settings.");
          setGeoLoading(false);
          resolve(false);
        },
        { timeout: 10000 }
      );
    });
  }

  const placeLabel = useMemo(() => {
    if (!activePlace) return "Loading location...";
    return [activePlace.name, activePlace.admin1].filter(Boolean).join(", ");
  }, [activePlace]);

  return {
    unit,
    setUnit,
    query,
    setQuery,
    coords,
    weatherData,
    isLoading,
    error,
    geoLoading,
    geoError,
    runSearch,
    requestGeolocation,
    placeLabel,
  };
}
