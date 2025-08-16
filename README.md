# AlWeather

AlWeather is a responsive weather dashboard built with Next.js and TypeScript. It retrieves data from the OpenWeather APIs and presents current conditions, forecasts, and alerts with a polished UI.

## Features
- Search for any city worldwide or use your browser's location.
- View current weather, hourly forecasts, and a 7‑day outlook.
- See severe weather alerts when issued for your area.
- Toggle between Fahrenheit and Celsius units.
- Animated and accessible interface styled with Tailwind CSS.

## Tech Stack
- [Next.js](https://nextjs.org/) + React
- TypeScript
- Tailwind CSS
- Framer Motion and Lucide icons
- OpenWeather APIs for weather and geocoding data

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- An OpenWeather API key

### Environment variables
1. Sign up for a free account at [OpenWeather](https://openweathermap.org/) and generate an API key from the **API keys** section of your dashboard.
2. Copy the example environment file and provide your key:
   ```bash
   cp .env.example .env
   # open .env in an editor and set
   OPENWEATHER_API_KEY=<your_openweather_api_key>
   ```

### Install dependencies and run
```bash
npm install
npm run dev
```
The app will be available at [http://localhost:3000](http://localhost:3000).

## Running tests
```bash
npm test
```

## Deployment

Some hosting providers do not yet support loading a `next.config.ts` file. If your deployment platform requires a JavaScript configuration, use the provided `next.config.mjs` which exports the same settings as the TypeScript file.
