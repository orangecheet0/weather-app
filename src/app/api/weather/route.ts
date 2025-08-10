import { NextResponse } from 'next/server';

// TypeScript interface for response type
interface WeatherResponse {
  name: string;
  main: {
    temp: number;
    humidity: number;
  };
  weather: {
    description: string;
    icon: string;
    main: string;
  }[];
  wind: {
    speed: number;
  };
  coord: {
    lat: number;
    lon: number;
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const unit = searchParams.get('unit') || 'imperial'; // Default to imperial
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!city) {
    return NextResponse.json({ message: 'City is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ message: 'API key not configured' }, { status: 500 });
  }

  // Validate unit parameter
  const validUnits = ['metric', 'imperial', 'standard'];
  const validatedUnit = validUnits.includes(unit) ? unit : 'imperial';

  // Fetch lat/lon from city using Geocoding API
  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
  let lat, lon;
  try {
    const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
    // New: Check Content-Type before parsing
    const contentType = geoResponse.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      console.error('Geocoding response is not JSON:', contentType);
      return NextResponse.json({ message: 'Invalid geocoding API response' }, { status: 500 });
    }
    // New: Log status for debugging
    console.log('Geocoding response status:', geoResponse.status);
    const geoData = await geoResponse.json();
    if (!geoResponse.ok) {
      return NextResponse.json({ message: geoData.message || 'City not found' }, { status: geoResponse.status });
    }
    if (geoData.length === 0) {
      return NextResponse.json({ message: 'City not found' }, { status: 404 });
    }
    lat = geoData[0].lat;
    lon = geoData[0].lon;
  } catch (geoError) {
    console.error('Geocoding error:', geoError);
    return NextResponse.json({ message: 'Failed to geocode city', details: geoError.message }, { status: 500 });
  }

  // Fetch weather data
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${validatedUnit}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    // New: Check Content-Type before parsing
    const contentType = response.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      console.error('Weather response is not JSON:', contentType);
      return NextResponse.json({ message: 'Invalid weather API response' }, { status: 500 });
    }
    // New: Log status for debugging
    console.log('Weather response status:', response.status);
    const data = await response.json();
    if (response.ok) {
      return NextResponse.json<WeatherResponse>(data);
    } else {
      // New: Handle 429 rate limit explicitly
      if (response.status === 429) {
        return NextResponse.json({ message: 'API rate limit exceeded, try again later' }, { status: 429 });
      }
      return NextResponse.json({ message: data.message || 'Error fetching weather data' }, { status: response.status });
    }
  } catch (error) {
    console.error('Weather fetch error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch weather data', details: error.message },
      { status: 500 }
    );
  }
}