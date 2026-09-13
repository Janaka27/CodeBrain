<?php

namespace App\Ai\Tools;

use Carbon\Carbon;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class GetCurrentDateTime implements Tool
{
    /**
     * Get the description of the tool's purpose.
     */
    public function description(): Stringable|string
    {
        return 'Get the current date, time and day of the weeks.'.
        'Use this whenever the user asks about today\'s date, time or day of the week.'.
        'Also use this tool when the user ask thing that related to calculations based on date or time';
    }

    /**
     * Execute the tool.
     */
    public function handle(Request $request): Stringable|string
    {
        $now = Carbon::now();

        $format = $request['format'] ?? 'full';

        return match ($format) {
            'date' => $now->toFormattedDateString(),
            'time' => $now->format('H:i:s'),
            default => $now->format('Y-m-d H:i:s'),
        };
    }

    /**
     * Get the tool's schema definition.
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'format' => $schema->string()
                ->required()
                ->enum(['date', 'time', 'full'])
                ->description('The format of the date and time'),
        ];
    }
}
