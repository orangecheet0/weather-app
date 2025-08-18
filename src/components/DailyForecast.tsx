import React from "react";
import { weatherIcon } from "@/utils/formatters";
import { shortDate, formatTemp } from "@/utils/formatters";
import type { DailyBlock, Unit } from "@/types";

export default function DailyForecast({
  data,
  unit
}: {
  data: DailyBlock;
  unit: Unit;
}) {
  return (
    <div className="space-y-2">
      {data.time.map((t, i) => (
        <div
          key={t}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg bg-slate-900/30 p-2 px-3 ring-1 ring-white/10"
        >
          <div className="font-medium">{shortDate(t)}</div>
          <div className="flex items-center gap-2 text-slate-300">
            {weatherIcon(data.weather_code[i])}
          </div>
          <div className="flex items-center gap-2 font-medium">
            <span className="text-slate-300">
              {formatTemp(data.temperature_2m_min[i], unit)}
            </span>
            <span className="text-white">
              {formatTemp(data.temperature_2m_max[i], unit)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
