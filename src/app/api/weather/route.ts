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

const NWS_HEADERS = {
  "User-Agent":
    "alweather.org (contact@alweather.org) – personal non-commercial",
  Accept: "application/geo+json",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const unit = (searchParams.get("unit") as Unit) || "metric";
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return badRequest("lat/lon required");
    }

    // ---- Open-Meteo (respect units) -------------------------------------------------
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

    // ---- NWS alerts (point + zone fallback) -----------------------------------------
    const pointUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(
      4
    )},${lon.toFixed(4)}`;

    // Also prepare a request for zones via points endpoint
    const zonesInfoUrl = `https://api.weather.gov/points/${lat.toFixed(
      4
    )},${lon.toFixed(4)}`;

    const [omRes, pointRes, zonesInfoRes] = await Promise.all([
      fetch(omUrl.toString(), { next: { revalidate: 300 } }),
      fetch(pointUrl, { headers: NWS_HEADERS, next: { revalidate: 120 } }).catch(
        () => null
      ),
      fetch(zonesInfoUrl, { headers: NWS_HEADERS, next: { revalidate: 300 } }).catch(
        () => null
      ),
    ]);

    if (!omRes.ok) {
      const text = await omRes.text().catch(() => "");
      throw new Error(
        `Open-Meteo failed (${omRes.status}): ${text.slice(0, 200)}`
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

    // ---- Build alerts from point + zone fallback ------------------------------------
    const alertsSet = new Map<string, AlertItem>();
    const addAlerts = (features: any[] | undefined | null) => {
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

    // 1) Try point
    let pointOk = false;
    let pointStatus = 0;
    if (pointRes) {
      pointOk = pointRes.ok;
      pointStatus = pointRes.status;
      try {
        const json = await pointRes.json();
        addAlerts(json?.features);
      } catch {
        // ignore parse errors
      }
    }

    // 2) If none found via point, try zones
    let zonesFetched: string[] = [];
    if (alertsSet.size === 0 && zonesInfoRes && zonesInfoRes.ok) {
      try {
        const info = await zonesInfoRes.json();
        const props = info?.properties ?? {};
        const zoneCandidates = [
          props?.forecastZone,
          props?.county,
          props?.fireWeatherZone,
        ]
          .filter(Boolean)
          .map(String);

        // Fetch alerts for each zone id (urls already absolute)
        const zoneFetches = zoneCandidates.map((zoneUrl) =>
          fetch(
            `https://api.weather.gov/alerts/active?zone=${encodeURIComponent(
              zoneUrl.split("/").pop() as string
            )}`,
            { headers: NWS_HEADERS, next: { revalidate: 120 } }
          ).catch(() => null)
        );

        const zoneResList = await Promise.all(zoneFetches);
        for (let i = 0; i < zoneResList.length; i++) {
          const r = zoneResList[i];
          if (r && r.ok) {
            zonesFetched.push(zoneCandidates[i] as string);
            try {
              const json = await r.json();
              addAlerts(json?.features);
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const alerts = Array.from(alertsSet.values());

    const alerts_meta = {
      point: { ok: pointOk, status: pointStatus, url: pointUrl },
      zonesUsed: zonesFetched,
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
