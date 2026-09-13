<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'chat')->name('chat');
Route::post('/chat', ChatController::class)->name('chat.send');

Route::match(['get', 'post'], '/load-chat', [ChatController::class, 'loadChat'])->name('chat.load');

Route::post('/clear-chat', [ChatController::class, 'clearChat'])->name('chat.clear');

Route::get('/chats-attachment/{path}', [ChatController::class, 'getAttachment'])->where('path', '.*')->name('chat.attachment');
