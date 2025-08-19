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

// Map weather_code to readable labels
function getConditionLabel(code: number) {
  const map: Record<number, string> = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing Fog",
    51: "Light Drizzle",
    61: "Light Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    95: "Thunderstorm",
  };
  return map[code] ?? "Unknown";
}

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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <div className="text-sky-300 text-6xl">{weatherIcon(data.weather_code)}</div>
          <div className="text-6xl font-light tracking-tighter">
            {formatTemp(data.temperature_2m, unit)}
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col text-sm sm:text-right gap-1">
          <div>
            Condition:{" "}
            <span className="font-medium">{getConditionLabel(data.weather_code)}</span>
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
        </div>
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-sky-300" />
          <span>UV Index: {formatUV(data.uv_index)}</span>
        </div>
      </div>
    </div>
  );
}
