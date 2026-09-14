import { Head } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import {
    Plus,
    SendHorizontal,
    Loader2,
    Bot,
    User,
    MessageSquare,
    MoreVertical,
    Trash2,
    ShieldAlert,
    Zap,
    Lock,
    AlertTriangle,
    Copy,
    Check,
    RotateCcw,
    Paperclip,
    FileText,
    FileSpreadsheet,
    FileCode,
    Image as ImageIcon,
    File,
    X,
    ExternalLink,
    Eye,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import appLogo from '../../assets/logo.png';

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const rawLang = (lang || '').trim().split(/\s+/)[0];
    const validLang = rawLang && hljs.getLanguage(rawLang) ? rawLang : '';
    const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;

    const displayLang = validLang ? validLang.toLowerCase() : rawLang || 'code';

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

interface MessageAttachment {
    name: string;
    url?: string;
    type?: string;
    mime?: string;
    size?: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    attachments?: MessageAttachment[];
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
    const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{
        id: string;
        title: string;
    } | null>(null);
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [progressKey, setProgressKey] = useState<number>(0);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [selectedImageModal, setSelectedImageModal] = useState<string | null>(
        null,
    );
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(15);

    useEffect(() => {
        const step1 = setTimeout(() => setLoadingProgress(50), 120);
        const step2 = setTimeout(() => setLoadingProgress(85), 320);
        const step3 = setTimeout(() => setLoadingProgress(100), 550);

        const fadeTimer = setTimeout(() => {
            setIsFadingOut(true);
        }, 750);

        const removeTimer = setTimeout(() => {
            setIsInitialLoading(false);
        }, 1050);

        return () => {
            clearTimeout(step1);
            clearTimeout(step2);
            clearTimeout(step3);
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
    }, [inputMessage]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        console.log(
            '[CodeBrain] 🔄 Active conversation_id state:',
            conversationId,
        );
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
        void fetchConversations();
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
                (
                    document.querySelector(
                        'meta[name="csrf-token"]',
                    ) as HTMLMetaElement
                )?.content || '';
            const response = await fetch(`/load-chat?conversation_id=${id}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            setAttachedFiles((prev) => [...prev, ...filesArray]);
        }
        if (e.target) {
            e.target.value = '';
        }
    };

    const removeAttachedFile = (index: number) => {
        setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes || bytes === 0) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = (fileName: string, mime?: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (
            mime?.startsWith('image/') ||
            ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
        ) {
            return (
                <ImageIcon className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            );
        }
        if (ext === 'pdf') {
            return <FileText className="h-4 w-4 flex-shrink-0 text-red-400" />;
        }
        if (['doc', 'docx'].includes(ext)) {
            return <FileText className="h-4 w-4 flex-shrink-0 text-blue-400" />;
        }
        if (['xls', 'xlsx', 'csv'].includes(ext)) {
            return (
                <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-500" />
            );
        }
        if (
            [
                'js',
                'ts',
                'tsx',
                'jsx',
                'py',
                'php',
                'html',
                'css',
                'json',
                'cpp',
                'java',
                'cs',
                'c',
                'h',
            ].includes(ext)
        ) {
            return (
                <FileCode className="h-4 w-4 flex-shrink-0 text-purple-400" />
            );
        }
        return <File className="h-4 w-4 flex-shrink-0 text-amber-400" />;
    };

    const sendPrompt = async (promptText?: string) => {
        const textToSend = (promptText || inputMessage).trim();
        if ((!textToSend && attachedFiles.length === 0) || isLoading) return;

        console.log(
            '[CodeBrain] 📤 Sending prompt & files to /chat with conversation_id:',
            conversationId,
        );

        const currentAttachedFiles = [...attachedFiles];
        const currentAttachments: MessageAttachment[] =
            currentAttachedFiles.map((f) => ({
                name: f.name,
                size: f.size,
                mime: f.type,
                url: f.type.startsWith('image/')
                    ? URL.createObjectURL(f)
                    : undefined,
            }));

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            attachments: currentAttachments,
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
        setAttachedFiles([]);
        setIsLoading(true);

        try {
            const csrfToken =
                (
                    document.querySelector(
                        'meta[name="csrf-token"]',
                    ) as HTMLMetaElement
                )?.content || '';

            const formData = new FormData();
            if (textToSend) formData.append('prompt', textToSend);
            if (conversationId)
                formData.append('conversation_id', conversationId);
            formData.append('mode', activeMode);
            if (currentAttachedFiles.length > 0) {
                formData.append('attachment', currentAttachedFiles[0]);
            }

            console.log('Attachment', currentAttachedFiles[0]);
            console.log('Active mode', activeMode);

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    Accept: 'text/event-stream',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: formData,
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
                            console.log(
                                '[CodeBrain] 📥 Received conversation_id from server stream:',
                                data.id,
                            );
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
                                        : message,
                                ),
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
                            console.log(
                                '[CodeBrain] 📥 Received conversation_id from server stream (buffer):',
                                data.id,
                            );
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
                                        : message,
                                ),
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
                        ? {
                              ...message,
                              content:
                                  'An error occurred while connecting to the AI agent.',
                          }
                        : message,
                ),
            );
        } finally {
            setIsLoading(false);
            void fetchConversations();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void sendPrompt();
        }
    };

    const clearChat = () => {
        console.log('[CodeBrain] 🧹 Reset chat and conversation_id to null');
        setActiveMode('chat');
        setMessages([]);
        setAttachedFiles([]);
        setConversationId(null);
    };

    const executeDeleteConversation = async (id: string) => {
        try {
            const csrfToken =
                (
                    document.querySelector(
                        'meta[name="csrf-token"]',
                    ) as HTMLMetaElement
                )?.content || '';
            await fetch('/clear-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    conversation_id: id,
                }),
            });
            void fetchConversations();
        } catch (error) {
            console.error('Error deleting conversation:', error);
        } finally {
            setActiveMenuId(null);
        }
    };

    const stageDeleteConversation = (id: string) => {
        const targetConv = conversations.find((c) => c.id === id);
        const title = targetConv?.title || 'Conversation';

        if (pendingDelete && undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            void executeDeleteConversation(pendingDelete.id);
        }

        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (conversationId === id) {
            clearChat();
        }

        setPendingDelete({ id, title });
        setProgressKey(Date.now());

        undoTimerRef.current = setTimeout(() => {
            void executeDeleteConversation(id);
            setPendingDelete(null);
            undoTimerRef.current = null;
        }, 3000);
    };

    const handleUndoDelete = () => {
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
        setPendingDelete(null);
        void fetchConversations();
    };

    const startFailoverMode = () => {
        console.log('[CodeBrain] 🛡️ Switched to Code Failover Analysis Mode');
        setActiveMode('failover');
        setMessages([]);
        setAttachedFiles([]);
        setConversationId(null);
    };

    const handleCopyUserPrompt = (id: string, text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopiedPromptId(id);
                setTimeout(() => {
                    setCopiedPromptId(null);
                }, 2000);
            })
            .catch((err) => {
                console.error('Failed to copy prompt: ', err);
            });
    };

    const handleCopyClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const copyBtn = target.closest(
            '.copy-code-btn',
        ) as HTMLButtonElement | null;
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
        let processedContent = content;

        // Strip any residual raw ASCII block meters if present
        processedContent = processedContent.replace(
            /`[█░\s]+`\s*\*\*[\d%\s\w]+\*\*/gi,
            '',
        );
        processedContent = processedContent.replace(/`[█░\s]+`/gi, '');

        // Extract and isolate raw "Note on Risk & Security Analysis" block before marked.parse
        let riskNoteCardHtml = '';
        const rawNoteRegex =
            /(?:>\s*)?(?:💡\s*)?(?:\*\*)?\s*Note on Risk[\s\S]*?(?:failover checker|proper risk analysis!)[^\n]*/gi;

        if (rawNoteRegex.test(processedContent)) {
            processedContent = processedContent.replace(
                rawNoteRegex,
                (matchedNoteBlock) => {
                    const cleanNoteMarkdown = matchedNoteBlock
                        .replace(/^(?:>\s*)?(?:💡\s*)?/, '')
                        .trim();
                    const parsedNoteContent = marked.parse(cleanNoteMarkdown, {
                        async: false,
                    }) as string;

                    const highlightedNoteContent = parsedNoteContent.replace(
                        /(failover checker)/gi,
                        '<strong class="text-amber-300 font-semibold underline underline-offset-4 decoration-amber-400/50">$1</strong>',
                    );

                    riskNoteCardHtml = `
<div class="my-4 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-zinc-900/95 to-amber-950/30 p-4 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.35)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:border-amber-400/90 ring-1 ring-amber-500/20 not-prose">
    <div class="flex items-start gap-3">
        <span class="text-xl flex-shrink-0 animate-pulse select-none">💡</span>
        <div class="text-xs text-amber-100/90 leading-relaxed m-0 space-y-1">
            ${highlightedNoteContent}
        </div>
    </div>
</div>
`;
                    return 'RISKNOTECARDPLACEHOLDER999';
                },
            );
        }

        const rawHtml = marked.parse(processedContent, {
            async: false,
        }) as string;
        let enhancedHtml = rawHtml;

        if (riskNoteCardHtml) {
            enhancedHtml = enhancedHtml.replace(
                /(?:<p[^>]*>|<em[^>]*>|<strong[^>]*>|\s)*RISKNOTECARDPLACEHOLDER999(?:<\/p>|<\/em>|<\/strong>|\s)*/gi,
                riskNoteCardHtml,
            );
        } else {
            // Fallback for HTML-only content
            const fallbackRegex =
                /(?:<blockquote[^>]*>\s*)?<p[^>]*>((?:(?!<\/p>)[\s\S])*?(?:Note on Risk|failover checker)(?:(?!<\/p>)[\s\S])*?)<\/p>(?:\s*<\/blockquote>)?/gi;
            enhancedHtml = enhancedHtml.replace(
                fallbackRegex,
                (_match, innerText: string) => {
                    let cleanText = innerText.replace(
                        /^(\s*<[^>]+>)*\s*💡\s*/gi,
                        '$1',
                    );
                    cleanText = cleanText.replace(
                        /(failover checker)/gi,
                        '<strong class="text-amber-300 font-semibold underline underline-offset-4 decoration-amber-400/50">$1</strong>',
                    );

                    return `
<div class="my-4 rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-zinc-900/95 to-amber-950/30 p-4 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.35)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_28px_rgba(245,158,11,0.5)] hover:border-amber-400/90 ring-1 ring-amber-500/20 not-prose">
    <div class="flex items-start gap-3">
        <span class="text-xl flex-shrink-0 animate-pulse select-none">💡</span>
        <div class="text-xs text-amber-100/90 leading-relaxed m-0">
            ${cleanText}
        </div>
    </div>
</div>
`;
                },
            );
        }

        // Extract Risk Assessment metrics
        const scoreMatch =
            content.match(/Risk Score:?\s*`?\s*([\d.]+)\s*\/\s*10/i) ||
            content.match(/Score:?\s*`?\s*([\d.]+)\s*\/\s*10/i) ||
            content.match(/([\d.]+)\s*\/\s*10/i);
        const levelMatch =
            content.match(/Risk Level:?\s*`?\s*([A-Z]+)/i) ||
            content.match(/(CRITICAL|HIGH|MEDIUM|LOW)/i);
        const percentageMatch =
            content.match(/Severity Percentage:?\s*`?\s*(\d+)%/i) ||
            content.match(/(\d+)%/i);
        const impactMatch =
            content.match(
                /Impact & Risk Summary:?\s*\*?\s*(.*?)(?=\n\s*-|\n\s*\d|\n\s*#|$)/is,
            ) ||
            content.match(
                /Impact Summary:?\s*\*?\s*(.*?)(?=\n\s*-|\n\s*\d|\n\s*#|$)/is,
            );

        if (scoreMatch) {
            const scoreNum = parseFloat(scoreMatch[1]);
            let percentage = percentageMatch
                ? parseInt(percentageMatch[1], 10)
                : Math.round(Math.min(10, Math.max(0, scoreNum)) * 10);
            if (isNaN(percentage)) percentage = Math.round(scoreNum * 10);

            let level = levelMatch ? levelMatch[1].toUpperCase() : 'MEDIUM';
            if (scoreNum >= 8.5) level = 'CRITICAL';
            else if (scoreNum >= 6.5) level = 'HIGH';
            else if (scoreNum >= 4.0) level = 'MEDIUM';
            else if (scoreNum < 4.0) level = 'LOW';

            let theme = {
                border: 'border-emerald-500/40 bg-emerald-950/20 shadow-emerald-950/30',
                badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
                bar: 'from-emerald-600 via-teal-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]',
                text: 'text-emerald-400',
                icon: '🟢',
            };

            if (level === 'CRITICAL' || scoreNum >= 8.5) {
                theme = {
                    border: 'border-red-500/40 bg-red-950/25 shadow-red-950/40',
                    badge: 'bg-red-500/20 text-red-400 border-red-500/40',
                    bar: 'from-red-600 via-rose-500 to-red-400 shadow-[0_0_14px_rgba(239,68,68,0.7)]',
                    text: 'text-red-400',
                    icon: '🔴',
                };
            } else if (level === 'HIGH' || scoreNum >= 6.5) {
                theme = {
                    border: 'border-orange-500/40 bg-orange-950/25 shadow-orange-950/40',
                    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
                    bar: 'from-orange-600 via-amber-500 to-orange-400 shadow-[0_0_14px_rgba(249,115,22,0.7)]',
                    text: 'text-orange-400',
                    icon: '🟠',
                };
            } else if (level === 'MEDIUM' || scoreNum >= 4.0) {
                theme = {
                    border: 'border-amber-500/40 bg-amber-950/25 shadow-amber-950/40',
                    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    bar: 'from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)]',
                    text: 'text-amber-300',
                    icon: '🟡',
                };
            }

            const impactSummaryText = impactMatch
                ? impactMatch[1].replace(/<\/?[^>]+(>|$)/g, '').trim()
                : '';

            const meterCard = `
<div class="my-4 rounded-2xl border ${theme.border} p-4 shadow-xl backdrop-blur-md not-prose transition-all">
    <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
            <span class="text-2xl">🚨</span>
            <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">Risk Rating</span>
                <span class="text-xl font-black text-white tracking-tight">${scoreNum.toFixed(1)} <span class="text-zinc-500 text-xs font-medium">/ 10</span></span>
            </div>
        </div>
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${theme.badge}">
            <span>${theme.icon}</span>
            <span>${level}</span>
        </div>
    </div>
    <div class="space-y-1.5">
        <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-zinc-400">Severity Level</span>
            <span class="${theme.text} font-bold text-sm">${percentage}%</span>
        </div>
        <div class="w-full bg-zinc-950/90 h-3.5 rounded-full overflow-hidden p-0.5 border border-zinc-800/80">
            <div class="bg-gradient-to-r ${theme.bar} h-full rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
        </div>
    </div>
    ${
        impactSummaryText
            ? `
    <div class="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
        <strong class="text-white">Impact & Risk Summary:</strong> ${impactSummaryText}
    </div>
    `
            : ''
    }
</div>
`;

            const ulRegex =
                /<ul[^>]*>[\s\S]*?(?:Risk Score|Severity Percentage|Risk Level)[\s\S]*?<\/ul>/gi;
            if (enhancedHtml.search(ulRegex) !== -1) {
                enhancedHtml = enhancedHtml.replace(ulRegex, () => meterCard);
            } else {
                enhancedHtml = enhancedHtml.replace(
                    /(?:<p>|<h[1-6]>|<li[^>]*>).*?Risk Assessment.*?(?:<\/p>|<\/h[1-6]>|<\/li>)/i,
                    (m) => m + '\n' + meterCard,
                );
            }
        }

        const cleanHtml = DOMPurify.sanitize(enhancedHtml, {
            ADD_ATTR: ['target', 'style', 'class', 'rel'],
        });
        return { __html: cleanHtml };
    };

    const isFailoverConv = (title?: string) => {
        if (!title) return false;
        return title.toLowerCase().includes('failover');
    };

    const failoverConversations = conversations.filter((c) =>
        isFailoverConv(c.title),
    );
    const standardConversations = conversations.filter(
        (c) => !isFailoverConv(c.title),
    );

    return (
        <>
            <Head title="CodeBrain - AI Code Reviewer" />

            {/* Sleek Loading Screen Overlay with Progress Bar */}
            {isInitialLoading && (
                <div
                    className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b] text-white transition-opacity duration-300 ease-out ${
                        isFadingOut
                            ? 'pointer-events-none opacity-0'
                            : 'opacity-100'
                    }`}
                >
                    {/* Soft Radial Ambient Glow */}
                    <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-purple-600/10 blur-[90px]" />

                    <div className="relative flex flex-col items-center gap-4 px-4 text-center">
                        {/* Logo Container with Pulsing Glow */}
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-md">
                            <img
                                src={appLogo}
                                alt="CodeBrain Logo"
                                className="h-full w-full animate-pulse object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] filter"
                            />
                        </div>

                        {/* App Branding */}
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                CodeBrain
                            </h1>
                            <p className="mt-0.5 text-xs font-medium text-zinc-400">
                                AI Code Reviewer
                            </p>
                        </div>

                        {/* Progress Bar & Percentage Ticker */}
                        <div className="mt-2 flex w-56 flex-col items-center gap-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/5 bg-zinc-900 shadow-inner">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-300 ease-out"
                                    style={{ width: `${loadingProgress}%` }}
                                />
                            </div>

                            <span className="font-mono text-[11px] font-medium text-purple-300/80">
                                {loadingProgress}%
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] font-sans text-zinc-100 antialiased">
                {/* Left Sidebar */}
                <aside className="z-20 flex w-64 flex-shrink-0 flex-col justify-between border-r border-zinc-800/80 bg-[#121217] p-4">
                    <div className="space-y-6">
                        {/* Header Branding */}
                        <div className="flex items-center gap-3">
                            <img
                                src={appLogo}
                                alt="CodeBrain Logo"
                                className="h-15 w-15 rounded-xl object-contain"
                            />
                            <div>
                                <h1 className="text-base leading-tight font-semibold text-white">
                                    CodeBrain
                                </h1>
                                <p className="text-xs text-zinc-400">
                                    Powered by Gemini
                                </p>
                            </div>
                        </div>

                        {/* New Conversation Button */}
                        <div className="space-y-2">
                            <button
                                onClick={clearChat}
                                className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800/80"
                            >
                                <Plus className="h-4 w-4 text-zinc-400" />
                                <span>New Conversation</span>
                            </button>

                            {/* Check Code Failover Button */}
                            <button
                                onClick={startFailoverMode}
                                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                                    activeMode === 'failover'
                                        ? 'border-purple-600 bg-purple-600/30 font-semibold text-purple-200 shadow-md shadow-purple-900/30'
                                        : 'border-purple-950/60 bg-purple-950/20 text-purple-300 hover:border-purple-800/80 hover:bg-purple-900/40'
                                }`}
                            >
                                <ShieldAlert className="h-4 w-4 text-purple-400" />
                                <span>Check code failover</span>
                            </button>
                        </div>
                    </div>

                    {/* Conversations List */}
                    <div className="no-scrollbar my-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                        {/* Failover Audits Section */}
                        {failoverConversations.length > 0 && (
                            <div className="space-y-1">
                                <div className="mb-2 flex items-center gap-1.5 px-2">
                                    <ShieldAlert className="h-3 w-3 text-purple-400" />
                                    <p className="text-[11px] font-bold tracking-wider text-purple-400 uppercase">
                                        Failover Audits
                                    </p>
                                </div>
                                {failoverConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className={`group relative flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
                                            conversationId === conv.id
                                                ? 'border-purple-500/50 bg-purple-600/30 font-semibold text-purple-200 shadow-md shadow-purple-900/20'
                                                : 'border-purple-900/40 bg-purple-950/20 text-purple-300 hover:bg-purple-900/40 hover:text-white'
                                        }`}
                                        onClick={() =>
                                            selectConversation(conv.id)
                                        }
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                                            <span className="flex-1 truncate">
                                                {conv.title || 'Failover Check'}
                                            </span>
                                            <span className="flex-shrink-0 rounded-md border border-purple-700/50 bg-purple-900/80 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-purple-300 uppercase">
                                                Failover
                                            </span>
                                        </div>

                                        {/* 3-Dot Options Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(
                                                    activeMenuId === conv.id
                                                        ? null
                                                        : conv.id,
                                                );
                                            }}
                                            className={`ml-1 flex-shrink-0 cursor-pointer rounded-md p-1 text-purple-300 transition hover:bg-purple-800/60 hover:text-white ${
                                                activeMenuId === conv.id
                                                    ? 'bg-purple-800/60 opacity-100'
                                                    : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                        >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Delete Dropdown Menu UI */}
                                        {activeMenuId === conv.id && (
                                            <div
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="absolute top-9 right-2 z-30 w-44 rounded-xl border border-zinc-800 bg-[#181820] p-1.5 shadow-xl shadow-black/50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(
                                                            conv.id,
                                                        );
                                                        setActiveMenuId(null);
                                                    }}
                                                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>
                                                        Delete Conversation
                                                    </span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Recent Chats Section */}
                        <div className="space-y-1">
                            <p className="mb-2 px-2 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
                                Recent Chats
                            </p>
                            {standardConversations.length === 0 &&
                            failoverConversations.length === 0 ? (
                                <p className="px-2 text-xs text-zinc-600">
                                    No conversations yet
                                </p>
                            ) : standardConversations.length === 0 ? (
                                <p className="px-2 text-xs text-zinc-600">
                                    No standard chats yet
                                </p>
                            ) : (
                                standardConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                                            conversationId === conv.id
                                                ? 'border border-purple-500/30 bg-purple-600/20 font-semibold text-purple-300'
                                                : 'border border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                                        }`}
                                        onClick={() =>
                                            selectConversation(conv.id)
                                        }
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
                                            <span className="truncate">
                                                {conv.title ||
                                                    'New Conversation'}
                                            </span>
                                        </div>

                                        {/* 3-Dot Options Button */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenuId(
                                                    activeMenuId === conv.id
                                                        ? null
                                                        : conv.id,
                                                );
                                            }}
                                            className={`flex-shrink-0 cursor-pointer rounded-md p-1 text-zinc-400 transition hover:bg-zinc-700/60 hover:text-white ${
                                                activeMenuId === conv.id
                                                    ? 'bg-zinc-700/60 opacity-100'
                                                    : 'opacity-0 group-hover:opacity-100'
                                            }`}
                                        >
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </button>

                                        {/* Delete Dropdown Menu UI */}
                                        {activeMenuId === conv.id && (
                                            <div
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="absolute top-9 right-2 z-30 w-44 rounded-xl border border-zinc-800 bg-[#181820] p-1.5 shadow-xl shadow-black/50"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(
                                                            conv.id,
                                                        );
                                                        setActiveMenuId(null);
                                                    }}
                                                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>
                                                        Delete Conversation
                                                    </span>
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
                            <span className="relative flex h-2 w-2 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                            </span>
                            <span className="font-medium">
                                Gemini 3.6 Flash
                            </span>
                        </div>
                        <p className="px-1 text-[11px] text-zinc-500">
                            Built with Laravel 13 AI SDK
                        </p>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[#09090b]">
                    {/* Top Header Bar */}
                    <header className="z-10 flex items-center justify-between border-b border-zinc-800/60 bg-[#09090b] px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
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
                            <span className="rounded-full border border-purple-800/60 bg-purple-950 px-3 py-1 text-[11px] font-semibold tracking-wider text-purple-300 uppercase">
                                Failover Audit Mode
                            </span>
                        )}
                        <button
                            onClick={clearChat}
                            className="cursor-pointer text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                        >
                            Clear
                        </button>
                    </header>

                    {/* Chat Area / Empty State */}
                    {messages.length === 0 ? (
                        activeMode === 'failover' ? (
                            <div className="no-scrollbar mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center overflow-y-auto p-6 pb-36 text-center">
                                {/* Centered Failover Badge Icon */}
                                <div className="relative mb-5 flex h-25 w-25 items-center justify-center">
                                    <img
                                        src={appLogo}
                                        alt="CodeBrain Logo"
                                        className="h-full w-full object-contain"
                                    />
                                    <span className="absolute -right-1 -bottom-1 rounded-lg bg-purple-600 p-1 text-white shadow-md">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                    </span>
                                </div>

                                {/* Main Title & Description */}
                                <h3 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                    Code Failover &amp; Vulnerability Analysis
                                </h3>
                                <p className="mb-8 max-w-xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                                    This feature analyzes user-provided code
                                    segments, files, or documents for potential
                                    failing points, security vulnerabilities,
                                    high-traffic concurrency bottlenecks, and
                                    edge-case exceptions before deployment.
                                </p>

                                {/* 4 Feature Cards Grid */}
                                <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold tracking-wider text-purple-400 uppercase">
                                            <Lock className="h-4 w-4" />
                                            <span>
                                                Security &amp; Vulnerabilities
                                            </span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-zinc-400">
                                            Detect SQL injection risks, XSS
                                            vectors, unhandled authorization
                                            checks, and sensitive data leakage
                                            in logic streams.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold tracking-wider text-purple-400 uppercase">
                                            <Zap className="h-4 w-4" />
                                            <span>
                                                High-Traffic Bottlenecks
                                            </span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-zinc-400">
                                            Identify N+1 database queries,
                                            unindexed table scans, memory leaks,
                                            and concurrency locks under sudden
                                            load spikes.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold tracking-wider text-purple-400 uppercase">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span>Edge-Case Exceptions</span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-zinc-400">
                                            Highlight missing null pointer
                                            checks, uncaught API exceptions,
                                            network timeout failures, and
                                            invalid type casting.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-purple-900/60">
                                        <div className="mb-1.5 flex items-center gap-2.5 text-xs font-semibold tracking-wider text-purple-400 uppercase">
                                            <ShieldAlert className="h-4 w-4" />
                                            <span>
                                                Resilience &amp; Fallbacks
                                            </span>
                                        </div>
                                        <p className="text-xs leading-relaxed text-zinc-400">
                                            Get tailored recommendations for
                                            circuit breaker patterns, automated
                                            retry policies, and graceful
                                            fallback strategies.
                                        </p>
                                    </div>
                                </div>

                                {/* Prompt Suggestions Grid */}
                                <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                                    {failoverSuggestions.map(
                                        (suggestion, index) => (
                                            <button
                                                key={index}
                                                onClick={() =>
                                                    setInputMessage(suggestion)
                                                }
                                                className="cursor-pointer rounded-full border border-purple-950/60 bg-purple-950/20 px-4 py-2.5 text-xs font-medium text-purple-300 transition hover:border-purple-800/80 hover:bg-purple-900/40 hover:text-white"
                                            >
                                                {suggestion}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center p-6 pb-36 text-center">
                                {/* Centered Logo Badge */}
                                <div className="mb-6 flex h-30 w-30 items-center justify-center">
                                    <img
                                        src={appLogo}
                                        alt="CodeBrain Logo"
                                        className="h-full w-full object-contain"
                                    />
                                </div>

                                {/* Title & Subtitle */}
                                <h3 className="mb-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                    Welcome to CodeBrain
                                </h3>
                                <p className="mb-8 max-w-md text-sm text-zinc-400 sm:text-base">
                                    AI code reviewer powered by Google Gemini
                                    &amp; Laravel 13 AI SDK
                                </p>

                                {/* Prompt Suggestions Grid */}
                                <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
                                    {suggestions.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() =>
                                                setInputMessage(suggestion)
                                            }
                                            className="font-sm cursor-pointer rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800/80 hover:text-white sm:text-sm"
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
                            className="no-scrollbar mx-auto w-full max-w-5xl flex-1 [scrollbar-width:none] space-y-6 overflow-y-auto p-6 pb-40 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        >
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex items-start gap-4 ${
                                        msg.role === 'user'
                                            ? 'justify-end'
                                            : 'justify-start'
                                    }`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white">
                                            <Bot className="h-4 w-4" />
                                        </div>
                                    )}

                                    {msg.role === 'user' ? (
                                        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                                            {/* Render User Attachments */}
                                            {msg.attachments &&
                                                msg.attachments.length > 0 && (
                                                    <div className="mb-1 flex flex-wrap justify-end gap-2">
                                                        {msg.attachments.map(
                                                            (att, attIdx) => {
                                                                const isImg =
                                                                    att.mime?.startsWith(
                                                                        'image/',
                                                                    ) ||
                                                                    att.type?.includes(
                                                                        'image',
                                                                    ) ||
                                                                    [
                                                                        'png',
                                                                        'jpg',
                                                                        'jpeg',
                                                                        'webp',
                                                                        'gif',
                                                                        'svg',
                                                                    ].some(
                                                                        (ext) =>
                                                                            att.name
                                                                                ?.toLowerCase()
                                                                                .endsWith(
                                                                                    '.' +
                                                                                        ext,
                                                                                ),
                                                                    );
                                                                return (
                                                                    <div
                                                                        key={
                                                                            attIdx
                                                                        }
                                                                        className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/80 px-3 py-2 text-xs text-purple-200 shadow-md"
                                                                    >
                                                                        {isImg &&
                                                                        att.url ? (
                                                                            <div
                                                                                className="group relative cursor-pointer"
                                                                                onClick={() =>
                                                                                    setSelectedImageModal(
                                                                                        att.url!,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <img
                                                                                    src={
                                                                                        att.url
                                                                                    }
                                                                                    alt={
                                                                                        att.name
                                                                                    }
                                                                                    className="h-10 w-10 rounded-lg border border-purple-400/30 object-cover transition group-hover:opacity-80"
                                                                                />
                                                                                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition group-hover:opacity-100">
                                                                                    <Eye className="h-3.5 w-3.5 text-white" />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            getFileIcon(
                                                                                att.name,
                                                                                att.mime,
                                                                            )
                                                                        )}
                                                                        <div className="flex max-w-[160px] flex-col">
                                                                            <span className="truncate text-xs font-semibold text-white">
                                                                                {
                                                                                    att.name
                                                                                }
                                                                            </span>
                                                                            {att.size ? (
                                                                                <span className="text-[10px] text-purple-300">
                                                                                    {formatFileSize(
                                                                                        att.size,
                                                                                    )}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        {att.url &&
                                                                            !isImg && (
                                                                                <a
                                                                                    href={
                                                                                        att.url
                                                                                    }
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="ml-1 rounded-md p-1 text-purple-300 transition hover:bg-purple-800/60 hover:text-white"
                                                                                    title="View/Download Attachment"
                                                                                >
                                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                                </a>
                                                                            )}
                                                                    </div>
                                                                );
                                                            },
                                                        )}
                                                    </div>
                                                )}

                                            {msg.content ? (
                                                <div className="rounded-2xl rounded-br-none bg-purple-600 px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-sm">
                                                    {msg.content}
                                                </div>
                                            ) : null}

                                            <button
                                                type="button"
                                                title={
                                                    copiedPromptId === msg.id
                                                        ? 'Copied!'
                                                        : 'Copy prompt'
                                                }
                                                onClick={() =>
                                                    handleCopyUserPrompt(
                                                        msg.id,
                                                        msg.content,
                                                    )
                                                }
                                                className="cursor-pointer rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800/60 hover:text-purple-300 active:scale-95"
                                            >
                                                {copiedPromptId === msg.id ? (
                                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="markdown-body max-w-none flex-1 rounded-2xl rounded-bl-none border border-zinc-800 bg-zinc-900 px-5 py-3.5 text-sm leading-relaxed text-zinc-200">
                                            {msg.content.trim() === '' ? (
                                                <div className="flex items-center gap-2.5 py-0.5 text-zinc-400">
                                                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                                    <span className="text-xs font-medium text-zinc-400">
                                                        Thinking...
                                                    </span>
                                                </div>
                                            ) : (
                                                <div
                                                    dangerouslySetInnerHTML={renderMarkdown(
                                                        msg.content,
                                                    )}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {msg.role === 'user' && (
                                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-sm font-bold text-zinc-300">
                                            <User className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div ref={messagesEndRef} />
                        </div>
                    )}

                    {/* Bottom Chat Input Dock Wrapper */}
                    <div className="absolute right-0 bottom-0 left-0 z-10 w-full bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent px-4 pt-4 pb-6 backdrop-blur-md">
                        <div className="mx-auto w-full max-w-2xl space-y-2">
                            {/* Attached Files Previews Dock */}
                            {attachedFiles.length > 0 && (
                                <div className="no-scrollbar animate-in fade-in slide-in-from-bottom-2 flex max-h-28 items-center gap-2 overflow-x-auto rounded-xl border border-purple-500/40 bg-[#16161e]/95 p-2 duration-150">
                                    {attachedFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="group relative flex flex-shrink-0 items-center gap-2.5 rounded-lg border border-zinc-700/70 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 shadow-sm"
                                        >
                                            {file.type.startsWith('image/') ? (
                                                <img
                                                    src={URL.createObjectURL(
                                                        file,
                                                    )}
                                                    alt={file.name}
                                                    className="h-7 w-7 rounded border border-zinc-700 object-cover"
                                                />
                                            ) : (
                                                getFileIcon(
                                                    file.name,
                                                    file.type,
                                                )
                                            )}
                                            <div className="flex max-w-[130px] min-w-0 flex-col">
                                                <span className="truncate font-medium text-white">
                                                    {file.name}
                                                </span>
                                                <span className="text-[10px] text-zinc-400">
                                                    {formatFileSize(file.size)}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeAttachedFile(idx)
                                                }
                                                className="cursor-pointer rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-red-400"
                                                title="Remove file"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Input Container */}
                            <div className="relative flex items-end rounded-2xl border border-zinc-800 bg-[#16161e] px-4 py-3 shadow-xl transition-all focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/30">
                                {/* Hidden File Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.md,.txt,.json,.csv,.py,.js,.ts,.tsx,.jsx,.html,.css,.php,.cpp,.java,.cs,.c,.h"
                                    className="hidden"
                                />

                                {/* Paperclip Attachment Button */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    disabled={isLoading}
                                    className="mr-3 mb-1 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-800/80 hover:text-purple-300 active:scale-95 disabled:opacity-50"
                                    title="Attach files (PDF, Images, Word, Excel, Text, Code, MD)"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    value={inputMessage}
                                    onChange={(e) =>
                                        setInputMessage(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        activeMode === 'failover'
                                            ? 'Paste code snippet or attach file to analyze failover risks...'
                                            : 'Message CodeBrain or attach files...'
                                    }
                                    disabled={isLoading}
                                    className="no-scrollbar max-h-48 w-full resize-none overflow-y-auto bg-transparent py-1.5 pr-10 text-sm leading-relaxed text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => sendPrompt()}
                                    disabled={
                                        isLoading ||
                                        (!inputMessage.trim() &&
                                            attachedFiles.length === 0)
                                    }
                                    className={`absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                                        inputMessage.trim() ||
                                        attachedFiles.length > 0
                                            ? 'cursor-pointer bg-purple-600 text-white shadow-md shadow-purple-600/30 hover:bg-purple-500 hover:shadow-[0_0_16px_rgba(168,85,247,0.85)] hover:ring-2 hover:ring-purple-400/60 active:scale-95'
                                            : 'cursor-not-allowed bg-zinc-800 text-zinc-500 opacity-50'
                                    }`}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <SendHorizontal className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-2 text-center text-[11px] text-zinc-500">
                                CodeBrain can make mistakes. Always verify
                                important info.
                            </p>
                        </div>
                    </div>
                </main>
            </div>

            {/* Image Lightbox Preview Modal */}
            {selectedImageModal && (
                <div
                    className="animate-in fade-in fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 p-4 backdrop-blur-sm duration-150"
                    onClick={() => setSelectedImageModal(null)}
                >
                    <div
                        className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#121218] p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedImageModal(null)}
                            className="absolute top-3 right-3 z-10 cursor-pointer rounded-full bg-black/60 p-1.5 text-zinc-300 transition hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img
                            src={selectedImageModal}
                            alt="Preview Attachment"
                            className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm duration-150">
                    <div
                        className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-[#14141b] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">
                                    Delete Conversation
                                </h3>
                                <p className="text-xs text-zinc-400">
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        <p className="text-sm leading-relaxed text-zinc-300">
                            Are you sure you want to delete{' '}
                            <span className="font-semibold text-zinc-100">
                                "
                                {conversations.find(
                                    (c) => c.id === deleteConfirmId,
                                )?.title || 'this conversation'}
                                "
                            </span>
                            ? All messages in this chat will be permanently
                            removed.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="cursor-pointer rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const id = deleteConfirmId;
                                    setDeleteConfirmId(null);
                                    if (id) {
                                        stageDeleteConversation(id);
                                    }
                                }}
                                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-red-950/40 transition hover:bg-red-500 active:scale-95"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Undo Deletion Toast Notification */}
            {pendingDelete && (
                <div className="animate-in fade-in slide-in-from-top-3 fixed top-5 right-5 z-50 duration-200">
                    <div className="flex max-w-sm min-w-[320px] flex-col space-y-2.5 overflow-hidden rounded-xl border border-zinc-800 bg-[#161622]/95 p-3.5 text-zinc-100 shadow-2xl shadow-black/80 backdrop-blur-md">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                                    <Trash2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-zinc-100">
                                        Conversation deleted
                                    </p>
                                    <p className="max-w-[160px] truncate text-[11px] text-zinc-400">
                                        {pendingDelete.title}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleUndoDelete}
                                className="flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-400 transition hover:bg-purple-500/20 hover:text-purple-300 active:scale-95"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Undo</span>
                            </button>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800/80">
                            <div
                                key={progressKey}
                                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                style={{
                                    animation:
                                        'shrinkProgress 3s linear forwards',
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes shrinkProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </>
    );
}
