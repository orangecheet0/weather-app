// src/types.ts

export type Unit = "imperial" | "metric";

export type Coords = { lat: number; lon: number };

export type SearchCandidate = {
  coords: Coords;
  name: string;
  admin1?: string | null;
  country?: string | null;
};

export type LocationState = SearchCandidate;

export type OWMGeocodeResult = {
  name: string;
  lat: number;
  lon: number;
  state?: string;
  country?: string;
};

export interface CurrentBlock {
  time: string;
  temperature_2m: number | null;
  apparent_temperature: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  relative_humidity_2m: number | null;
  uv_index: number | null;
  /** 1 = day, 0 = night (Open‑Meteo) */
  is_day?: number | null;
}

export interface HourlyBlock {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
}

export interface DailyBlock {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
}

export type AlertItem = {
  id: string;
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  areaDesc?: string;
};

export type WeatherData = {
  current: CurrentBlock;
  hourly: HourlyBlock;
  daily: DailyBlock;
  alerts: AlertItem[];
};
