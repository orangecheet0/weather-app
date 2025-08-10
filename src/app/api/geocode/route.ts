import { NextResponse } from 'next/server';

// Suggestion 5: Add TypeScript interface for response type
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

  // Suggestion 2: Validate lat and lon values
  // This checks if lat/lon are valid numbers and within correct ranges
  // (lat: -90 to 90, lon: -180 to 180) to prevent invalid API calls.
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ message: 'Invalid latitude or longitude' }, { status: 400 });
  }

  // Suggestion 1: Switch to HTTPS
  // Changed 'http' to 'https' for secure communication to protect the API key.
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latNum}&lon=${lonNum}&limit=1&appid=${apiKey}`;

  // Suggestion 4: Add fetch timeout
  // This ensures the fetch doesn't hang if the API is slow, timing out after 5 seconds.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear timeout if fetch succeeds

    // Suggestion 3: Improve error handling
    // This safely handles JSON parsing and provides detailed error messages.
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ message: 'Invalid API response' }, { status: 500 });
    }

    if (response.ok && data.length > 0) {
      // Suggestion 5: Use typed response
      // Return data with TypeScript type for clarity and safety.
      return NextResponse.json<GeocodeResponse>(data[0]);
    } else {
      return NextResponse.json({ message: data.message || 'City not found' }, { status: 404 });
    }
  } catch (error) {
    // Suggestion 3: Log and include error details
    // This helps debug issues by logging the error and sending its message to the client.
    console.error('Geocode fetch error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch geocode data', details: error.message },
      { status: 500 }
    );
  }
}