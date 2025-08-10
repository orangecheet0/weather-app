import { NextResponse } from 'next/server';

// TypeScript interface for response type
// Defines the shape of the forecast data returned by OpenWeatherMap.
interface ForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: {
    dt: number;
    main: {
      temp: number;
    };
    weather: {
      description: string;
      icon: string;
    }[];
  }[];
  city: {
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  // Change 1: Default unit to 'imperial'
  const unit = searchParams.get('unit') || 'imperial'; // Default to imperial
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!city) {
    return NextResponse.json({ message: 'City is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ message: 'API key not configured' }, { status: 500 });
  }

  // Change 2: Validate unit parameter, fallback to 'imperial'
  // Ensures unit is valid; otherwise, defaults to 'imperial'.
  const validUnits = ['metric', 'imperial', 'standard'];
  const validatedUnit = validUnits.includes(unit) ? unit : 'imperial';

  // Fetch lat/lon from city using Geocoding API (to avoid deprecated q= parameter)
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
  let lat, lon;
  try {
    const geoResponse = await fetch(geoUrl);
    if (!geoResponse.ok) {
      const geoData = await geoResponse.json();
      return NextResponse.json({ message: geoData.message || 'City not found' }, { status: geoResponse.status });
    }
    const geoData = await geoResponse.json();
    if (geoData.length === 0) {
      return NextResponse.json({ message: 'City not found' }, { status: 404 });
    }
    lat = geoData[0].lat;
    lon = geoData[0].lon;
  } catch (geoError) {
    console.error('Geocoding error:', geoError);
    return NextResponse.json({ message: 'Failed to geocode city', details: geoError.message }, { status: 500 });
  }

  // Use lat/lon for the forecast URL
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${validatedUnit}`;

  // Add fetch timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear timeout if fetch succeeds

    // Improved error handling for JSON parsing
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return NextResponse.json({ message: 'Invalid API response' }, { status: 500 });
    }

    if (response.ok) {
      // Return typed response
      return NextResponse.json<ForecastResponse>(data);
    } else {
      return NextResponse.json({ message: data.message || 'Error fetching forecast data' }, { status: response.status });
    }
  } catch (error) {
    // Log and include error details
    console.error('Forecast fetch error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch forecast data', details: error.message },
      { status: 500 }
    );
  }
}