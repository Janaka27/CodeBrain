<?php

use App\Ai\Agents\ChatAgent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\Exceptions\RateLimitedException;

uses(RefreshDatabase::class);

test('chat endpoint validates required prompt', function () {
    $response = $this->postJson('/chat', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['prompt']);
});

test('chat agent can be faked and streams response', function () {
    ChatAgent::fake(['Hello, I am CodeBrain!']);

    $response = $this->postJson('/chat', [
        'prompt' => 'Hello',
    ]);

    $response->assertOk();
    ChatAgent::assertPrompted('Hello');
});

test('chat endpoint continues conversation when conversation_id is provided', function () {
    ChatAgent::fake(['First response', 'Second response']);

    $response1 = $this->postJson('/chat', [
        'prompt' => 'My name is Bob',
    ]);

    $response1->assertOk();
    $content = $response1->streamedContent();

    // Extract conversation ID from SSE events
    preg_match('/"type":"conversation","id":"([^"]+)"/', $content, $matches);
    $conversationId = $matches[1] ?? null;

    expect($conversationId)->not()->toBeNull();

    $response2 = $this->postJson('/chat', [
        'prompt' => 'What is my name?',
        'conversation_id' => $conversationId,
    ]);

    $response2->assertOk();
    ChatAgent::assertPrompted('What is my name?');
});

test('load chat endpoint returns conversation list', function () {
    $response = $this->getJson('/load-chat');

    $response->assertOk()
        ->assertJson([]);
});

test('chat endpoint handles RateLimitedException gracefully', function () {
    ChatAgent::fake(function () {
        throw RateLimitedException::forProvider('gemini');
    });

    $response = $this->postJson('/chat', [
        'prompt' => 'Trigger rate limit',
    ]);

    $response->assertOk();
    $content = $response->streamedContent();

    expect($content)->toContain('Rate Limit Exceeded');
});
