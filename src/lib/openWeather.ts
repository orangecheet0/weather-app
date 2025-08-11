import { NextResponse } from 'next/server';

type Endpoint = 'weather' | 'forecast';

const validUnits = ['metric', 'imperial', 'standard'];

export async function openWeather(endpoint: Endpoint, request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const unit = searchParams.get('unit') || 'imperial';
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!city) {
    return NextResponse.json({ message: 'City is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ message: 'API key not configured' }, { status: 500 });
  }

  const validatedUnit = validUnits.includes(unit) ? unit : 'imperial';

  const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${apiKey}`;
  let lat: number;
  let lon: number;

  try {
    const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
    const geoData = await geoResponse.json();
    if (!geoResponse.ok) {
      return NextResponse.json(
        { message: geoData.message || 'City not found' },
        { status: geoResponse.status }
      );
    }
    if (geoData.length === 0) {
      return NextResponse.json({ message: 'City not found' }, { status: 404 });
    }
    lat = geoData[0].lat;
    lon = geoData[0].lon;
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { message: 'Failed to geocode city', details: (error as Error).message },
      { status: 500 }
    );
  }

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${validatedUnit}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { message: data.message || `Error fetching ${endpoint} data` },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error(`${endpoint} fetch error:`, error);
    return NextResponse.json(
      { message: `Failed to fetch ${endpoint} data`, details: (error as Error).message },
      { status: 500 }
    );
  }
}
