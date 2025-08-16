import { NextResponse } from 'next/server';

type Endpoint = 'weather' | 'forecast';

const validUnits = ['metric', 'imperial', 'standard'];

// Cache configuration
const TEN_MINUTES = 10 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  expires: number;
}

// In-memory caches for geocode and weather/forecast responses
const geocodeCache = new Map<string, CacheEntry<{ lat: number; lon: number }>>();
const forecastCache = new Map<string, CacheEntry<unknown>>();

function getCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data;
  }
  cache.delete(key);
  return undefined;
}

export function clearCaches() {
  geocodeCache.clear();
  forecastCache.clear();
}

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

  const forecastKey = `${endpoint}:${city.toLowerCase()}:${validatedUnit}`;
  const cachedForecast = getCacheEntry(forecastCache, forecastKey);
  if (cachedForecast) {
    return NextResponse.json(cachedForecast);
  }

  const geoKey = city.toLowerCase();
  let coords = getCacheEntry(geocodeCache, geoKey);
  if (!coords) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
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
      coords = { lat: geoData[0].lat, lon: geoData[0].lon };
      geocodeCache.set(geoKey, { data: coords, expires: Date.now() + TEN_MINUTES });
    } catch (error) {
      console.error('Geocoding error:', error);
      return NextResponse.json(
        { message: 'Failed to geocode city', details: (error as Error).message },
        { status: 500 }
      );
    }
  }

  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=${validatedUnit}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    if (response.ok) {
      forecastCache.set(forecastKey, { data, expires: Date.now() + TEN_MINUTES });
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
