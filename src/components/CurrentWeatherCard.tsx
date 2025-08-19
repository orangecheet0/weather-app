import React from "react";
import { Droplets, Sun } from "lucide-react";
import {
  formatTemp,
  formatWind,
  formatUV,
  shortTime,
  weatherIcon,
} from "@/utils/formatters";

import type { CurrentBlock, Unit } from "@/types";

export default function CurrentWeatherCard({
  data,
  unit,
}: {
  data: CurrentBlock;
  unit: Unit;
}) {
  return (
    <div className="rounded-xl bg-slate-900/60 p-6 ring-1 ring-white/10 backdrop-blur-md shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Current Weather</h2>
        <p className="text-sm text-slate-300">{shortTime(data.time)}</p>
      </div>

      {/* Icon + temperature (left) / Details (right) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <div className="text-sky-300 text-6xl">{weatherIcon(data.weather_code)}</div>
          <div className="text-6xl font-light tracking-tighter">
            {formatTemp(data.temperature_2m, unit)}
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col text-sm sm:text-right gap-1">
          <div>
            Condition:{" "}
            <span className="font-medium">{data.weather_description ?? "N/A"}</span>
          </div>
          <div>
            Feels like:{" "}
            <span className="font-medium">
              {formatTemp(data.apparent_temperature, unit)}
            </span>
          </div>
          <div>
            Wind:{" "}
            <span className="font-medium">
              {formatWind(data.wind_speed_10m, unit)}
            </span>
          </div>
          <div>
            Gusts:{" "}
            <span className="font-medium">
              {formatWind(data.wind_gusts_10m, unit)}
            </span>
          </div>
        </div>
      </div>

      {/* Lower stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-sky-300" />
          <span>Humidity: {data.relative_humidity_2m}%</span>
        </span>
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-sky-300" />
          <span>UV Index: {formatUV(data.uv_index)}</span>
        </div>
      </div>
    </div>
  );
}
