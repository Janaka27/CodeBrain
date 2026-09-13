<?php

use App\Ai\Tools\GetCurrentWeather;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Tools\Request;

test('get current weather tool fetches weather data for a city', function () {
    Http::fake([
        'https://geocoding-api.open-meteo.com/v1/search*' => Http::response([
            'results' => [
                [
                    'name' => 'Colombo',
                    'latitude' => 6.9271,
                    'longitude' => 79.8612,
                    'country' => 'Sri Lanka',
                ],
            ],
        ], 200),
        'https://api.open-meteo.com/v1/forecast*' => Http::response([
            'current' => [
                'temperature_2m' => 30.5,
                'relative_humidity_2m' => 70,
                'wind_speed_10m' => 12.3,
            ],
            'current_units' => [
                'temperature_2m' => '°C',
                'relative_humidity_2m' => '%',
                'wind_speed_10m' => 'km/h',
            ],
        ], 200),
    ]);

    $tool = new GetCurrentWeather;
    $result = $tool->handle(new Request(['city' => 'Colombo']));

    expect($result)->toContain('Colombo, Sri Lanka')
        ->toContain('30.5°C')
        ->toContain('70%')
        ->toContain('12.3 km/h');
});

test('get current weather tool returns error message when city is not found', function () {
    Http::fake([
        'https://geocoding-api.open-meteo.com/v1/search*' => Http::response([
            'results' => [],
        ], 200),
    ]);

    $tool = new GetCurrentWeather;
    $result = $tool->handle(new Request(['city' => 'UnknownCityXYZ']));

    expect($result)->toContain("Could not find location coordinates for city 'UnknownCityXYZ'.");
});

test('get current weather tool schema defines city parameter', function () {
    $tool = new GetCurrentWeather;
    $schema = $tool->schema(new JsonSchemaTypeFactory);

    expect($schema)->toHaveKey('city');
    expect($schema['city']->toArray())->toMatchArray([
        'type' => 'string',
        'description' => 'The city name to get the weather for (e.g. London, Colombo, Tokyo)',
    ]);
});
