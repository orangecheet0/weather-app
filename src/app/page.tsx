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

  // TODO: add real day/night check — for now use day
  const themeKey = "day";

  const placeLabel = location
    ? `${location.name}, ${location.admin1} (${location.country})`
    : "Loading location...";

  return (
    <div
      className={clsx(
        "min-h-screen text-slate-100 bg-gradient-to-br transition-colors duration-1000 selection:bg-sky-300/40",
        THEMES[themeKey]
      )}
    >
      <Header
        unit={unit}
        onUnitChange={setUnit}
        onLocationSelected={setLocation}
        requestGeolocation={requestGeolocation}
      />

      <main className="mx-auto max-w-[1280px] px-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-8">{placeLabel}</h1>

        {globalError && (
          <div className="mb-8 rounded-lg bg-red-900/50 p-4 text-center text-red-100 ring-1 ring-red-500/50">
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
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-1 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
              <div className="bg-slate-900/60 backdrop-blur-md shadow-xl rounded-2xl p-6">
                <CurrentWeatherCard data={weatherData.current} unit={unit} />
              </div>

              <div className="bg-slate-900/60 backdrop-blur-md shadow-xl rounded-2xl p-6">
                <HourlyForecast data={weatherData.hourly} unit={unit} />
              </div>

              <div className="bg-slate-900/60 backdrop-blur-md shadow-xl rounded-2xl p-6">
                <AlertsPanel alerts={weatherData.alerts} />
              </div>
            </div>

            <div className="space-y-10">
              <div className="bg-slate-900/60 backdrop-blur-md shadow-xl rounded-2xl p-6">
                <DailyForecast data={weatherData.daily} unit={unit} />
              </div>

              <div className="bg-slate-900/60 backdrop-blur-md shadow-xl rounded-2xl p-6">
                <MapPanel coords={location.coords} unit={unit} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
