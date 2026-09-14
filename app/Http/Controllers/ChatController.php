<?php

namespace App\Http\Controllers;

use App\Ai\Agents\ChatAgent;
use App\Ai\Agents\ReviewAgent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Files\StoredAudio;
use Laravel\Ai\Files\StoredDocument;
use Laravel\Ai\Files\StoredImage;
use Laravel\Ai\Files\StoredVideo;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    public function __invoke(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'prompt' => ['required_without:attachment', 'nullable', 'string'],
            'conversation_id' => ['nullable', 'string'],
            'attachment' => ['nullable', 'file', 'max:20480', 'mimes:pdf,doc,docx,zip,jpg,jpeg,png,txt'],
            'mode' => ['nullable', 'string', 'in:chat,failover'],
        ]);

        $participant = (object) ['id' => $request->user()->id ?? 1];

        $attachments = [];

        if (! empty($validated['attachment'])) {
            $file = $validated['attachment'];
            $path = $file->store('chats-attachment', 'local');
            $mime = $file->getMimeType();

            if (str_starts_with($mime, 'image/')) {
                $attachmentObj = new StoredImage($path, 'local');
            } elseif (str_starts_with($mime, 'audio/')) {
                $attachmentObj = new StoredAudio($path, 'local');
            } elseif (str_starts_with($mime, 'video/')) {
                $attachmentObj = new StoredVideo($path, 'local');
            } else {
                $attachmentObj = new StoredDocument($path, 'local');
            }

            $attachmentObj->as($file->getClientOriginalName());
            $attachments[] = $attachmentObj;
        }

        $isFailover = ($validated['mode'] ?? '') === 'failover';

        if (! empty($validated['conversation_id'])) {
            $existingAgent = DB::table('agent_conversation_messages')
                ->where('conversation_id', $validated['conversation_id'])
                ->value('agent');

            if ($existingAgent === ReviewAgent::class || $isFailover) {
                $agent = new ReviewAgent;
            } else {
                $agent = new ChatAgent;
            }
            $agent->continue($validated['conversation_id'], as: $participant);
        } else {
            $agent = $isFailover ? new ReviewAgent : new ChatAgent;
            $agent->forUser($participant);
        }

        try {
            $streamable = $agent->stream($validated['prompt'] ?? '', $attachments);
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

    public function loadChat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'conversation_id' => ['nullable', 'string'],
        ]);

        if (! empty($validated['conversation_id'])) {
            $messages = DB::table('agent_conversation_messages')
                ->where('conversation_id', $validated['conversation_id'])
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(function ($msg) {
                    $rawAttachments = json_decode($msg->attachments ?? '[]', true);
                    $attachments = is_array($rawAttachments) ? array_map(function ($att) {
                        if (is_array($att) && ! empty($att['path'])) {
                            $cleanPath = ltrim(str_replace('chats-attachment/', '', $att['path']), '/');
                            $att['url'] = url('/chats-attachment/'.$cleanPath);
                        }

                        return $att;
                    }, $rawAttachments) : [];

                    return [
                        'id' => $msg->id,
                        'role' => $msg->role,
                        'content' => $msg->content,
                        'attachments' => $attachments,
                    ];
                })
                ->all();

            return response()->json([
                'conversation_id' => $validated['conversation_id'],
                'messages' => $messages,
            ]);
        }

        $conversations = DB::table('agent_conversations')
            ->latest('updated_at')
            ->get()
            ->map(function ($conversation) {
                $hasReviewAgent = DB::table('agent_conversation_messages')
                    ->where('conversation_id', $conversation->id)
                    ->where('agent', ReviewAgent::class)
                    ->exists();

                $title = $conversation->title ?? 'New Conversation';
                if ($hasReviewAgent && ! str_contains(strtolower($title), 'failover')) {
                    $title = '[Failover] '.$title;
                }

                return [
                    'id' => $conversation->id,
                    'title' => Str::limit($title, 34),
                ];
            })->all();

        return response()->json($conversations);
    }

    public function getAttachment(string $path): Response
    {
        $cleanPath = ltrim($path, '/');

        if (Storage::disk('local')->exists('chats-attachment/'.$cleanPath)) {
            return Storage::disk('local')->response('chats-attachment/'.$cleanPath);
        }

        if (Storage::disk('local')->exists($cleanPath)) {
            return Storage::disk('local')->response($cleanPath);
        }

        $candidates = [
            storage_path('app/'.$cleanPath),
            storage_path('app/chats-attachment/'.$cleanPath),
            storage_path('app/private/chats-attachment/'.$cleanPath),
            storage_path('app/public/chats-attachment/'.$cleanPath),
        ];

        foreach ($candidates as $filePath) {
            if (file_exists($filePath) && ! is_dir($filePath)) {
                $mime = mime_content_type($filePath) ?: 'application/octet-stream';

                return response()->file($filePath, [
                    'Content-Type' => $mime,
                ]);
            }
        }

        abort(404);
    }

    public function clearChat(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'conversation_id' => ['required', 'string'],
            ]);

            $messages = DB::table('agent_conversation_messages')
                ->where('conversation_id', $validated['conversation_id'])
                ->get();

            foreach ($messages as $message) {
                $rawAttachments = json_decode($message->attachments ?? '[]', true);
                if (is_array($rawAttachments)) {
                    foreach ($rawAttachments as $att) {
                        if (is_array($att) && ! empty($att['path'])) {
                            $path = $att['path'];
                            Storage::disk($att['disk'] ?? 'local')->delete($path);

                            $cleanPath = ltrim(str_replace('chats-attachment/', '', $path), '/');
                            $candidates = [
                                Storage::disk('local')->path('chats-attachment/'.$cleanPath),
                                Storage::disk('local')->path($path),
                                storage_path('app/'.$path),
                                storage_path('app/chats-attachment/'.$cleanPath),
                                storage_path('app/private/chats-attachment/'.$cleanPath),
                            ];

                            foreach ($candidates as $filePath) {
                                if (file_exists($filePath) && ! is_dir($filePath)) {
                                    @unlink($filePath);
                                }
                            }
                        }
                    }
                }
            }

            DB::table('agent_conversation_messages')->where('conversation_id', $validated['conversation_id'])->delete();
            DB::table('agent_conversations')->where('id', $validated['conversation_id'])->delete();

            return response()->json([
                'message' => 'Chat cleared successfully',
            ]);
        } catch (\Throwable $th) {
            return response()->json([
                'message' => 'Failed to clear chat',
            ], 500);
        }
    }
}
