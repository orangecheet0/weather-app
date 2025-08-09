'use client';

import { useState } from 'react';

export default function Home() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState('temperature');

  const layers = [
    { value: 'temperature', label: 'Temperature' },
    { value: 'precipitation', label: 'Precipitation' },
    { value: 'clouds', label: 'Clouds' },
    { value: 'wind', label: 'Wind' },
  ];

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    setWeather(null);
    setForecast(null);

    try {
      // Fetch current weather
      const weatherRes = await fetch(`/api/weather?city=${city}`);
      const weatherData = await weatherRes.json();
      if (!weatherRes.ok) {
        throw new Error(weatherData.message || 'City not found');
      }
      setWeather(weatherData);

      // Fetch forecast
      const forecastRes = await fetch(`/api/forecast?city=${city}`);
      const forecastData = await forecastRes.json();
      if (!forecastRes.ok) {
        throw new Error(forecastData.message || 'Forecast unavailable');
      }
      setForecast(forecastData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Header */}
      <h1 className="text-3xl font-bold mb-4">Weather App</h1>

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Enter city name (e.g., London)"
          className="flex-grow p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
        </div>
      )}

      {/* Current Weather */}
      {weather && (
        <div className="bg-white p-4 rounded shadow mb-4">
          <h2 className="text-2xl font-semibold">{weather.name}</h2>
          <p className="text-lg capitalize">{weather.weather[0].description}</p>
          <p className="text-3xl">{Math.round(weather.main.temp)}°C</p>
          <img
            src={`http://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
            alt="Weather icon"
            className="w-16 h-16"
          />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <p>Humidity: {weather.main.humidity}%</p>
            <p>Wind: {weather.wind.speed} m/s</p>
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {forecast.list.slice(0, 5).map((item: any, index: number) => (
            <div key={index} className="bg-white p-4 rounded shadow">
              <p className="font-medium">
                {new Date(item.dt * 1000).toLocaleDateString()}
              </p>
              <p>{Math.round(item.main.temp)}°C</p>
              <p className="capitalize">{item.weather[0].description}</p>
              <img
                src={`http://openweathermap.org/img/wn/${item.weather[0].icon}.png`}
                alt="Weather icon"
                className="w-12 h-12"
              />
            </div>
          ))}
        </div>
      )}

      {/* Weather Map */}
      {weather && (
        <div className="mb-4">
          <label htmlFor="mapLayer" className="block mb-2 font-medium">
            Select Map Layer:
          </label>
          <select
            id="mapLayer"
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value)}
            className="p-2 border rounded mb-2 w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {layers.map((layer) => (
              <option key={layer.value} value={layer.value}>
                {layer.label}
              </option>
            ))}
          </select>
          <iframe
            src={`https://openweathermap.org/weathermap?basemap=map&cities=true&layer=${mapLayer}&lat=${weather.coord.lat}&lon=${weather.coord.lon}&zoom=10`}
            width="100%"
            height="400"
            className="rounded border"
            title="Weather Map"
          />
        </div>
      )}
    </div>
  );
}