import { NextResponse } from "next/server";

const validUnits = ["imperial", "metric", "standard"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const unit = searchParams.get("unit") || "imperial";

    if (!validUnits.includes(unit)) {
      return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
    }
    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const [forecastResponse, alertsResponse] = await Promise.all([
      fetchForecast(lat, lon, unit),
      fetchAlerts(lat, lon),
    ]);

    // Compute is_day using sunrise/sunset for the first day
    if (forecastResponse.current && forecastResponse.daily) {
      const sunrise = forecastResponse.daily.sunrise?.[0];
      const sunset  = forecastResponse.daily.sunset?.[0];

      if (sunrise && sunset) {
        const now = new Date(forecastResponse.current.time);
        const isDay =
          now >= new Date(sunrise) && now < new Date(sunset);

        forecastResponse.current.is_day = isDay;
      }
    }

    return NextResponse.json({
      ...forecastResponse,
      alerts: alertsResponse,
    });
  } catch (error) {
    console.error("Error in weather API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

async function fetchForecast(lat: string, lon: string, unit: string) {
  const temperature_unit = unit === "imperial" ? "fahrenheit" : "celsius";
  const wind_speed_unit = unit === "imperial" ? "mph" : "kmh";
  const precipitation_unit = unit === "imperial" ? "inch" : "mm";

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,uv_index,time",
    hourly:
      "temperature_2m,precipitation_probability,weather_code,uv_index",
    // ✅ Remove daily weather_code, keep sunrise/sunset
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,sunrise,sunset",
    forecast_days: "7",
    temperature_unit,
    wind_speed_unit,
    precipitation_unit,
    models: "meteoconcept",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!res.ok) {
    throw new Error("Failed to fetch forecast data from Open-Meteo");
  }

  return res.json();
}

async function fetchAlerts(lat: string, lon: string) {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
    const res = await fetch(url, {
      headers: { Accept: "application/geo+json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = await res.json();

    return Array.isArray(data?.features)
      ? data.features.map((f: any) => f.properties)
      : [];
  } catch {
    return [];
  }
}
