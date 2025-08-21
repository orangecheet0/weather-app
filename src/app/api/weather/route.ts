// app/api/weather/route.ts
import { NextRequest, NextResponse } from "next/server";

type Unit = "imperial" | "metric";

type CurrentBlock = {
  time: string;
  temperature_2m: number | null;
  apparent_temperature: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  relative_humidity_2m: number | null;
  uv_index: number | null;
  is_day: number | null; // 1 day, 0 night
};

type HourlyBlock = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
};

type DailyBlock = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
};

type AlertItem = {
  id: string;
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  areaDesc?: string;
};

function badRequest(msg: string, detail?: unknown) {
  return NextResponse.json({ error: msg, detail }, { status: 400 });
}

/** NWS prefers a plain ASCII UA with contact info */
const NWS_HEADERS: HeadersInit = {
  "User-Agent": "alweather.org contact@alweather.org",
  Accept: "application/geo+json",
  "Cache-Control": "no-cache",
};

/** Tiny retry helper for NWS (handles network hiccups) */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  tries = 2
): Promise<Response | null> {
  let lastErr: unknown = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, init);
      return r;
    } catch (e) {
      lastErr = e;
      // brief backoff
      await new Promise((res) => setTimeout(res, 120 + i * 120));
    }
  }
  console.warn("NWS fetch failed after retries:", url, lastErr);
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const unit = (searchParams.get("unit") as Unit) || "metric";
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return badRequest("lat/lon required");
    }

    // ---------- Open‑Meteo (units respected) ----------
    const temperature_unit = unit === "imperial" ? "fahrenheit" : "celsius";
    const wind_speed_unit = unit === "imperial" ? "mph" : "kmh";

    const omUrl = new URL("https://api.open-meteo.com/v1/forecast");
    omUrl.searchParams.set("latitude", String(lat));
    omUrl.searchParams.set("longitude", String(lon));
    omUrl.searchParams.set("timezone", "auto");
    omUrl.searchParams.set("temperature_unit", temperature_unit);
    omUrl.searchParams.set("wind_speed_unit", wind_speed_unit);
    omUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "is_day",
        "weather_code",
        "uv_index",
        "wind_speed_10m",
        "wind_gusts_10m",
        "relative_humidity_2m",
      ].join(",")
    );
    omUrl.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "apparent_temperature",
        "weather_code",
        "uv_index",
        "wind_speed_10m",
        "wind_gusts_10m",
        "relative_humidity_2m",
      ].join(",")
    );
    omUrl.searchParams.set(
      "daily",
      ["temperature_2m_max", "temperature_2m_min", "weather_code"].join(",")
    );

    // ---------- NWS endpoints (point + zone fallback) ----------
    const pointAlertsUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(
      4
    )},${lon.toFixed(4)}`;
    const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(
      4
    )},${lon.toFixed(4)}`;

    // Fetch OM + NWS in parallel
    const [omRes, pointRes, pointsRes] = await Promise.all([
      fetch(omUrl.toString(), { next: { revalidate: 300 } }),
      fetchWithRetry(pointAlertsUrl, { headers: NWS_HEADERS, next: { revalidate: 120 } }),
      fetchWithRetry(pointsUrl, { headers: NWS_HEADERS, next: { revalidate: 300 } }),
    ]);

    if (!omRes?.ok) {
      const text = await omRes?.text().catch(() => "");
      throw new Error(
        `Open-Meteo failed (${omRes?.status ?? "noresp"}): ${String(text).slice(
          0,
          200
        )}`
      );
    }
    const omJson = (await omRes.json()) as any;

    const current: CurrentBlock = {
      time: omJson?.current?.time ?? null,
      temperature_2m: omJson?.current?.temperature_2m ?? null,
      apparent_temperature: omJson?.current?.apparent_temperature ?? null,
      wind_speed_10m: omJson?.current?.wind_speed_10m ?? null,
      wind_gusts_10m: omJson?.current?.wind_gusts_10m ?? null,
      weather_code: omJson?.current?.weather_code ?? null,
      relative_humidity_2m: omJson?.current?.relative_humidity_2m ?? null,
      uv_index: omJson?.current?.uv_index ?? null,
      is_day: omJson?.current?.is_day ?? null,
    };

    const hourly: HourlyBlock = {
      time: omJson?.hourly?.time ?? [],
      temperature_2m: omJson?.hourly?.temperature_2m ?? [],
      apparent_temperature: omJson?.hourly?.apparent_temperature ?? [],
      weather_code: omJson?.hourly?.weather_code ?? [],
      uv_index: omJson?.hourly?.uv_index ?? [],
      wind_speed_10m: omJson?.hourly?.wind_speed_10m ?? [],
      wind_gusts_10m: omJson?.hourly?.wind_gusts_10m ?? [],
      relative_humidity_2m: omJson?.hourly?.relative_humidity_2m ?? [],
    };

    const daily: DailyBlock = {
      time: omJson?.daily?.time ?? [],
      temperature_2m_max: omJson?.daily?.temperature_2m_max ?? [],
      temperature_2m_min: omJson?.daily?.temperature_2m_min ?? [],
      weather_code: omJson?.daily?.weather_code ?? [],
    };

    // ---------- Build alerts via point first ----------
    const alertsSet = new Map<string, AlertItem>();
    const addAlerts = (features?: any[]) => {
      (features ?? []).forEach((f) => {
        const id = f?.id ?? crypto.randomUUID();
        if (!alertsSet.has(id)) {
          alertsSet.set(id, {
            id,
            event: f?.properties?.event,
            headline: f?.properties?.headline,
            description: f?.properties?.description,
            instruction: f?.properties?.instruction,
            areaDesc: f?.properties?.areaDesc,
          });
        }
      });
    };

    let pointOk = false;
    let pointStatus = 0;
    if (pointRes) {
      pointOk = pointRes.ok;
      pointStatus = pointRes.status ?? 0;
      try {
        const json = await pointRes.json().catch(async () => {
          // If HTML or bad JSON, try text to avoid throwing
          await pointRes.text();
          return null;
        });
        addAlerts(json?.features);
      } catch {
        // ignore parse error
      }
    }

    // ---------- Zone fallback (even if point failed) ----------
    const zonesUsed: string[] = [];
    if (alertsSet.size === 0 && pointsRes && pointsRes.ok) {
      try {
        const info = await pointsRes.json();
        const props = info?.properties ?? {};
        // props.forecastZone / county / fireWeatherZone are URLs like ".../zones/forecast/ALZ001"
        const zoneUrls = [props?.forecastZone, props?.county, props?.fireWeatherZone]
          .filter(Boolean)
          .map(String);

        // Extract "ALZ001" etc.
        const zoneIds = zoneUrls
          .map((z) => z.split("/").pop() as string)
          .filter(Boolean);

        // Fetch each zone's alerts with retry
        const zoneFetches = zoneIds.map((id) =>
          fetchWithRetry(
            `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(id)}`,
            { headers: NWS_HEADERS, next: { revalidate: 120 } }
          )
        );
        const zoneResps = await Promise.all(zoneFetches);

        for (let i = 0; i < zoneResps.length; i++) {
          const r = zoneResps[i];
          if (r && r.ok) {
            zonesUsed.push(zoneIds[i]!);
            try {
              const j = await r.json().catch(async () => {
                await r.text();
                return null;
              });
              addAlerts(j?.features);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const alerts = Array.from(alertsSet.values());
    const alerts_meta = {
      point: { ok: pointOk, status: pointStatus, url: pointAlertsUrl },
      zonesUsed,
      count: alerts.length,
    };

    return NextResponse.json(
      { current, hourly, daily, alerts, alerts_meta },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in weather API route:", err);
    return NextResponse.json(
      { error: "Failed to fetch forecast data from Open-Meteo" },
      { status: 500 }
    );
  }
}
