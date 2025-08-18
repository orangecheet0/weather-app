import React from "react";
import type { HourlyBlock, Unit } from "@/types";
import { shortTime, formatTemp, weatherIcon } from "@/utils/formatters";

export default function HourlyForecast({
  data,
  unit
}: {
  data: HourlyBlock;
  unit: Unit;
}) {
  const now = new Date();
  const startIndex = data.time.findIndex((t) => new Date(t) > now);

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
      {data.time.slice(startIndex, startIndex + 24).map((t, i) => (
        <div
          key={t}
          className="w-24 shrink-0 snap-start space-y-3 rounded-xl bg-slate-900/30 p-3 text-center ring-1 ring-white/10"
        >
          <p className="text-sm font-medium">{shortTime(t)}</p>
          <div className="mx-auto flex h-6 w-6 items-center justify-center text-sky-300">
            {weatherIcon(data.weather_code[startIndex + i])}
          </div>
          <p className="font-semibold">
            {formatTemp(data.temperature_2m[startIndex + i], unit)}
          </p>
          {data.precipitation_probability[startIndex + i] !== null &&
            data.precipitation_probability[startIndex + i]! > 5 && (
              <p className="text-xs text-sky-300">
                {data.precipitation_probability[startIndex + i]}%
              </p>
            )}
        </div>
      ))}
    </div>
  );
}
