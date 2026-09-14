<?php

use App\Ai\Agents\ChatAgent;
use App\Ai\Agents\ReviewAgent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

test('review agent is called when mode is failover', function () {
    ReviewAgent::fake(['Code audit analysis complete!']);

    $response = $this->postJson('/chat', [
        'prompt' => 'Check failover risks for this function',
        'mode' => 'failover',
    ]);

    $response->assertOk();
    ReviewAgent::assertPrompted('Check failover risks for this function');
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

test('clear chat endpoint deletes conversation, messages, and local attachment files', function () {
    Storage::fake('local');
    Storage::disk('local')->put('chats-attachment/to_delete.png', 'image data');

    DB::table('agent_conversations')->insert([
        'id' => 'conv-123',
        'title' => 'Test Conversation',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    DB::table('agent_conversation_messages')->insert([
        'id' => 'msg-123',
        'conversation_id' => 'conv-123',
        'agent' => 'chat',
        'role' => 'user',
        'content' => 'Hello',
        'attachments' => json_encode([
            [
                'type' => 'stored-image',
                'name' => 'to_delete.png',
                'path' => 'chats-attachment/to_delete.png',
                'disk' => 'local',
            ],
        ]),
        'tool_calls' => '[]',
        'tool_results' => '[]',
        'usage' => '[]',
        'meta' => '[]',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $response = $this->postJson('/clear-chat', [
        'conversation_id' => 'conv-123',
    ]);

    $response->assertOk()
        ->assertJson(['message' => 'Chat cleared successfully']);

    $this->assertDatabaseMissing('agent_conversations', ['id' => 'conv-123']);
    $this->assertDatabaseMissing('agent_conversation_messages', ['conversation_id' => 'conv-123']);
    Storage::disk('local')->assertMissing('chats-attachment/to_delete.png');
});

test('chat endpoint accepts single file attachment', function () {
    ChatAgent::fake(['Analyzed attachment successfully']);

    $file = UploadedFile::fake()->create('code.txt', 10, 'text/plain');

    $response = $this->postJson('/chat', [
        'prompt' => 'Review this file',
        'attachment' => $file,
    ]);

    $response->assertOk();
    ChatAgent::assertPrompted('Review this file');
});

test('attachment preview file can be retrieved via route', function () {
    Storage::fake('local');
    Storage::disk('local')->put('chats-attachment/sample.png', 'fake image content');

    $response = $this->get('/chats-attachment/sample.png');

    $response->assertOk();
});
