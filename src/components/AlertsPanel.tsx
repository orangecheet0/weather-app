import React from "react";
import { AlertTriangle } from "lucide-react";
import type { AlertItem } from "@/types";

export default function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="rounded-xl bg-slate-900/40 p-6 ring-1 ring-white/10 backdrop-blur-sm overflow-hidden">
        <p className="text-sm text-slate-300">No active weather alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Weather Alerts</h2>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="rounded-xl bg-red-900/40 p-4 ring-1 ring-red-500/50 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold text-red-100">
              {alert.event || "Alert"}
            </h3>
          </div>
          <p className="mt-2 text-sm text-red-100">{alert.headline}</p>
          <p className="mt-1 text-xs text-red-200">{alert.areaDesc}</p>
          <p className="mt-2 text-sm text-red-100">{alert.description}</p>
          {alert.instruction && (
            <p className="mt-2 text-sm text-red-100">
              Instructions: {alert.instruction}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
