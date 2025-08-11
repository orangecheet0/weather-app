import { NextResponse } from 'next/server';

// TypeScript interface for One Call API 3.0 response (simplified for alerts)
interface OneCallResponse {
  alerts?: {
    event: string;
    start: number;
    end: number;
    description: string;
  }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const unit = searchParams.get('unit') || 'imperial'; // Default to imperial
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!lat || !lon) {
    return NextResponse.json({ message: 'Latitude and longitude are required' }, { status: 400 });
  }

  // Validate lat/lon
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ message: 'Invalid latitude or longitude' }, { status: 400 });
  }

  // Validate unit
  const validUnits = ['metric', 'imperial', 'standard'];
  const validatedUnit = validUnits.includes(unit) ? unit : 'imperial';

  // Use One Call API 3.0 (requires subscription)
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=${validatedUnit}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const contentType = response.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) {
      console.error('OneCall response is not JSON:', contentType);
      return NextResponse.json({ message: 'Invalid API response' }, { status: 500 });
    }
    console.log('OneCall response status:', response.status);
    const data = await response.json();
    if (response.ok) {
      return NextResponse.json<OneCallResponse>(data);
    } else {
      if (response.status === 429) {
        return NextResponse.json({ message: 'API rate limit exceeded, try again later' }, { status: 429 });
      }
      if (response.status === 401) {
        return NextResponse.json({ message: 'Invalid API key or subscription required for One Call 3.0' }, { status: 401 });
      }
      return NextResponse.json({ message: data.message || 'Error fetching alert data' }, { status: response.status });
    }
  } catch (error) {
    console.error('OneCall fetch error:', error);
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: 'Failed to fetch alert data', details },
      { status: 500 }
    );
  }
}