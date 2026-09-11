<?php

namespace App\Http\Controllers;

use App\Ai\Agents\ChatAgent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Ai\Exceptions\RateLimitedException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    public function __invoke(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string'],
            'conversation_id' => ['nullable', 'string'],
        ]);

        $participant = (object) ['id' => $request->user()?->id ?? 1];

        $agent = new ChatAgent;

        if (! empty($validated['conversation_id'])) {
            $agent->continue($validated['conversation_id'], as: $participant);
        } else {
            $agent->forUser($participant);
        }

        try {
            $streamable = $agent->stream($validated['prompt']);
        } catch (RateLimitedException $e) {
            return response()->stream(function () {
                echo 'data: '.json_encode(['type' => 'text_delta', 'delta' => '⚠️ **Rate Limit Exceeded**: The AI provider (Gemini) rate limit has been reached. Please try again in a few moments.'])."\n\n";
                echo "data: [DONE]\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }, 200, ['Content-Type' => 'text/event-stream']);
        } catch (\Throwable $e) {
            return response()->stream(function () use ($e) {
                echo 'data: '.json_encode(['type' => 'text_delta', 'delta' => '⚠️ **Error**: '.$e->getMessage()])."\n\n";
                echo "data: [DONE]\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }, 200, ['Content-Type' => 'text/event-stream']);
        }

        return response()->stream(function () use ($streamable, $validated) {
            try {
                if (! empty($validated['conversation_id'])) {
                    echo 'data: '.json_encode(['type' => 'conversation', 'id' => $validated['conversation_id']])."\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }

                foreach ($streamable as $event) {
                    echo 'data: '.($event)."\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }

                if ($streamable->conversationId) {
                    echo 'data: '.json_encode(['type' => 'conversation', 'id' => $streamable->conversationId])."\n\n";
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            } catch (RateLimitedException $e) {
                echo 'data: '.json_encode(['type' => 'text_delta', 'delta' => '⚠️ **Rate Limit Exceeded**: The AI provider (Gemini) rate limit has been reached. Please try again in a few moments.'])."\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            } catch (\Throwable $e) {
                echo 'data: '.json_encode(['type' => 'text_delta', 'delta' => '⚠️ **Error**: '.$e->getMessage()])."\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }

            echo "data: [DONE]\n\n";
            if (ob_get_level() > 0) {
                ob_flush();
            }
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function loadChat(Request $request)
    {
        $validated = $request->validate([
            'conversation_id' => ['nullable', 'string'],
        ]);

        if (! empty($validated['conversation_id'])) {
            $messages = DB::table('agent_conversation_messages')
                ->where('conversation_id', $validated['conversation_id'])
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(fn ($msg) => [
                    'id' => $msg->id,
                    'role' => $msg->role,
                    'content' => $msg->content,
                ])
                ->all();

            return response()->json([
                'conversation_id' => $validated['conversation_id'],
                'messages' => $messages,
            ]);
        }

        $conversations = DB::table('agent_conversations')
            // ->where('participant_id', 3)
            ->latest('updated_at')
            ->get()
            ->map(
                fn ($conversation) => [
                    'id' => $conversation->id,
                    'title' => Str::limit($conversation->title ?? 'New Conversation', 34),
                ]
            )->all();

        return response()->json($conversations);
    }
}
