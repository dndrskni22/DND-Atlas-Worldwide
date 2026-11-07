// External API Service – Weather (Open-Meteo) & Geocoding (OSM Nominatim) with Resilient Fallbacks
// Reference: CargoTrace_UAS_Final_Project_Brief_2.pdf (Slide 9)

import { Location, WeatherSnapshot } from '../types/cargotrace';

const WMO_WEATHER_LABELS: Record<number, string> = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Coastal Fog',
  48: 'Depositing Rime Fog',
  51: 'Light Drizzle',
  53: 'Moderate Drizzle',
  61: 'Slight Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  80: 'Rain Showers',
  95: 'Thunderstorm Squall',
};

// Deterministic realistic fallback cache per location code in case external network is unreachable
const FALLBACK_WEATHER_BY_CODE: Record<
  string,
  { temp: number; wind: number; cond: string; hum: number; vis: number }
> = {
  IDTPP: { temp: 31.2, wind: 18.4, cond: 'Partly Cloudy · Warm Humid', hum: 76, vis: 9.5 },
  IDSUB: { temp: 32.0, wind: 16.0, cond: 'Mainly Clear', hum: 72, vis: 10.0 },
  SGSIN: { temp: 29.8, wind: 21.5, cond: 'Scattered Maritime Showers', hum: 82, vis: 8.2 },
  MYPKG: { temp: 30.4, wind: 14.2, cond: 'Partly Cloudy', hum: 79, vis: 9.0 },
  NLRTM: { temp: 9.4, wind: 28.6, cond: 'North Sea Gusts & Overcast', hum: 86, vis: 6.4 },
  DEHAM: { temp: 7.8, wind: 24.0, cond: 'Light Drizzle & Cool', hum: 88, vis: 5.8 },
  CGK: { temp: 30.8, wind: 15.0, cond: 'Mainly Clear · Good Runway Vis', hum: 74, vis: 10.0 },
  SIN: { temp: 29.5, wind: 19.2, cond: 'Partly Cloudy', hum: 80, vis: 9.8 },
  AMS: { temp: 8.6, wind: 26.4, cond: 'Coastal Fog & Crosswind', hum: 91, vis: 4.2 },
  SYD: { temp: 22.4, wind: 22.0, cond: 'Clear Sky', hum: 64, vis: 10.0 },
  IDCKG: { temp: 31.5, wind: 12.0, cond: 'Partly Cloudy', hum: 73, vis: 9.5 },
  IDBDG: { temp: 25.2, wind: 11.4, cond: 'Mild Highland Breeze', hum: 78, vis: 9.2 },
  IDSLO: { temp: 30.1, wind: 13.5, cond: 'Mainly Clear', hum: 71, vis: 10.0 },
  NLEIN: { temp: 9.1, wind: 19.8, cond: 'Overcast', hum: 84, vis: 7.5 },
};

export class ExternalApiService {
  /**
   * Fetches contextual weather for a Location via Open-Meteo API.
   * Respects timeout (3000ms) and returns documented fallback if unavailable.
   * NOTE (Slide 9): Weather is strictly contextual operational metadata and is
   * NEVER presented as AI prediction or proof of delay.
   */
  static async fetchLocationWeather(location: Location): Promise<WeatherSnapshot> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const current = data?.current;
      if (!current || typeof current.temperature_2m !== 'number') {
        throw new Error('Empty Open-Meteo payload');
      }

      const code = Number(current.weather_code ?? 1);
      return {
        location_code: location.code,
        location_name: `${location.name} (${location.city})`,
        temperature_c: Number(current.temperature_c ?? current.temperature_2m.toFixed(1)),
        wind_speed_kmh: Number((current.wind_speed_10m ?? 14).toFixed(1)),
        condition_label: WMO_WEATHER_LABELS[code] || 'Variable Maritime Conditions',
        humidity_pct: Math.round(current.relative_humidity_2m ?? 75),
        visibility_km: code >= 45 && code <= 48 ? 4.2 : 9.8,
        fetched_at: new Date().toISOString(),
        source: 'Open-Meteo Live API',
      };
    } catch {
      clearTimeout(timeoutId);
      const fb = FALLBACK_WEATHER_BY_CODE[location.code] || {
        temp: 26.5,
        wind: 16.0,
        cond: 'Partly Cloudy',
        hum: 75,
        vis: 9.0,
      };
      return {
        location_code: location.code,
        location_name: `${location.name} (${location.city})`,
        temperature_c: fb.temp,
        wind_speed_kmh: fb.wind,
        condition_label: fb.cond,
        humidity_pct: fb.hum,
        visibility_km: fb.vis,
        fetched_at: new Date().toISOString(),
        source: 'Cached Fallback (Service Offline)',
      };
    }
  }

  /**
   * Geocodes a city/port/airport query using OpenStreetMap Nominatim.
   * Falls back cleanly so Admin can always enter manual coordinates if offline.
   */
  static async geocodePlaceName(query: string): Promise<{
    found: boolean;
    latitude: number;
    longitude: number;
    display_name: string;
    source: string;
  }> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        found: false,
        latitude: 0,
        longitude: 0,
        display_name: 'Empty query',
        source: 'Validation',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        trimmed
      )}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        return {
          found: true,
          latitude: Number(parseFloat(results[0].lat).toFixed(4)),
          longitude: Number(parseFloat(results[0].lon).toFixed(4)),
          display_name: results[0].display_name,
          source: 'OpenStreetMap Nominatim API',
        };
      }
      throw new Error('No results');
    } catch {
      clearTimeout(timeoutId);
      // Built-in dictionary of common logistics ports/airports for offline reliability
      const lower = trimmed.toLowerCase();
      const presets: Record<string, { lat: number; lng: number; label: string }> = {
        semarang: { lat: -6.9482, lng: 110.4239, label: 'Tanjung Emas Port, Semarang, Indonesia' },
        belawan: { lat: 3.7845, lng: 98.6894, label: 'Port of Belawan, Medan, Indonesia' },
        makassar: { lat: -5.1189, lng: 119.4064, label: 'Soekarno-Hatta Port, Makassar, Indonesia' },
        antwerp: { lat: 51.2632, lng: 4.3679, label: 'Port of Antwerp-Bruges, Belgium' },
        frankfurt: { lat: 50.0379, lng: 8.5622, label: 'Frankfurt CargoCity Airport (FRA), Germany' },
        tokyo: { lat: 35.6197, lng: 139.7798, label: 'Port of Tokyo, Japan' },
      };
      for (const [key, val] of Object.entries(presets)) {
        if (lower.includes(key)) {
          return {
            found: true,
            latitude: val.lat,
            longitude: val.lng,
            display_name: val.label,
            source: 'Cached Gazetteer Fallback',
          };
        }
      }
      return {
        found: false,
        latitude: -6.1045,
        longitude: 106.8805,
        display_name: 'Geocoding service unreachable — please refine coordinates manually.',
        source: 'Manual Coordinate Fallback',
      };
    }
  }
}
