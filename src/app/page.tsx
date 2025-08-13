"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Sun, Loader2, LocateFixed } from "lucide-react";
import CurrentWeatherCard from "@/components/CurrentWeatherCard";
import DailyForecast from "@/components/DailyForecast";
import HourlyForecast from "@/components/HourlyForecast";
import AlertsPanel from "@/components/AlertsPanel";
import MapPanel from "@/components/MapPanel";
import { useWeather } from "@/hooks/useWeather";
import { useWeatherFormatting, THEMES } from "@/hooks/useWeatherFormatting";
import { clsx } from "@/lib/utils";

export default function Page() {
  const {
    unit,
    setUnit,
    query,
    setQuery,
    coords,
    weatherData,
    isLoading,
    error,
    geoLoading,
    runSearch,
    requestGeolocation,
    placeLabel,
  } = useWeather();

  const { pickTheme } = useWeatherFormatting();

  const themeKey = useMemo(
    () => pickTheme(weatherData?.current?.weather_code ?? null, weatherData?.current?.time),
    [weatherData, pickTheme]
  );

  return (
    <div
      className={clsx(
        "relative min-h-screen text-slate-100 selection:bg-sky-300/40 bg-gradient-to-br transition-colors duration-1000",
        THEMES[themeKey]
      )}
    >
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSearch(query);
              }}
              className="w-full"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any city..."
                className="w-full rounded-lg bg-slate-900/60 px-3 py-1.5 placeholder:text-slate-400 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
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
            <button
              onClick={() => setUnit("imperial")}
              className={clsx("px-3 py-1.5 text-sm", unit === "imperial" ? "bg-sky-600" : "hover:bg-white/5")}
            >
              °F
            </button>
            <button
              onClick={() => setUnit("metric")}
              className={clsx("px-3 py-1.5 text-sm", unit === "metric" ? "bg-sky-600" : "hover:bg-white/5")}
            >
              °C
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-3xl font-bold tracking-tight">{placeLabel}</h1>
        </div>

        {/* --- Global Error Display --- */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-900/50 p-4 text-center text-red-100 ring-1 ring-red-500/50">
            <p className="font-semibold">An error occurred:</p>
            <p>{error}</p>
          </div>
        )}

        {/* --- Loading Spinner --- */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-sky-300" />
          </div>
        )}

        {/* --- Weather Data Display --- */}
        {!isLoading && weatherData && coords && (
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
              <MapPanel coords={coords} unit={unit} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
