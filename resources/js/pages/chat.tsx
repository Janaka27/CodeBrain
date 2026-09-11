import { Head } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import { Plus, SendHorizontal, Loader2, Bot, User, MessageSquare, MoreVertical, Trash2, ShieldAlert, Zap, Lock, AlertTriangle } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const rawLang = (lang || '').trim().split(/\s+/)[0];
    const validLang = rawLang && hljs.getLanguage(rawLang) ? rawLang : '';
    const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;

    const displayLang = validLang ? validLang.toLowerCase() : (rawLang || 'code');

    return `
<div class="code-block-wrapper my-6 rounded-xl border border-zinc-800 bg-[#0d0d12] overflow-hidden shadow-lg">
    <div class="flex items-center justify-between px-6 py-3 bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 select-none">
        <span class="text-xs font-semibold text-purple-400 uppercase tracking-wider">${displayLang}</span>
        <button type="button" class="copy-code-btn flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition cursor-pointer px-2.5 py-1 rounded-md hover:bg-zinc-800/80 active:scale-95">
            <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span class="btn-text">Copy</span>
        </button>
    </div>
    <pre class="overflow-x-auto m-0 bg-transparent text-zinc-100 font-mono text-[13px] leading-relaxed"><code class="hljs ${validLang}">${highlighted}</code></pre>
</div>
`;
};

marked.use({ renderer });

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ConversationItem {
    id: string;
    title: string;
}

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [activeMode, setActiveMode] = useState<'chat' | 'failover'>('chat');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        console.log('[CodeBrain] 🔄 Active conversation_id state:', conversationId);
    }, [conversationId]);

    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchConversations = async () => {
        try {
            const response = await fetch('/load-chat');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    setConversations(data);
                    console.log('Conversations:', data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const selectConversation = async (id: string) => {
        if (id === conversationId && messages.length > 0) return;
        setConversationId(id);
        setIsLoading(true);
        const selectedConv = conversations.find((c) => c.id === id);
        if (selectedConv && isFailoverConv(selectedConv.title)) {
            setActiveMode('failover');
        } else {
            setActiveMode('chat');
        }
        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const response = await fetch(`/load-chat?conversation_id=${id}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
            });
            if (response.ok) {
                const data = await response.json();
                if (data.messages && Array.isArray(data.messages)) {
                    setMessages(data.messages);
                }
            }
        } catch (error) {
            console.error('Failed to load conversation messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const suggestions = [
        'Explain About Laravel AI SDK',
        'What is Laravel 13?',
        'Tell me about AI',
        'What is PHP',
    ];

    const failoverSuggestions = [
        'Check database connection pool under load',
        'Audit API rate-limiting & timeout strategy',
        'Scan for memory leaks & unhandled promises',
        'Analyze SQL query performance & locking',
    ];

    const sendPrompt = async (promptText?: string) => {
        const textToSend = (promptText || inputMessage).trim();
        if (!textToSend || isLoading) return;

        console.log('[CodeBrain] 📤 Sending prompt to /chat with conversation_id:', conversationId);

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
        };

        const aiMessageId = (Date.now() + 1).toString();

        setMessages((prev) => [
            ...prev,
            userMsg,
            {
                id: aiMessageId,
                role: 'assistant',
                content: '',
            },
        ]);

        setInputMessage('');
        setIsLoading(true);

        try {
            const csrfToken =
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    prompt: textToSend,
                    conversation_id: conversationId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch response');
            }

            if (!response.body) {
                throw new Error('Streaming is not supported');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let fullResponse = '';
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;

                    const dataStr = trimmed.replace(/^data:\s*/, '');
                    if (dataStr === '[DONE]') continue;

                    try {
                        const data = JSON.parse(dataStr);

                        if (data.type === 'conversation' && data.id) {
                            console.log('[CodeBrain] 📥 Received conversation_id from server stream:', data.id);
                            setConversationId(data.id);
                        }

                        const isTextDelta =
                            data.type === 'text_delta' ||
                            data.type === 'text-delta' ||
                            (data.delta && typeof data.delta === 'string');

                        if (isTextDelta && data.delta) {
                            fullResponse += data.delta;
                            setMessages((prev) =>
                                prev.map((message) =>
                                    message.id === aiMessageId
                                        ? { ...message, content: fullResponse }
                                        : message
                                )
                            );
                        }
                    } catch {
                        // Ignore metadata events or partial json lines
                    }
                }
            }

            if (buffer.trim().startsWith('data:')) {
                const dataStr = buffer.trim().replace(/^data:\s*/, '');
                if (dataStr !== '[DONE]') {
                    try {
                        const data = JSON.parse(dataStr);

                        if (data.type === 'conversation' && data.id) {
                            console.log('[CodeBrain] 📥 Received conversation_id from server stream (buffer):', data.id);
                            setConversationId(data.id);
                        }

                        const isTextDelta =
                            data.type === 'text_delta' ||
                            data.type === 'text-delta' ||
                            (data.delta && typeof data.delta === 'string');

                        if (isTextDelta && data.delta) {
                            fullResponse += data.delta;
                            setMessages((prev) =>
                                prev.map((message) =>
                                    message.id === aiMessageId
                                        ? { ...message, content: fullResponse }
                                        : message
                                )
                            );
                        }
                    } catch {
                        // Ignore
                    }
                }
            }
        } catch (error) {
            console.error('Error executing prompt:', error);

            setMessages((prev) =>
                prev.map((message) =>
                    message.id === aiMessageId
                        ? { ...message, content: 'An error occurred while connecting to the AI agent.' }
                        : message
                )
            );
        } finally {
            setIsLoading(false);
            fetchConversations();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    };

    const clearChat = () => {
        console.log('[CodeBrain] 🧹 Reset chat and conversation_id to null');
        setActiveMode('chat');
        setMessages([]);
        setConversationId(null);
    };

    const startFailoverMode = () => {
        console.log('[CodeBrain] 🛡️ Switched to Code Failover Analysis Mode');
        setActiveMode('failover');
        setMessages([]);
        setConversationId(null);
    };

    const handleCopyClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const copyBtn = target.closest('.copy-code-btn') as HTMLButtonElement | null;
        if (copyBtn) {
            const wrapper = copyBtn.closest('.code-block-wrapper');
            const codeElement = wrapper?.querySelector('code');
            if (codeElement) {
                const textToCopy = codeElement.innerText;
                navigator.clipboard
                    .writeText(textToCopy)
                    .then(() => {
                        const btnText = copyBtn.querySelector('.btn-text');
                        if (btnText) {
                            const original = btnText.textContent;
                            btnText.textContent = 'Copied!';
                            copyBtn.classList.add('text-emerald-400');
                            setTimeout(() => {
                                btnText.textContent = original;
                                copyBtn.classList.remove('text-emerald-400');
                            }, 2000);
                        }
                    })
                    .catch((err) => {
                        console.error('Failed to copy code: ', err);
                    });
            }
        }
    };

    const renderMarkdown = (content: string) => {
        const rawHtml = marked.parse(content, { async: false }) as string;
        const cleanHtml = DOMPurify.sanitize(rawHtml);
        return { __html: cleanHtml };
    };

    const isFailoverConv = (title?: string) => {
        if (!title) return false;
        return title.toLowerCase().includes('failover');
    };

    const failoverConversations = conversations.filter((c) => isFailoverConv(c.title));
    const standardConversations = conversations.filter((c) => !isFailoverConv(c.title));

    return (
        <>
            <Head title="CodeBrain - AI Code Reviewer" />
            <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans antialiased">
                {/* Left Sidebar */}
                <aside className="w-64 flex-shrink-0 border-r border-zinc-800/80 bg-[#121217] flex flex-col justify-between p-4 z-20">
                    <div className="space-y-6">
                        {/* Header Branding */}
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-base shadow-md shadow-purple-600/30">
                                CB
                            </div>
                            <div>
                                <h1 className="font-semibold text-white text-base leading-tight">CodeBrain</h1>
                                <p className="text-xs text-zinc-400">Powered by Gemini</p>
                            </div>
                        </div>

                        {/* New Conversation Button */}
                        <div className="space-y-2">
                            <button
                                onClick={clearChat}
                                className="flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800/80 hover:border-zinc-700 cursor-pointer"
                            >
                                <Plus className="h-4 w-4 text-zinc-400" />
                                <span>New Conversation</span>
                            </button>

                            {/* Check Code Failover Button */}
                            <button
                                onClick={startFailoverMode}
                                className={`flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition cursor-pointer ${
                                    activeMode === 'failover'
                                        ? 'border-purple-600 bg-purple-600/30 text-purple-200 shadow-md shadow-purple-900/30 font-semibold'
                                        : 'border-purple-950/60 bg-purple-950/20 text-purple-300 hover:bg-purple-900/40 hover:border-purple-800/80'
                                }`}
                            >
                                <ShieldAlert className="h-4 w-4 text-purple-400" />
                                <span>Check code failover</span>
                            </button>
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1 no-scrollbar min-h-0">
                        {/* Failover Audits Section */}
                        {failoverConversations.length > 0 && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 px-2 mb-2">
                                    <ShieldAlert className="h-3 w-3 text-purple-400" />
                                    <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                                        Failover Audits
                                    </p>
                                </div>
                                {failoverConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className={`relative group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition text-left cursor-pointer border ${
                                            conversationId === conv.id
                                                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-md shadow-purple-900/20 font-semibold'
                                                : 'bg-purple-950/20 text-purple-300 border-purple-900/40 hover:bg-purple-900/40 hover:text-white'
                                        }`}
                                        onClick={() => selectConversation(conv.id)}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                                            <span className="truncate flex-1">{conv.title || 'Failover Check'}</span>
                                            <span className="text-[9px] font-semibold bg-purple-900/80 text-purple-300 px-1.5 py-0.5 rounded-md border border-purple-700/50 uppercase tracking-wide flex-shrink-0">
                                                Failover
                                            </span>
                                        </div>

                                        {/* 3-Dot Options Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                                            }}
                                            className={`p-1 text-purple-300 hover:text-white rounded-md hover:bg-purple-800/60 transition cursor-pointer flex-shrink-0 ml-1 ${
                                                activeMenuId === conv.id ? 'opacity-100 bg-purple-800/60' : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                        >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Delete Dropdown Menu UI */}
                                        {activeMenuId === conv.id && (
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="absolute right-2 top-9 z-30 w-44 rounded-xl border border-zinc-800 bg-[#181820] p-1.5 shadow-xl shadow-black/50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        console.log('Delete conversation requested:', conv.id);
                                                        setActiveMenuId(null);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Delete Conversation</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Recent Chats Section */}
                        <div className="space-y-1">
                            <p className="px-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                                Recent Chats
                            </p>
                            {standardConversations.length === 0 && failoverConversations.length === 0 ? (
                                <p className="px-2 text-xs text-zinc-600">No conversations yet</p>
                            ) : standardConversations.length === 0 ? (
                                <p className="px-2 text-xs text-zinc-600">No standard chats yet</p>
                            ) : (
                                standardConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className={`relative group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition text-left cursor-pointer ${
                                            conversationId === conv.id
                                                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 font-semibold'
                                                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
                                        }`}
                                        onClick={() => selectConversation(conv.id)}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                                            <span className="truncate">{conv.title || 'New Conversation'}</span>
                                        </div>

                                        {/* 3-Dot Options Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                                            }}
                                            className={`p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-700/60 transition cursor-pointer flex-shrink-0 ${
                                                activeMenuId === conv.id ? 'opacity-100 bg-zinc-700/60' : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                        >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Delete Dropdown Menu UI */}
                                        {activeMenuId === conv.id && (
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="absolute right-2 top-9 z-30 w-44 rounded-xl border border-zinc-800 bg-[#181820] p-1.5 shadow-xl shadow-black/50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        console.log('Delete conversation requested:', conv.id);
                                                        setActiveMenuId(null);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Delete Conversation</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3.5 py-2 text-xs text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            <span className="font-medium">Gemini 3.6 Flash</span>
                        </div>
                        <p className="px-1 text-[11px] text-zinc-500">Built with Laravel 13 AI SDK</p>
                    </div>


                </aside>

                {/* Main Content Area */}
                <main className="relative flex flex-1 flex-col justify-between bg-[#09090b] overflow-hidden">
                    {/* Top Header Bar */}
                    <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4 z-10 bg-[#09090b]">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                                    {activeMode === 'failover' ? (
                                        <>
                                            <ShieldAlert className="h-4 w-4 text-purple-400" />
                                            <span>Code Failover Analysis</span>
                                        </>
                                    ) : conversationId ? (
                                        'Active Conversation'
                                    ) : (
                                        'New Conversation'
                                    )}
                                </h2>
                                <p className="text-xs text-zinc-400">
                                    {activeMode === 'failover'
                                        ? 'Stress test code logic, security traps & high-traffic resilience'
                                        : conversationId
                                        ? 'Context remembered'
                                        : 'Ask me anything'}
                                </p>
                            </div>
                        </div>
                        {activeMode === 'failover' && (
                            <span className="px-3 py-1 text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/60 rounded-full uppercase tracking-wider">
                                Failover Audit Mode
                            </span>
                        )}
                        <button
                            onClick={clearChat}
                            className="text-xs font-medium text-zinc-400 transition hover:text-zinc-200 cursor-pointer"
                        >
                            Clear
                        </button>
                    </header>

                    {/* Chat Area / Empty State */}
                    {messages.length === 0 ? (
                        activeMode === 'failover' ? (
                            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center pb-32 overflow-y-auto max-w-4xl mx-auto w-full no-scrollbar">
                                {/* Centered Failover Badge Icon */}
                                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/40">
                                    <ShieldAlert className="h-8 w-8" />
                                </div>

                                {/* Main Title & Description */}
                                <h3 className="mb-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                    Code Failover &amp; Vulnerability Analysis
                                </h3>
                                <p className="mb-8 text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
                                    This feature analyzes user-provided code segments for potential failing points, security vulnerabilities, high-traffic concurrency bottlenecks, and edge-case exceptions before deployment.
                                </p>

                                {/* 4 Feature Cards Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mb-8 text-left">
                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="flex items-center gap-2.5 mb-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wider">
                                            <Lock className="h-4 w-4" />
                                            <span>Security &amp; Vulnerabilities</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Detect SQL injection risks, XSS vectors, unhandled authorization checks, and sensitive data leakage in logic streams.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="flex items-center gap-2.5 mb-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wider">
                                            <Zap className="h-4 w-4" />
                                            <span>High-Traffic Bottlenecks</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Identify N+1 database queries, unindexed table scans, memory leaks, and concurrency locks under sudden load spikes.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="flex items-center gap-2.5 mb-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wider">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>Edge-Case Exceptions</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Highlight missing null pointer checks, uncaught API exceptions, network timeout failures, and invalid type casting.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="flex items-center gap-2.5 mb-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wider">
                                            <ShieldAlert className="h-4 w-4" />
                                            <span>Resilience &amp; Fallbacks</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                            Get tailored recommendations for circuit breaker patterns, automated retry policies, and graceful fallback strategies.
                                        </p>
                                    </div>
                                </div>

                                {/* Prompt Suggestions Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                                    {failoverSuggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setInputMessage(suggestion)}
                                            className="rounded-full border border-purple-950/60 bg-purple-950/20 px-4 py-2.5 text-xs font-medium text-purple-300 transition hover:bg-purple-900/40 hover:border-purple-800/80 hover:text-white cursor-pointer"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center pb-32">
                                {/* Centered Logo Badge */}
                                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 text-white font-bold text-2xl shadow-lg shadow-purple-600/30">
                                    CB
                                </div>

                                {/* Title & Subtitle */}
                                <h3 className="mb-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                    Welcome to CodeBrain
                                </h3>
                                <p className="mb-8 text-sm sm:text-base text-zinc-400 max-w-md">
                                    AI code reviewer powered by Google Gemini &amp; Laravel 13 AI SDK
                                </p>

                                {/* Prompt Suggestions Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                                    {suggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setInputMessage(suggestion)}
                                            className="rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-300 transition hover:bg-zinc-800/80 hover:border-zinc-700 hover:text-white cursor-pointer"
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    ) : (
                        <div
                            onClick={handleCopyClick}
                            className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl w-full mx-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-36"
                        >
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white font-bold text-sm flex-shrink-0">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                    )}

                                    <div
                                        className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white rounded-br-none max-w-[85%] whitespace-pre-wrap'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none flex-1 max-w-none markdown-body'
                                            }`}
                                    >
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : msg.content.trim() === '' ? (
                                            <div className="flex items-center gap-2.5 text-zinc-400 py-0.5">
                                                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                                <span className="text-xs font-medium text-zinc-400">Thinking...</span>
                                            </div>
                                        ) : (
                                            <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                                        )}
                                    </div>

                                    {msg.role === 'user' && (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm flex-shrink-0">
                                            <User className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Bottom Chat Input Dock Wrapper (Translucent + Blur Section behind the input) */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 w-full bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent backdrop-blur-md pt-6 pb-6 px-4">
                        <div className="w-full max-w-2xl mx-auto">
                            <div className="relative flex items-center rounded-2xl border border-zinc-800 bg-[#16161e] px-4 py-3 shadow-xl focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={activeMode === 'failover' ? 'Paste code snippet or describe scenario to analyze failover risks...' : 'Message CodeBrain...'}
                                    disabled={isLoading}
                                    className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none pr-10 disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => sendPrompt()}
                                    disabled={isLoading || !inputMessage.trim()}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${inputMessage.trim()
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 hover:bg-purple-500 hover:shadow-[0_0_16px_rgba(168,85,247,0.85)] hover:ring-2 hover:ring-purple-400/60 cursor-pointer active:scale-95'
                                        : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendHorizontal className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-2.5 text-center text-[11px] text-zinc-500">
                                CodeBrain can make mistakes. Always verify important info.
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
