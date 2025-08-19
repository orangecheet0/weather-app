import React from "react";
import type { Coords, Unit } from "@/types";
import { windyUrl } from "@/utils/formatters";

export default function MapPanel({
  coords,
  unit
}: {
  coords: Coords;
  unit: Unit;
}) {
  return (
    <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm">
      <iframe
        src={windyUrl(coords, unit)}
        className="w-full h-64 rounded-lg"
        title="Weather Radar Map"
        allow="geolocation"
      />
    </div>
  );
}
