'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cloud, Droplets, Thermometer, Wind, CloudRain, Cloudy,
  Search, MapPin
} from 'lucide-react';

// Types
interface Weather {
  name: string;
  main: { temp: number; humidity: number };
  weather: { description: string; icon: string; main: string }[];
  wind: { speed: number };
  coord: { lat: number; lon: number };
}
interface Forecast {
  list: { dt: number; main: { temp: number }; weather: { description: string; icon: string }[] }[];
}
interface Alert { event: string; start: number; end: number; description: string; }
type OpenMeteoCurrent = {
  temperature_2m: number;
  windspeed_10m: number;
  cloudcover: number;
  precipitation: number;
};

export default function Home() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to imperial (°F, mph, inches)
  const [unit, setUnit] = useState<'metric' | 'imperial'>('imperial');
  const [mapLayer, setMapLayer] = useState<'temperature' | 'precipitation' | 'clouds' | 'wind'>('temperature');

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [openMeteo, setOpenMeteo] = useState<OpenMeteoCurrent | null>(null);

  // UI layer -> Windy overlay keys
  const layerMap: Record<typeof mapLayer, string> = {
    temperature: 'temp',
    precipitation: 'rain',
    clouds: 'clouds',
    wind: 'wind',
  };

  const layers = [
    { value: 'temperature' as const, label: 'Temperature', icon: Thermometer },
    { value: 'precipitation' as const, label: 'Precipitation', icon: CloudRain },
    { value: 'clouds' as const, label: 'Clouds', icon: Cloudy },
    { value: 'wind' as const, label: 'Wind', icon: Wind },
  ];

  const getBackgroundClass = (main?: string) => {
    switch (main?.toLowerCase()) {
      case 'clear': return 'bg-gradient-to-br from-yellow-500 to-orange-700';
      case 'clouds': return 'bg-gradient-to-br from-gray-600 to-blue-700';
      case 'rain':
      case 'drizzle': return 'bg-gradient-to-br from-blue-800 to-indigo-900';
      case 'thunderstorm': return 'bg-gradient-to-br from-gray-900 to-purple-900';
      case 'snow': return 'bg-gradient-to-br from-blue-300 to-white';
      case 'mist':
      case 'fog': return 'bg-gradient-to-br from-gray-500 to-gray-700';
      default: return 'bg-gradient-to-br from-blue-300 to-indigo-700';
    }
  };

  const fetchOpenMeteo = async (lat: number, lon: number) => {
    const tempUnit = unit === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = unit === 'imperial' ? 'mph' : 'kmh';
    const precipUnit = unit === 'imperial' ? 'inch' : 'mm';

    const omRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,cloudcover,windspeed_10m` +
      `&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}&precipitation_unit=${precipUnit}`
    );
    const omData = await omRes.json();
    setOpenMeteo(omData.current as OpenMeteoCurrent);
  };

  const fetchWeather = async (cityName: string) => {
    if (!cityName.trim()) return;
    setLoading(true);
    setError(null);
    setWeather(null);
    setForecast(null);
    setAlerts([]);
    try {
      const weatherRes = await fetch(`/api/weather?city=${encodeURIComponent(cityName)}&unit=${unit}`);
      const weatherData: Weather & { message?: string } = await weatherRes.json();
      if (!weatherRes.ok) throw new Error(weatherData.message || 'City not found');
      setWeather(weatherData);

      // Use OpenWeather's coords to move the map and refresh Open-Meteo for searched city
      if (weatherData?.coord?.lat && weatherData?.coord?.lon) {
        setCoords({ lat: weatherData.coord.lat, lon: weatherData.coord.lon });
        fetchOpenMeteo(weatherData.coord.lat, weatherData.coord.lon);
      }

      const forecastRes = await fetch(`/api/forecast?city=${encodeURIComponent(cityName)}&unit=${unit}`);
      const forecastData: Forecast & { message?: string } = await forecastRes.json();
      if (!forecastRes.ok) throw new Error(forecastData.message || 'Forecast unavailable');
      setForecast(forecastData);

      const alertsRes = await fetch(`/api/onecall?lat=${weatherData.coord.lat}&lon=${weatherData.coord.lon}&unit=${unit}`);
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while fetching weather data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const locateMe = async () => {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const here = { lat: latitude, lon: longitude };
      setCoords(here);

      // Reverse geocode to city name then fetch weather
      const geo = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
      const geoData = await geo.json();
      if (geo.ok) {
        const cityName = geoData.name || 'Unknown City';
        setCity(cityName);
        fetchWeather(cityName);
      } else {
        throw new Error('Unable to get city name');
      }
      await fetchOpenMeteo(latitude, longitude);
    } catch {
      // Fallback: Huntsville so the map/cards still render
      setError('Could not get your location. Showing default weather.');
      const fallback = { lat: 34.7304, lon: -86.5861 }; // Huntsville, AL
      setCoords(fallback);
      setCity('Huntsville');
      await fetchOpenMeteo(fallback.lat, fallback.lon);
      fetchWeather('Huntsville');
    }
  };

  // Locate once on mount
  useEffect(() => {
    locateMe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On unit change, refetch Open-Meteo + city weather (no geolocation prompt)
  useEffect(() => {
    if (coords) fetchOpenMeteo(coords.lat, coords.lon);
    if (city) fetchWeather(city);
  }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animations
  const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
  const gridContainerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.12 } } };
  const gridItemVariants = {
    hidden: { opacity: 0, y: 18, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 220, damping: 22 },
    },
  };

  // Format helpers
  const formatPrecip = (val: number | undefined | null) => {
    if (val == null || Number.isNaN(val)) return unit === 'imperial' ? '0.00 in' : '0.0 mm';
    return unit === 'imperial' ? `${val.toFixed(2)} in` : `${val.toFixed(1)} mm`;
  };

  return (
    <div className={`min-h-screen p-4 ${getBackgroundClass(weather?.weather[0]?.main)} transition-colors duration-500`}>
      <motion.div
        className="mx-auto max-w-4xl bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-2xl"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
      >
        {/* Header */}
        <h1 className="text-4xl font-bold text-gray-900 mb-6 drop-shadow-lg">ALWeather</h1>

        {/* Glassy Toolbar */}
        <div className="mb-6">
          <div className="w-full rounded-xl bg-white/45 backdrop-blur-xl ring-1 ring-black/5 shadow-lg p-2 flex flex-wrap gap-2 items-center">
            {/* Location */}
            <button
              onClick={locateMe}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 hover:bg-white/80 transition shadow"
              title="Use my location"
            >
              <MapPin size={18} />
              <span className="hidden sm:inline">My Location</span>
            </button>

            {/* Search input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Search city (e.g., Huntsville)"
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-white/60 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-600 transition shadow"
              />
            </div>

            {/* Search button */}
            <button
              onClick={() => fetchWeather(city)}
              disabled={loading || !city.trim()}
              className="px-4 py-2 rounded-lg bg-blue-700 text-white font-medium shadow hover:bg-blue-800 disabled:bg-gray-400 transition"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>

            {/* Unit toggle */}
            <div className="flex rounded-lg overflow-hidden shadow">
              <button
                onClick={() => setUnit('imperial')}
                className={`px-4 py-2 font-medium flex items-center gap-2 ${unit === 'imperial' ? 'bg-blue-600 text-white' : 'bg-white/60 hover:bg-white/80'}`}
                aria-pressed={unit === 'imperial'}
              >
                <Thermometer size={16} /> °F
              </button>
              <button
                onClick={() => setUnit('metric')}
                className={`px-4 py-2 font-medium flex items-center gap-2 ${unit === 'metric' ? 'bg-blue-600 text-white' : 'bg-white/60 hover:bg-white/80'}`}
                aria-pressed={unit === 'metric'}
              >
                <Thermometer size={16} /> °C
              </button>
            </div>
          </div>
        </div>

        {/* Errors */}
        {error && (
          <motion.div className="bg-red-300 text-gray-900 p-4 rounded-lg mb-6 shadow-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.div>
        )}

        {/* Alerts */}
        {alerts.length > 0 &&
          alerts.map((alert, i) => (
            <motion.div key={i} className="bg-yellow-300 p-4 rounded-lg mb-6 shadow-lg" variants={cardVariants} initial="hidden" animate="visible">
              <h3 className="font-semibold">{alert.event}</h3>
              <p>{alert.description}</p>
              <p className="text-sm">
                From: {new Date(alert.start * 1000).toLocaleString()} — To: {new Date(alert.end * 1000).toLocaleString()}
              </p>
            </motion.div>
          ))}

        {/* Current Weather */}
        {weather && (
          <motion.div className="bg-white/70 p-6 rounded-xl shadow-lg mb-6" variants={cardVariants} initial="hidden" animate="visible">
            <h2 className="text-2xl font-semibold text-gray-900">{weather.name}</h2>
            <p className="text-lg capitalize text-gray-900">{weather.weather[0].description}</p>
            <p className="text-4xl text-gray-900">
              {Math.round(weather.main.temp)}°{unit === 'imperial' ? 'F' : 'C'}
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4 text-gray-900">
              <p>Humidity: {weather.main.humidity}%</p>
              <p>Wind: {weather.wind.speed} {unit === 'imperial' ? 'mph' : 'm/s'}</p>
            </div>
          </motion.div>
        )}

        {/* Forecast */}
        {forecast && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {forecast.list.slice(0, 5).map((item, i) => (
              <motion.div key={i} className="bg-white/70 p-4 rounded-lg shadow-lg" variants={cardVariants} initial="hidden" animate="visible">
                <p className="font-medium">{new Date(item.dt * 1000).toLocaleDateString()}</p>
                <p>{Math.round(item.main.temp)}°{unit === 'imperial' ? 'F' : 'C'}</p>
                <p className="capitalize">{item.weather[0].description}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Windy Map + Controls + Animated Open-Meteo Cards */}
        {coords && (
          <motion.div className="bg-white/70 p-6 rounded-xl shadow-lg mb-20" variants={cardVariants} initial="hidden" animate="visible">
            <h3 className="mb-4 font-medium text-xl">Live Weather Map</h3>

            {/* Segmented Layer Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {layers.map((layer) => {
                const Icon = layer.icon;
                const active = mapLayer === layer.value;
                return (
                  <motion.button
                    key={layer.value}
                    onClick={() => setMapLayer(layer.value)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={active}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition ${
                      active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                  >
                    <Icon size={18} />
                    {layer.label}
                  </motion.button>
                );
              })}
            </div>

            {/* Windy Map (fade on layer/unit change) */}
            <motion.iframe
              key={`${layerMap[mapLayer]}-${unit}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
              src={`https://embed.windy.com/embed2.html?lat=${coords.lat}&lon=${coords.lon}&zoom=6&level=surface&overlay=${layerMap[mapLayer]}&marker=true&detail=true&detailLat=${coords.lat}&detailLon=${coords.lon}&metricWind=${unit === 'imperial' ? 'mph' : 'km%2Fh'}&metricTemp=${unit === 'imperial' ? '%F' : '%C'}`}
              width="100%"
              height="400"
              className="rounded-lg border-none mb-6"
              title="Windy Map"
            />

            {/* Animated metric cards */}
            {openMeteo && (
              <motion.div
                key={`metrics-${unit}`}
                variants={gridContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
              >
                <motion.div variants={gridItemVariants} className="bg-blue-100 p-4 rounded-lg flex flex-col items-center shadow">
                  <Thermometer className="text-blue-800 mb-2" size={32} />
                  <p className="text-lg font-semibold">{openMeteo.temperature_2m}°{unit === 'imperial' ? 'F' : 'C'}</p>
                  <span className="text-sm text-gray-700">Temperature</span>
                </motion.div>

                <motion.div variants={gridItemVariants} className="bg-yellow-100 p-4 rounded-lg flex flex-col items-center shadow">
                  <Wind className="text-yellow-700 mb-2" size={32} />
                  <p className="text-lg font-semibold">{openMeteo.windspeed_10m} {unit === 'imperial' ? 'mph' : 'km/h'}</p>
                  <span className="text-sm text-gray-700">Wind Speed</span>
                </motion.div>

                <motion.div variants={gridItemVariants} className="bg-gray-100 p-4 rounded-lg flex flex-col items-center shadow">
                  <Cloud className="text-gray-600 mb-2" size={32} />
                  <p className="text-lg font-semibold">{openMeteo.cloudcover}%</p>
                  <span className="text-sm text-gray-700">Cloud Cover</span>
                </motion.div>

                <motion.div variants={gridItemVariants} className="bg-indigo-100 p-4 rounded-lg flex flex-col items-center shadow">
                  <Droplets className="text-indigo-700 mb-2" size={32} />
                  <p className="text-lg font-semibold">{formatPrecip(openMeteo.precipitation)}</p>
                  <span className="text-sm text-gray-700">Precipitation</span>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
