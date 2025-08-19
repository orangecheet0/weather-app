import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Sun, LocateFixed } from "lucide-react";
import debounce from "lodash.debounce";
import { normalizeQuery } from "@/utils/formatters";

import type { LocationState, SearchCandidate, Unit, OWMGeocodeResult } from "@/types";

interface HeaderProps {
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  onLocationSelected: (loc: LocationState) => void;
  requestGeolocation: () => Promise<LocationState | null>;
}

export default function Header({
  unit,
  onUnitChange,
  onLocationSelected,
  requestGeolocation,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [searchCandidates, setSearchCandidates] = useState<SearchCandidate[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
          if (!apiKey) return;

          const normQuery = normalizeQuery(trimmed);
          const res = await fetch(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
              normQuery
            )}&limit=5&appid=${apiKey}`
          );
          if (!res.ok) return;

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

  useEffect(() => {
    fetchSuggestions(query);
    return () => fetchSuggestions.cancel();
  }, [query, fetchSuggestions]);

  function handleCandidateSelect(candidate: SearchCandidate) {
    setQuery(
      `${candidate.name}${candidate.admin1 ? `, ${candidate.admin1}` : ""}${
        candidate.country ? `, ${candidate.country}` : ""
      }`
    );
    setSearchCandidates(null);
    onLocationSelected(candidate);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (searchCandidates && searchCandidates.length > 0) {
      handleCandidateSelect(searchCandidates[0]);
    }
  }

  return (
    <div className="mt-4">
      <header className="sticky top-0 z-40 mx-auto max-w-[1280px] rounded-xl bg-slate-900/60 backdrop-blur-md shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-sky-300" />
            <span className="font-semibold tracking-wide bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
              AlWeather
            </span>
          </div>

          {/* Search + “use my location” */}
          <div className="ml-auto flex w-full max-w-md items-center gap-2">
            <form onSubmit={handleSubmit} className="relative w-full" autoComplete="off">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter city, state or city, country"
                className="w-full rounded-lg bg-slate-900/60 px-3 py-1.5 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500"
                autoComplete="off"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-sky-300" />
              )}
              {searchCandidates && (
                <div className="absolute left-0 right-0 z-10 mt-2 max-h-48 overflow-y-auto rounded bg-white text-black shadow-lg">
                  {searchCandidates.map((c) => (
                    <button
                      key={`${c.name}-${c.coords.lat}-${c.coords.lon}-${c.admin1}-${c.country}`}
                      className="block w-full px-4 py-2 text-left hover:bg-sky-100"
                      type="button"
                      onClick={() => handleCandidateSelect(c)}
                    >
                      {c.name}
                      {c.admin1 ? `, ${c.admin1}` : ""}
                      {c.country ? `, ${c.country}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </form>
            <button
              onClick={requestGeolocation}
              className="inline-flex items-center justify-center rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5"
              aria-label="Use my location"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>

          {/* Unit toggle */}
          <div role="group" className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
            <button
              onClick={() => onUnitChange("imperial")}
              className={`px-3 py-1.5 text-sm ${
                unit === "imperial" ? "bg-sky-600" : "hover:bg-white/5"
              }`}
            >
              °F
            </button>
            <button
              onClick={() => onUnitChange("metric")}
              className={`px-3 py-1.5 text-sm ${
                unit === "metric" ? "bg-sky-600" : "hover:bg-white/5"
              }`}
            >
              °C
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
