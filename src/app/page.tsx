"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useWeather } from "@/lib/useWeather";

import Header from "@/components/Header";
import CurrentWeatherCard from "@/components/CurrentWeatherCard";
import HourlyForecast from "@/components/HourlyForecast";
import DailyForecast from "@/components/DailyForecast";
import MapPanel from "@/components/MapPanel";
import AlertsPanel from "@/components/AlertsPanel";

// Background gradient themes
const THEMES = {
  day: "from-sky-600 to-blue-900",
  night: "from-gray-700 to-gray-900",
};

export default function Page() {
  const [unit, setUnit] = useState<"imperial" | "metric">("imperial");
  const {
    location,
    weatherData,
    isLoading,
    globalError,
    requestGeolocation,
    setLocation,
  } = useWeather();

  // For now we default to "day"
  const themeKey = "day";

  const placeLabel = location
    ? `${location.name}, ${location.admin1} (${location.country})`
    : "Loading location...";

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
        onLocationSelected={setLocation}
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
            <Loader2 className="h-12 w-12 animate-spin" />
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
