// This file is a Next.js API Route. It runs on the server, not in the browser.
import { NextResponse } from "next/server";

const validUnits = ["imperial", "metric", "standard"];

// We define an async function for GET requests.
// When you fetch '/api/weather', this function will run.
export async function GET(request: Request) {
  try {
    // 1. Get location and unit params from the request URL
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const unit = searchParams.get("unit") || "imperial";
    if (!validUnits.includes(unit)) {
      return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
    }

    // If we don't have lat or lon, return an error
    if (!lat || !lon) {
      return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 });
    }

    // 2. Fetch the main forecast from Open-Meteo
    const forecastPromise = fetchForecast(lat, lon, unit);

    // 3. Fetch alerts from Weather.gov
    // Note: This API is for the US only.
    const alertsPromise = fetchAlerts(lat, lon);

    // 4. Wait for both API calls to complete at the same time
    const [forecastResponse, alertsResponse] = await Promise.all([forecastPromise, alertsPromise]);

    // 5. Combine the results and send them back to the browser
    return NextResponse.json({
      ...forecastResponse,
      alerts: alertsResponse,
    });
  } catch (error) {
    console.error("Error in weather API route:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream request timed out" },
        { status: 504 }
      );
    }
    // If anything goes wrong, send a generic server error response
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

// --- Helper function to get the forecast ---
async function fetchForecast(lat: string, lon: string, unit: string) {
  const temperature_unit = unit === "imperial" ? "fahrenheit" : "celsius";
  const wind_speed_unit = unit === "imperial" ? "mph" : "kmh";
  const precipitation_unit = unit === "imperial" ? "inch" : "mm";

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,uv_index",
    hourly: "temperature_2m,precipitation_probability,weather_code,uv_index",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,uv_index_max",
    forecast_days: "7",
    temperature_unit,
    wind_speed_unit,
    precipitation_unit,
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!res.ok) {
    throw new Error("Failed to fetch forecast data from Open-Meteo");
  }

  return res.json();
}

// --- Helper function to get alerts ---
async function fetchAlerts(lat: string, lon: string) {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
    const res = await fetch(url, {
      headers: { Accept: "application/geo+json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn("Could not fetch alerts from weather.gov");
      return []; // Return empty array on failure, don't break the whole request
    }

    const data = await res.json();
    // We only need the 'features' array from the response
    return Array.isArray(data?.features) ? data.features : [];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    console.warn("Error fetching alerts:", error);
    return []; // Return empty array on any error
  }
}
