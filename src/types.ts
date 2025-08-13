export type Unit = "imperial" | "metric";

export interface Coords {
  lat: number;
  lon: number;
}

export interface CurrentBlock {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number | null;
  apparent_temperature: number | null;
  precipitation: number | null;
  wind_speed_10m: number | null;
  wind_gusts_10m: number | null;
  weather_code: number | null;
  uv_index?: number | null;
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

export type NWSFeature = {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    effective?: string;
    ends?: string;
    description?: string;
    instruction?: string;
    areaDesc?: string;
  };
};

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

export interface WeatherData {
  current: CurrentBlock;
  daily: DailyBlock;
  hourly: HourlyBlock;
  alerts: NWSFeature[];
}
