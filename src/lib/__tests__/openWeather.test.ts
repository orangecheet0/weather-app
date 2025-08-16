import { describe, it, expect, vi, afterEach } from 'vitest';
import { openWeather, clearCaches } from '../openWeather';

const originalApiKey = process.env.OPENWEATHER_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) {
    delete process.env.OPENWEATHER_API_KEY;
  } else {
    process.env.OPENWEATHER_API_KEY = originalApiKey;
  }
  clearCaches();
});

describe('openWeather', () => {
  it('returns weather data successfully', async () => {
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ lat: 10, lon: 20 }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ temp: 22 }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://example.com/api?city=London&unit=metric');
    const res = await openWeather('weather', req);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ temp: 22 });
  });

  it('serves cached data on subsequent requests', async () => {
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ lat: 10, lon: 20 }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ temp: 22 }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://example.com/api?city=Paris&unit=metric');
    const res1 = await openWeather('weather', req);
    expect(res1.status).toBe(200);

    // Second call should use cache
    const res2 = await openWeather('weather', req);
    expect(res2.status).toBe(200);

    // fetch should have been called only twice total (geocode + first weather fetch)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const data2 = await res2.json();
    expect(data2).toEqual({ temp: 22 });
  });

  it('returns 400 when city is missing', async () => {
    process.env.OPENWEATHER_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://example.com/api');
    const res = await openWeather('weather', req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe('City is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when API key is missing', async () => {
    delete process.env.OPENWEATHER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://example.com/api?city=London');
    const res = await openWeather('weather', req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.message).toBe('API key not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    process.env.OPENWEATHER_API_KEY = 'test-key';

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ lat: 10, lon: 20 }]), { status: 200 })
      )
      .mockRejectedValueOnce(new Error('Network failure'));
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://example.com/api?city=London');
    const res = await openWeather('weather', req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.message).toBe('Failed to fetch weather data');
    expect(data.details).toBe('Network failure');
  });

  it.each([
    'New York',
    'São Paulo',
  ])('encodes city names with spaces or special characters: %s', async (city) => {
    process.env.OPENWEATHER_API_KEY = 'test-key';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ lat: 10, lon: 20 }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ temp: 22 }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request(
      `https://example.com/api?city=${encodeURIComponent(city)}&unit=metric`
    );
    const res = await openWeather('weather', req);

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=test-key`
    );
  });
});
