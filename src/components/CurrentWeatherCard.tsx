"use client";

import { Droplets, Sun } from "lucide-react";
import { CurrentBlock, Unit } from "@/types";
import { useWeatherFormatting } from "@/hooks/useWeatherFormatting";

export default function CurrentWeatherCard({ data, unit }: { data: CurrentBlock; unit: Unit }) {
  const { shortTime, weatherIcon, formatTemp, formatWind, formatUV } = useWeatherFormatting();

  return (
    <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current Weather</h2>
        <p className="text-sm text-slate-300">{shortTime(data.time)}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-sky-300">{weatherIcon(data.weather_code)}</div>
          <div className="text-5xl font-light tracking-tighter">{formatTemp(data.temperature_2m, unit)}</div>
        </div>
        <div className="space-y-1 text-right text-sm">
          <div>
            Feels like: <span className="font-medium">{formatTemp(data.apparent_temperature, unit)}</span>
          </div>
          <div>
            Wind: <span className="font-medium">{formatWind(data.wind_speed_10m, unit)}</span>
          </div>
          <div>
            Gusts: <span className="font-medium">{formatWind(data.wind_gusts_10m, unit)}</span>
          </div>
        </div>
      </div>
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
