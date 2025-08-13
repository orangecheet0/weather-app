"use client";

import { AlertTriangle } from "lucide-react";
import { NWSFeature, AlertItem } from "@/types";

export default function AlertsPanel({ alerts }: { alerts: NWSFeature[] }) {
  const alertItems: AlertItem[] = alerts.map((f) => ({
    id: f?.id || crypto.randomUUID(),
    event: f?.properties?.event ?? "Alert",
    headline: f?.properties?.headline,
    severity: f?.properties?.severity,
    effective: f?.properties?.effective,
    ends: f?.properties?.ends,
    description: f?.properties?.description,
    instruction: f?.properties?.instruction,
    areaDesc: f?.properties?.areaDesc,
  }));

  if (alertItems.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 text-center text-slate-300 ring-1 ring-white/10 backdrop-blur-sm">
        No active alerts for this area.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alertItems.map((alert) => (
        <details
          key={alert.id}
          className="group cursor-pointer rounded-xl bg-yellow-900/20 p-4 ring-1 ring-yellow-500/50 backdrop-blur-sm"
        >
          <summary className="flex items-center justify-between text-lg font-semibold text-yellow-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              {alert.event}
            </div>
            <span className="text-sm font-normal text-yellow-300 transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-4 space-y-4 border-t border-yellow-500/30 pt-4 text-yellow-200/90">
            <p className="font-semibold">{alert.headline}</p>
            <p className="whitespace-pre-wrap">{alert.description}</p>
            {alert.instruction && <p className="whitespace-pre-wrap font-semibold">{alert.instruction}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}
