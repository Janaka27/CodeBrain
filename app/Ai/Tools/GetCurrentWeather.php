<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class GetCurrentWeather implements Tool
{
    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Get the current weather in a specific city.';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        $city = $request['city'] ?? null;

        if (! $city) {
            return 'City parameter is required.';
        }

        $location = Http::get('https://geocoding-api.open-meteo.com/v1/search', [
            'name' => $city,
            'count' => 1,
            'language' => 'en',
            'format' => 'json',
        ])->json();

        if (empty($location['results'])) {
            return "Could not find location coordinates for city '{$city}'.";
        }

        $result = $location['results'][0];
        $latitude = $result['latitude'];
        $longitude = $result['longitude'];
        $cityName = $result['name'] ?? $city;
        $country = $result['country'] ?? '';

        $weather = Http::get('https://api.open-meteo.com/v1/forecast', [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'current' => 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
            'timezone' => 'auto',
        ])->json();

        if (empty($weather['current'])) {
            return "Failed to fetch weather data for {$cityName}.";
        }

        $current = $weather['current'];
        $units = $weather['current_units'] ?? [];

        $temp = $current['temperature_2m'] ?? 'N/A';
        $tempUnit = $units['temperature_2m'] ?? '°C';
        $humidity = $current['relative_humidity_2m'] ?? 'N/A';
        $humidityUnit = $units['relative_humidity_2m'] ?? '%';
        $windSpeed = $current['wind_speed_10m'] ?? 'N/A';
        $windUnit = $units['wind_speed_10m'] ?? 'km/h';

        $locationLabel = $country ? "{$cityName}, {$country}" : $cityName;

        return "Current weather in {$locationLabel}: Temperature: {$temp}{$tempUnit}, Relative Humidity: {$humidity}{$humidityUnit}, Wind Speed: {$windSpeed} {$windUnit}.";
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'city' => $schema->string()
                ->required()
                ->description('The city name to get the weather for (e.g. London, Colombo, Tokyo)'),
        ];
    }
}
