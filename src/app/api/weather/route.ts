import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!city) {
    return NextResponse.json({ message: 'City is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ message: 'API key not configured' }, { status: 500 });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ message: data.message || 'Error fetching weather data' }, { status: response.status });
    }
  } catch (_error) { // Changed 'error' to '_error'
    return NextResponse.json({ message: 'Failed to fetch weather data' }, { status: 500 });
  }
}