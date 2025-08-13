"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { Coords, Unit } from "@/types";
import { useWeatherFormatting } from "@/hooks/useWeatherFormatting";
import { clsx } from "@/lib/utils";

export default function MapPanel({ coords, unit, className }: { coords: Coords; unit: Unit; className?: string }) {
  const { windyUrl } = useWeatherFormatting();
  const [full, setFull] = useState(false);
  const hrefBase = useMemo(() => windyUrl(coords, unit, 8), [coords, unit, windyUrl]);
  const frameKey = `${coords.lat.toFixed(5)}:${coords.lon.toFixed(5)}:${unit}`;
  const href = `${hrefBase}&v=${encodeURIComponent(frameKey)}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    if (full) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const frame = (
    <iframe
      key={frameKey}
      title="Radar Map"
      src={href}
      className="h-full w-full rounded-xl border border-white/10 shadow-xl"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );

  return (
    <>
      <div className={clsx("relative overflow-hidden rounded-xl", "bg-black/20 ring-1 ring-white/10", className)} style={{ height: "640px" }}>
        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Open map in a new tab"
          >
            <ExternalLink className="h-4 w-4" /> New tab
          </a>
          <button
            onClick={() => setFull(true)}
            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
            title="Expand to full screen"
            aria-expanded={full}
          >
            <Maximize2 className="h-4 w-4" /> Expand
          </button>
        </div>
        <div className="absolute inset-0">{frame}</div>
      </div>
      {full && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <button
            onClick={() => setFull(false)}
            className="absolute right-4 top-4 z-[101] inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            title="Close full-screen map"
          >
            <X className="h-4 w-4" /> Close
          </button>
          <div className="absolute inset-0 p-4 md:p-6 lg:p-8">
            <div className="h-full w-full overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10">
              <iframe
                key={`full-${frameKey}`}
                title="Radar Map (Full Screen)"
                src={href}
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
