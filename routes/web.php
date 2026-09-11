<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'chat')->name('chat');
Route::post('/chat', ChatController::class)->name('chat.send');

Route::match(['get', 'post'], '/load-chat', [ChatController::class, 'loadChat'])->name('chat.load');
