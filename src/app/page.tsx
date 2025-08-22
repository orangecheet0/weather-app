"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useWeather } from "@/lib/useWeather";

import Header from "@/components/Header";
import CurrentWeatherCard from "@/components/CurrentWeatherCard";
import HourlyForecast from "@/components/HourlyForecast";
import DailyForecast from "@/components/DailyForecast";
import MapPanel from "@/components/MapPanel";
import AlertsPanel from "@/components/AlertsPanel";

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
  } = useWeather(unit);

  const themeKey = "day";

  const placeLabel = useMemo(() => {
    if (!location) return "Loading location...";
    const parts = [location.name, location.admin1, location.country]
      .filter((p) => p && String(p).trim().length > 0)
      .join(", ");
    return parts || "Your Location";
  }, [location]);

  return (
    <div
      className={clsx(
        "min-h-screen text-slate-100 bg-gradient-to-br transition-colors duration-1000 selection:bg-sky-300/40",
        THEMES[themeKey as keyof typeof THEMES]
      )}
    >
      <Header
        unit={unit}
        onUnitChange={setUnit}
        onLocationSelected={setLocation}
        requestGeolocation={requestGeolocation}
      />

      <main className="mx-auto max-w-[1280px] px-4 py-8">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">{placeLabel}</h1>

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
          <div className="space-y-8">
            {/* Top grid: left column (current + hourly + alerts), right column (7‑day) */}
            <div className="grid gap-x-8 gap-y-10 md:grid-cols-1 lg:grid-cols-3">
              <div className="space-y-10 lg:col-span-2">
                <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-md overflow-hidden">
                  <CurrentWeatherCard data={weatherData.current} unit={unit} />
                </div>

                <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-md overflow-hidden">
                  <HourlyForecast data={weatherData.hourly} unit={unit} />
                </div>

                <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-md overflow-hidden">
                  <AlertsPanel alerts={weatherData.alerts} />
                </div>
              </div>

              <div className="space-y-10">
                <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-md overflow-hidden">
                  <DailyForecast data={weatherData.daily} unit={unit} />
                </div>
              </div>
            </div>

            {/* Full‑width Windy map BELOW alerts */}
            <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-md overflow-hidden">
              <MapPanel coords={location.coords} unit={unit} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
