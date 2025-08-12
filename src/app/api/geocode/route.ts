import { NextResponse } from 'next/server';

// This defines the shape of the data returned by OpenWeatherMap's geocoding API,
// ensuring the code knows what to expect (e.g., city name, coordinates).
interface GeocodeResponse {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string; // Optional, as not all responses include state
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const apiKey = process.env.OPENWEATHER_API_KEY;

  // Existing validation for missing lat/lon
  if (!lat || !lon) {
    return NextResponse.json({ message: 'Latitude and longitude are required' }, { status: 400 });
  }

  // This checks if lat/lon are valid numbers and within correct ranges
  // (lat: -90 to 90, lon: -180 to 180) to prevent invalid API calls.
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ message: 'Invalid latitude or longitude' }, { status: 400 });
  }

  // Changed 'http' to 'https' for secure communication to protect the API key.
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latNum}&lon=${lonNum}&limit=1&appid=${apiKey}`;

  // This ensures the fetch doesn't hang if the API is slow, timing out after 5 seconds.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear timeout if fetch succeeds

    // This safely handles JSON parsing and provides detailed error messages.
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ message: 'Invalid API response' }, { status: 500 });
    }

    if (response.ok && data.length > 0) {
      // Return data with TypeScript type for clarity and safety.
      return NextResponse.json<GeocodeResponse>(data[0]);
    } else {
      return NextResponse.json({ message: data.message || 'City not found' }, { status: 404 });
    }
  } catch (error) {
    // This helps debug issues by logging the error and sending its message to the client.
    console.error('Geocode fetch error:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: 'Failed to fetch geocode data', details },
      { status: 500 }
    );
  }
}
