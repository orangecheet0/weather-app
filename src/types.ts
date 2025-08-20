export type Unit = "imperial" | "metric";

export interface Coords {
  lat: number;
  lon: number;
}

export interface LocationState {
  coords: Coords;
  name: string;
  admin1?: string;
  country?: string;
}

export interface CurrentBlock {
  time: string;
  temperature_2m: number | null;
  apparent_temperature: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  relative_humidity_2m: number | null;
  uv_index: number | null;
  /** 1 = day, 0 = night (from Open‑Meteo) */
  is_day?: number;
}

export interface DailyBlock {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  weather_code: (number | null)[];
  uv_index_max?: (number | null)[];
}

export interface HourlyBlock {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation_probability: (number | null)[];
  weather_code: (number | null)[];
  uv_index?: (number | null)[];
}

export interface AlertItem {
  id: string;
  event: string;
  headline?: string;
  severity?: string;
  effective?: string;
  ends?: string;
  description?: string;
  instruction?: string;
  areaDesc?: string;
}

export type WeatherData = {
  current: CurrentBlock;
  daily: DailyBlock;
  hourly: HourlyBlock;
  alerts: AlertItem[];
};

export type SearchCandidate = {
  coords: { lat: number; lon: number };
  name: string;
  admin1?: string;
  country: string;
};

export type OWMGeocodeResult = {
  lat: number;
  lon: number;
  name: string;
  state?: string;
  country: string;
};

export type ThemeKey =
  | "clearDay"
  | "clearNight"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm";
