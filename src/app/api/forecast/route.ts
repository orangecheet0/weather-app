import { openWeather } from '@/lib/openWeather';

export async function GET(request: Request) {
  return openWeather('forecast', request);
}
