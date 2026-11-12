// External API Service – Weather (Open-Meteo) & Geocoding (Open-Meteo + OSM Nominatim) with Resilient Fallbacks
// Reference: CargoTrace_UAS_Final_Project_Brief_2.pdf (Slide 9 & 14)

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

// Comprehensive built-in Gazetteer of Indonesian & Global Logistics Hubs for instant (<5ms) auto-coordinates
const HUB_COORDINATE_GAZETTEER: Array<{
  keywords: string[];
  lat: number;
  lng: number;
  city: string;
  country: string;
  label: string;
}> = [
  { keywords: ['semarang', 'idsrg', 'tanjung emas'], lat: -6.9482, lng: 110.4239, city: 'Semarang', country: 'Indonesia', label: 'Tanjung Emas Port, Semarang, Indonesia' },
  { keywords: ['makassar', 'idmak', 'upang', 'soekarno-hatta port'], lat: -5.1189, lng: 119.4064, city: 'Makassar', country: 'Indonesia', label: 'Soekarno-Hatta Port, Makassar, Indonesia' },
  { keywords: ['belawan', 'medan', 'idblw', 'kualanamu', 'kno'], lat: 3.7845, lng: 98.6894, city: 'Medan', country: 'Indonesia', label: 'Port of Belawan / Medan, Indonesia' },
  { keywords: ['jakarta', 'idtpp', 'tanjung priok', 'cgk'], lat: -6.1045, lng: 106.8805, city: 'Jakarta', country: 'Indonesia', label: 'Tanjung Priok Port, Jakarta, Indonesia' },
  { keywords: ['surabaya', 'idsub', 'tanjung perak', 'juanda', 'sub'], lat: -7.2048, lng: 112.7318, city: 'Surabaya', country: 'Indonesia', label: 'Tanjung Perak Port, Surabaya, Indonesia' },
  { keywords: ['bali', 'denpasar', 'iddps', 'dps', 'benoa'], lat: -8.7482, lng: 115.2126, city: 'Denpasar', country: 'Indonesia', label: 'Benoa / Ngurah Rai Hub, Bali, Indonesia' },
  { keywords: ['balikpapan', 'idbpn', 'bpn', 'semayang'], lat: -1.2654, lng: 116.8312, city: 'Balikpapan', country: 'Indonesia', label: 'Semayang Port, Balikpapan, Indonesia' },
  { keywords: ['batam', 'idbth', 'bth', 'batu ampar'], lat: 1.1616, lng: 104.0047, city: 'Batam', country: 'Indonesia', label: 'Batu Ampar Port, Batam, Indonesia' },
  { keywords: ['bandung', 'idbdg', 'bdo', 'gedebage'], lat: -6.9431, lng: 107.6948, city: 'Bandung', country: 'Indonesia', label: 'Gedebage Inland Dry Port, Bandung, Indonesia' },
  { keywords: ['surakarta', 'solo', 'idslo', 'soc'], lat: -7.5568, lng: 110.8216, city: 'Surakarta', country: 'Indonesia', label: 'Surakarta Logistics Hub, Indonesia' },
  { keywords: ['yogyakarta', 'jogja', 'idyia', 'yia'], lat: -7.9056, lng: 110.0556, city: 'Yogyakarta', country: 'Indonesia', label: 'Yogyakarta International Cargo Hub, Indonesia' },
  { keywords: ['palembang', 'idplm', 'plm', 'boom baru'], lat: -2.9761, lng: 104.7754, city: 'Palembang', country: 'Indonesia', label: 'Boom Baru Port, Palembang, Indonesia' },
  { keywords: ['pontianak', 'idpnk', 'pnk', 'dwikora'], lat: -0.0263, lng: 109.3425, city: 'Pontianak', country: 'Indonesia', label: 'Dwikora Port, Pontianak, Indonesia' },
  { keywords: ['banjarmasin', 'idbdj', 'bdj', 'trisakti'], lat: -3.3285, lng: 114.5578, city: 'Banjarmasin', country: 'Indonesia', label: 'Trisakti Port, Banjarmasin, Indonesia' },
  { keywords: ['lampung', 'panjang', 'idpnj'], lat: -5.4682, lng: 105.3176, city: 'Bandar Lampung', country: 'Indonesia', label: 'Panjang Port, Lampung, Indonesia' },
  { keywords: ['cikarang', 'idckg', 'bekasi'], lat: -6.2845, lng: 107.1485, city: 'Cikarang', country: 'Indonesia', label: 'Cikarang Dry Port & Freight Terminal, Indonesia' },
  { keywords: ['singapore', 'sgsin', 'sin', 'tuas', 'changi'], lat: 1.2644, lng: 103.8405, city: 'Singapore', country: 'Singapore', label: 'Port of Singapore / Changi Hub, Singapore' },
  { keywords: ['klang', 'mypkg', 'port klang', 'kuala lumpur', 'kul'], lat: 2.9998, lng: 101.3924, city: 'Port Klang', country: 'Malaysia', label: 'Port Klang Maritime Hub, Malaysia' },
  { keywords: ['bangkok', 'thbkk', 'laem chabang', 'thlch'], lat: 13.0819, lng: 100.8835, city: 'Bangkok', country: 'Thailand', label: 'Laem Chabang / Bangkok Port, Thailand' },
  { keywords: ['ho chi minh', 'saigon', 'vnsgn', 'cat lai'], lat: 10.7626, lng: 106.7824, city: 'Ho Chi Minh City', country: 'Vietnam', label: 'Cat Lai Port, Ho Chi Minh City, Vietnam' },
  { keywords: ['manila', 'phmnl', 'mnl'], lat: 14.5995, lng: 120.9642, city: 'Manila', country: 'Philippines', label: 'Port of Manila, Philippines' },
  { keywords: ['hong kong', 'hkhkg', 'hkg'], lat: 22.3393, lng: 114.1294, city: 'Hong Kong', country: 'China', label: 'Kwai Tsing Container Terminals, Hong Kong' },
  { keywords: ['shanghai', 'cnsha', 'pvg'], lat: 30.6264, lng: 122.0645, city: 'Shanghai', country: 'China', label: 'Yangshan Deep-Water Port, Shanghai, China' },
  { keywords: ['tokyo', 'jptyo', 'yokohama', 'nrt', 'hnd'], lat: 35.6197, lng: 139.7798, city: 'Tokyo', country: 'Japan', label: 'Port of Tokyo, Japan' },
  { keywords: ['busan', 'krpus', 'pus'], lat: 35.1028, lng: 129.0403, city: 'Busan', country: 'South Korea', label: 'Port of Busan, South Korea' },
  { keywords: ['sydney', 'ausyd', 'syd', 'botany'], lat: -33.9461, lng: 151.1772, city: 'Sydney', country: 'Australia', label: 'Sydney Kingsford Smith / Port Botany, Australia' },
  { keywords: ['dubai', 'aejea', 'jebel ali', 'dxb'], lat: 25.0112, lng: 55.0612, city: 'Dubai', country: 'UAE', label: 'Jebel Ali Port & Dubai Cargo Village, UAE' },
  { keywords: ['rotterdam', 'nlrtm', 'maasvlakte'], lat: 51.949, lng: 4.145, city: 'Rotterdam', country: 'Netherlands', label: 'Port of Rotterdam (Maasvlakte II), Netherlands' },
  { keywords: ['amsterdam', 'ams', 'schiphol', 'nlamq'], lat: 52.3105, lng: 4.7683, city: 'Amsterdam', country: 'Netherlands', label: 'Amsterdam Airport Schiphol (AMS), Netherlands' },
  { keywords: ['eindhoven', 'nlein', 'ein'], lat: 51.4514, lng: 5.3767, city: 'Eindhoven', country: 'Netherlands', label: 'Eindhoven European Distribution Hub, Netherlands' },
  { keywords: ['hamburg', 'deham', 'ham'], lat: 53.5396, lng: 9.9844, city: 'Hamburg', country: 'Germany', label: 'Port of Hamburg, Germany' },
  { keywords: ['frankfurt', 'defra', 'fra'], lat: 50.0379, lng: 8.5622, city: 'Frankfurt', country: 'Germany', label: 'Frankfurt CargoCity Airport (FRA), Germany' },
  { keywords: ['antwerp', 'beanr', 'bruges'], lat: 51.2632, lng: 4.3679, city: 'Antwerp', country: 'Belgium', label: 'Port of Antwerp-Bruges, Belgium' },
  { keywords: ['london', 'gbfxt', 'felixstowe', 'lhr'], lat: 51.9542, lng: 1.3114, city: 'Felixstowe', country: 'United Kingdom', label: 'Port of Felixstowe / London Gateway, UK' },
  { keywords: ['paris', 'frcdg', 'cdg', 'le havre'], lat: 49.0097, lng: 2.5479, city: 'Paris', country: 'France', label: 'Paris Charles de Gaulle Cargo Hub, France' },
  { keywords: ['los angeles', 'uslax', 'lax', 'long beach'], lat: 33.7405, lng: -118.2719, city: 'Los Angeles', country: 'United States', label: 'Port of Los Angeles / Long Beach, USA' },
  { keywords: ['new york', 'usnyc', 'jfk', 'newark'], lat: 40.684, lng: -74.1545, city: 'New York', country: 'United States', label: 'Port Newark-Elizabeth Marine Terminal, USA' },
];

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
   * Auto-fills WGS84 Latitude, Longitude, City, and Country for any city, port, airport, or UN/LOCODE.
   * Uses 3 tiers:
   * 1. Instant verified Logistics Hub Gazetteer (<1ms)
   * 2. Open-Meteo Geocoding API (CORS-friendly, fast global lookup)
   * 3. OpenStreetMap Nominatim API
   */
  static async geocodePlaceName(query: string): Promise<{
    found: boolean;
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    display_name: string;
    source: string;
  }> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        found: false,
        latitude: -6.1045,
        longitude: 106.8805,
        city: 'Jakarta',
        country: 'Indonesia',
        display_name: 'Defaulted to Jakarta (IDTPP) — enter a city or hub name to geocode.',
        source: 'Default Hub',
      };
    }

    const lower = trimmed.toLowerCase();

    // Tier 1: Verified Global Logistics Hub Gazetteer
    for (const hub of HUB_COORDINATE_GAZETTEER) {
      if (hub.keywords.some((kw) => lower.includes(kw))) {
        return {
          found: true,
          latitude: hub.lat,
          longitude: hub.lng,
          city: hub.city,
          country: hub.country,
          display_name: hub.label,
          source: 'Verified Logistics Gazetteer',
        };
      }
    }

    // Tier 2: Open-Meteo Global Geocoding API (Fast & CORS-enabled)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        trimmed
      )}&count=1&language=en&format=json`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.results) && data.results.length > 0) {
          const hit = data.results[0];
          return {
            found: true,
            latitude: Number(Number(hit.latitude).toFixed(4)),
            longitude: Number(Number(hit.longitude).toFixed(4)),
            city: hit.name || trimmed,
            country: hit.country || 'Indonesia',
            display_name: `${hit.name}${hit.admin1 ? `, ${hit.admin1}` : ''}, ${hit.country || ''}`,
            source: 'Open-Meteo Geocoding API',
          };
        }
      }
    } catch {
      // Proceed to Tier 3
    }

    // Tier 3: OpenStreetMap Nominatim API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
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

      if (res.ok) {
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
      }
    } catch {
      // Fallback below
    }

    return {
      found: false,
      latitude: -6.1045,
      longitude: 106.8805,
      display_name: `Coordinates auto-set to default corridor (-6.1045, 106.8805) for "${trimmed}".`,
      source: 'Fallback Coordinates',
    };
  }
}
