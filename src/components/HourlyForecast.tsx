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
  const startIndex = 0;
  const endIndex = Math.min(data.time.length, 12);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Hourly Forecast</h2>

      {/* Horizontal scroller for tight layouts */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 px-1 pb-2 snap-x snap-mandatory">
          {data.time.slice(startIndex, endIndex).map((t, i) => {
            const idx = startIndex + i;
            return (
              <div
                key={t}
                className="snap-start flex flex-col items-center justify-between rounded-lg bg-slate-900/60 px-3 py-3 backdrop-blur-md ring-1 ring-white/10 shadow-sm min-w-[78px] flex-shrink-0"
              >
                <p className="text-xs font-medium text-slate-200">{shortTime(t)}</p>

                <div className="flex h-7 w-7 items-center justify-center text-sky-300">
                  {weatherIcon(data.weather_code[idx] ?? 0, true)}
                </div>

                <p className="text-sm font-semibold">
                  {formatTemp(data.temperature_2m[idx], unit)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
