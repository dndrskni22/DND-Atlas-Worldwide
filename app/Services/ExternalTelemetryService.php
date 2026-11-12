<?php

namespace App\Services;

use App\Models\Location;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExternalTelemetryService
{
    /**
     * Fetch destination hub weather via Laravel HTTP Client with timeout & fallback (Brief Slide 9 & 15).
     * Contextual situational awareness only — never claimed as AI delay prediction.
     */
    public function fetchHubWeather(Location $location): array
    {
        $baseUrl = config('cargotrace.open_meteo_url', 'https://api.open-meteo.com/v1/forecast');
        $timeout = (int) config('cargotrace.http_timeout_seconds', 4);

        try {
            $response = Http::timeout($timeout)->get($baseUrl, [
                'latitude' => $location->latitude,
                'longitude' => $location->longitude,
                'current' => 'temperature_2m,wind_speed_10m,precipitation,weather_code',
            ]);

            if ($response->successful() && isset($response['current'])) {
                $curr = $response['current'];
                return [
                    'location_code' => $location->code,
                    'temperature_c' => (float) ($curr['temperature_2m'] ?? 24.0),
                    'wind_speed_kmh' => (float) ($curr['wind_speed_10m'] ?? 14.0),
                    'precipitation_mm' => (float) ($curr['precipitation'] ?? 0.0),
                    'source' => 'LIVE_API',
                    'fetched_at' => now()->toIso8601String(),
                ];
            }
        } catch (Throwable $e) {
            // Gracefully handle timeout, network failure, or empty response per Brief Slide 9
        }

        return [
            'location_code' => $location->code,
            'temperature_c' => 22.5,
            'wind_speed_kmh' => 15.0,
            'precipitation_mm' => 0.0,
            'source' => 'FALLBACK_CACHE',
            'fetched_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Geocode a city/hub name using OpenStreetMap Nominatim via Laravel HTTP Client (Brief Slide 9).
     */
    public function geocodeHub(string $query): ?array
    {
        $baseUrl = config('cargotrace.nominatim_url', 'https://nominatim.openstreetmap.org');
        $timeout = (int) config('cargotrace.http_timeout_seconds', 4);

        try {
            $response = Http::timeout($timeout)
                ->withHeaders(['User-Agent' => 'DNDAtlasWorldwide-CargoTrace/1.0'])
                ->get("{$baseUrl}/search", [
                    'format' => 'json',
                    'limit' => 1,
                    'q' => $query,
                ]);

            if ($response->successful() && !empty($response->json()[0])) {
                $item = $response->json()[0];
                return [
                    'latitude' => round((float) $item['lat'], 4),
                    'longitude' => round((float) $item['lon'], 4),
                    'display_name' => $item['display_name'] ?? $query,
                ];
            }
        } catch (Throwable $e) {
            // Graceful fallback on timeout
        }

        return null;
    }
}
