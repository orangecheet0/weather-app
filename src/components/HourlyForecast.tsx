import React from "react";
import { shortTime, weatherIcon, formatTemp } from "@/utils/formatters";
import type { HourlyBlock, Unit } from "@/types";

export default function HourlyForecast({
  data,
  unit,
}: {
  data: HourlyBlock;
  unit: Unit;
}) {
  // Show the next 12 hours
  const startIndex = 0;
  const endIndex = Math.min(data.time.length, 12);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Hourly Forecast</h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-12">
        {data.time.slice(startIndex, endIndex).map((t, i) => (
          <div
            key={t}
            className="flex flex-col items-center rounded-lg bg-slate-900/60 p-2 backdrop-blur-md ring-1 ring-white/10"
          >
            <p className="text-sm font-medium">{shortTime(t)}</p>

            <div className="mx-auto flex h-6 w-6 items-center justify-center text-sky-300">
              {weatherIcon((data.weather_code[startIndex + i] ?? 0), true)}
            </div>

            <p className="font-semibold">
              {formatTemp(data.temperature_2m[startIndex + i], unit)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
