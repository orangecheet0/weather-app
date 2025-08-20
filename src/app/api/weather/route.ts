// app/api/weather/route.ts
import { NextRequest, NextResponse } from "next/server";

type Coords = { lat: number; lon: number };

// Shape the client components already expect
export type CurrentBlock = {
  time: string;
  temperature_2m: number | null;
  apparent_temperature: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  relative_humidity_2m: number | null;
  uv_index: number | null;
  is_day: number | null;
};

export type HourlyBlock = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
};

export type DailyBlock = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
};

export type AlertItem = {
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return badRequest("lat/lon required");
    }

    const tz = "auto";

    // Open‑Meteo forecast
    const omUrl = new URL("https://api.open-meteo.com/v1/forecast");
    omUrl.searchParams.set("latitude", String(lat));
    omUrl.searchParams.set("longitude", String(lon));
    omUrl.searchParams.set("timezone", tz);

    // Request current, hourly, daily data that your UI uses
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
        "time",
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
      ["time", "temperature_2m_max", "temperature_2m_min", "weather_code"].join(
        ","
      )
    );

    const [omRes, nwsRes] = await Promise.all([
      fetch(omUrl.toString(), { next: { revalidate: 300 } }),
      // NWS alerts (needs a UA)
      fetch(
        `https://api.weather.gov/alerts/active?point=${lat.toFixed(
          4
        )},${lon.toFixed(4)}`,
        {
          headers: {
            "User-Agent":
              "alweather.org (contact@alweather.org) – personal non-commercial",
            Accept: "application/geo+json",
          },
          next: { revalidate: 120 },
        }
      ).catch(() => null), // don’t fail if NWS is unhappy
    ]);

    if (!omRes.ok) {
      const text = await omRes.text().catch(() => "");
      throw new Error(`Open-Meteo failed (${omRes.status}): ${text.slice(0, 200)}`);
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
      temperature_2_m_min: undefined as never, // just to guard typos at author time
      temperature_2m_min: omJson?.daily?.temperature_2m_min ?? [],
      weather_code: omJson?.daily?.weather_code ?? [],
    };

    let alerts: AlertItem[] = [];
    if (nwsRes && nwsRes.ok) {
      const nws = (await nwsRes.json()) as any;
      const features: any[] = nws?.features ?? [];
      alerts = features.map((f) => ({
        id: f?.id ?? crypto.randomUUID(),
        event: f?.properties?.event,
        headline: f?.properties?.headline,
        description: f?.properties?.description,
        instruction: f?.properties?.instruction,
        areaDesc: f?.properties?.areaDesc,
      }));
    }

    return NextResponse.json(
      {
        current,
        hourly,
        daily,
        alerts,
      },
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
