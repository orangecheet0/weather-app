import React from "react";
import { shortDate, weatherIcon, formatTemp } from "@/utils/formatters";
import type { DailyBlock, Unit } from "@/types";

export default function DailyForecast({
  data,
  unit,
}: {
  data: DailyBlock;
  unit: Unit;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">7-Day Forecast</h2>
      {data.time.map((t, i) => (
        <div
          key={t}
          className="flex items-center justify-between rounded-lg bg-slate-900/60 p-4 backdrop-blur-md ring-1 ring-white/10 shadow overflow-hidden"
        >
          <div className="font-medium">{shortDate(t)}</div>

          <div className="flex items-center gap-2 text-slate-300">
            {weatherIcon(data.weather_code[i] ?? 0, true)}
          </div>

          <div className="flex items-center gap-2 font-medium">
            <span className="text-slate-300">High:</span>
            {formatTemp(data.temperature_2m_max[i], unit)}
            <span className="text-slate-300">Low:</span>
            {formatTemp(data.temperature_2m_min[i], unit)}
          </div>
        </div>
      ))}
    </div>
  );
}
