import { Head } from '@inertiajs/react';
import { useState, useRef, useEffect } from 'react';
import { Plus, SendHorizontal, Loader2, Bot, User, MessageSquare, MoreVertical, Trash2, ShieldAlert, Zap, Lock, AlertTriangle, Copy, Check, RotateCcw, Paperclip, FileText, FileSpreadsheet, FileCode, Image as ImageIcon, File, X, ExternalLink, Eye } from 'lucide-react';
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
    const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
    const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [progressKey, setProgressKey] = useState<number>(0);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

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
        if (mime?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
            return <ImageIcon className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
        }
        if (ext === 'pdf') {
            return <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />;
        }
        if (['doc', 'docx'].includes(ext)) {
            return <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />;
        }
        if (['xls', 'xlsx', 'csv'].includes(ext)) {
            return <FileSpreadsheet className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
        }
        if (['js', 'ts', 'tsx', 'jsx', 'py', 'php', 'html', 'css', 'json', 'cpp', 'java', 'cs', 'c', 'h'].includes(ext)) {
            return <FileCode className="h-4 w-4 text-purple-400 flex-shrink-0" />;
        }
        return <File className="h-4 w-4 text-amber-400 flex-shrink-0" />;
    };

    const sendPrompt = async (promptText?: string) => {
        const textToSend = (promptText || inputMessage).trim();
        if ((!textToSend && attachedFiles.length === 0) || isLoading) return;

        console.log('[CodeBrain] 📤 Sending prompt & files to /chat with conversation_id:', conversationId);

        const currentAttachedFiles = [...attachedFiles];
        const currentAttachments: MessageAttachment[] = currentAttachedFiles.map((f) => ({
            name: f.name,
            size: f.size,
            mime: f.type,
            url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
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
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

            const formData = new FormData();
            if (textToSend) formData.append('prompt', textToSend);
            if (conversationId) formData.append('conversation_id', conversationId);
            formData.append('mode', activeMode);
            if (currentAttachedFiles.length > 0) {
                formData.append('attachment', currentAttachedFiles[0]);
            }

            console.log('Attachment', currentAttachedFiles[0]);
            console.log('Active mode', activeMode);

            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
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
                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            await fetch('/clear-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({
                    conversation_id: id,
                }),
            });
            fetchConversations();
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
            executeDeleteConversation(pendingDelete.id);
        }

        setConversations((prev) => prev.filter((c) => c.id !== id));

        if (conversationId === id) {
            clearChat();
        }

        setPendingDelete({ id, title });
        setProgressKey(Date.now());

        undoTimerRef.current = setTimeout(() => {
            executeDeleteConversation(id);
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
        fetchConversations();
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
        let processedContent = content;

        // Strip any residual raw ASCII block meters if present
        processedContent = processedContent.replace(/`[█░\s]+`\s*\*\*[\d%\s\w]+\*\*/gi, '');
        processedContent = processedContent.replace(/`[█░\s]+`/gi, '');

        // Extract and isolate raw "Note on Risk & Security Analysis" block before marked.parse
        let riskNoteCardHtml = '';
        const rawNoteRegex = /(?:>\s*)?(?:💡\s*)?(?:\*\*)?\s*Note on Risk[\s\S]*?(?:failover checker|proper risk analysis!)[^\n]*/gi;

        if (rawNoteRegex.test(processedContent)) {
            processedContent = processedContent.replace(rawNoteRegex, (matchedNoteBlock) => {
                const cleanNoteMarkdown = matchedNoteBlock.replace(/^(?:>\s*)?(?:💡\s*)?/, '').trim();
                const parsedNoteContent = marked.parse(cleanNoteMarkdown, { async: false }) as string;

                const highlightedNoteContent = parsedNoteContent.replace(
                    /(failover checker)/gi,
                    '<strong class="text-amber-300 font-semibold underline underline-offset-4 decoration-amber-400/50">$1</strong>'
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
            });
        }

        const rawHtml = marked.parse(processedContent, { async: false }) as string;
        let enhancedHtml = rawHtml;

        if (riskNoteCardHtml) {
            enhancedHtml = enhancedHtml.replace(/(?:<p[^>]*>|<em[^>]*>|<strong[^>]*>|\s)*RISKNOTECARDPLACEHOLDER999(?:<\/p>|<\/em>|<\/strong>|\s)*/gi, riskNoteCardHtml);
        } else {
            // Fallback for HTML-only content
            const fallbackRegex = /(?:<blockquote[^>]*>\s*)?<p[^>]*>((?:(?!<\/p>)[\s\S])*?(?:Note on Risk|failover checker)(?:(?!<\/p>)[\s\S])*?)<\/p>(?:\s*<\/blockquote>)?/gi;
            enhancedHtml = enhancedHtml.replace(fallbackRegex, (_match, innerText: string) => {
                let cleanText = innerText.replace(/^(\s*<[^>]+>)*\s*💡\s*/gi, '$1');
                cleanText = cleanText.replace(
                    /(failover checker)/gi,
                    '<strong class="text-amber-300 font-semibold underline underline-offset-4 decoration-amber-400/50">$1</strong>'
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
            });
        }

        // Extract Risk Assessment metrics
        const scoreMatch = content.match(/Risk Score:?\s*`?\s*([\d.]+)\s*\/\s*10/i) ||
                           content.match(/Score:?\s*`?\s*([\d.]+)\s*\/\s*10/i) ||
                           content.match(/([\d.]+)\s*\/\s*10/i);
        const levelMatch = content.match(/Risk Level:?\s*`?\s*([A-Z]+)/i) ||
                           content.match(/(CRITICAL|HIGH|MEDIUM|LOW)/i);
        const percentageMatch = content.match(/Severity Percentage:?\s*`?\s*(\d+)%/i) ||
                                content.match(/(\d+)%/i);
        const impactMatch = content.match(/Impact & Risk Summary:?\s*\*?\s*(.*?)(?=\n\s*-|\n\s*\d|\n\s*#|$)/is) ||
                            content.match(/Impact Summary:?\s*\*?\s*(.*?)(?=\n\s*-|\n\s*\d|\n\s*#|$)/is);

        if (scoreMatch) {
            const scoreNum = parseFloat(scoreMatch[1]);
            let percentage = percentageMatch ? parseInt(percentageMatch[1], 10) : Math.round(Math.min(10, Math.max(0, scoreNum)) * 10);
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

            const impactSummaryText = impactMatch ? impactMatch[1].replace(/<\/?[^>]+(>|$)/g, '').trim() : '';

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
    ${impactSummaryText ? `
    <div class="mt-3 pt-3 border-t border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
        <strong class="text-white">Impact & Risk Summary:</strong> ${impactSummaryText}
    </div>
    ` : ''}
</div>
`;

            const ulRegex = /<ul[^>]*>[\s\S]*?(?:Risk Score|Severity Percentage|Risk Level)[\s\S]*?<\/ul>/gi;
            if (enhancedHtml.search(ulRegex) !== -1) {
                enhancedHtml = enhancedHtml.replace(ulRegex, () => meterCard);
            } else {
                enhancedHtml = enhancedHtml.replace(/(?:<p>|<h[1-6]>|<li[^>]*>).*?Risk Assessment.*?(?:<\/p>|<\/h[1-6]>|<\/li>)/i, (m) => m + '\n' + meterCard);
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
                            <img
                                src={appLogo}
                                alt="CodeBrain Logo"
                                className="h-15 w-15 object-contain rounded-xl"
                            />
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(conv.id);
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
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirmId(conv.id);
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
                            <span className="relative flex h-2 w-2 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
                            </span>
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
                            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center pb-36 overflow-y-auto max-w-4xl mx-auto w-full no-scrollbar">
                                {/* Centered Failover Badge Icon */}
                                <div className="relative mb-5 flex h-25 w-25 items-center justify-center">
                                    <img src={appLogo} alt="CodeBrain Logo" className="h-full w-full object-contain" />
                                    <span className="absolute -bottom-1 -right-1 bg-purple-600 text-white p-1 rounded-lg shadow-md">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                    </span>
                                </div>

                                {/* Main Title & Description */}
                                <h3 className="mb-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                                    Code Failover &amp; Vulnerability Analysis
                                </h3>
                                <p className="mb-8 text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed">
                                    This feature analyzes user-provided code segments, files, or documents for potential failing points, security vulnerabilities, high-traffic concurrency bottlenecks, and edge-case exceptions before deployment.
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
                            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center pb-36">
                                {/* Centered Logo Badge */}
                                <div className="mb-6 flex h-30 w-30 items-center justify-center">
                                    <img src={appLogo} alt="CodeBrain Logo" className="h-full w-full object-contain" />
                                </div>

                                {/* Title & Subtitle */}
                                <h3 className="mb-1 text-2xl sm:text-3xl font-bold text-white tracking-tight">
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
                            className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl w-full mx-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-40"
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

                                    {msg.role === 'user' ? (
                                        <div className="flex flex-col items-end gap-1.5 max-w-[85%]">
                                            {/* Render User Attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-wrap justify-end gap-2 mb-1">
                                                    {msg.attachments.map((att, attIdx) => {
                                                        const isImg =
                                                            att.mime?.startsWith('image/') ||
                                                            att.type?.includes('image') ||
                                                            ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].some((ext) =>
                                                                att.name?.toLowerCase().endsWith('.' + ext)
                                                            );
                                                        return (
                                                            <div
                                                                key={attIdx}
                                                                className="flex items-center gap-2 rounded-xl bg-purple-950/80 border border-purple-500/40 px-3 py-2 text-xs text-purple-200 shadow-md"
                                                            >
                                                                {isImg && att.url ? (
                                                                    <div
                                                                        className="relative group cursor-pointer"
                                                                        onClick={() => setSelectedImageModal(att.url!)}
                                                                    >
                                                                        <img
                                                                            src={att.url}
                                                                            alt={att.name}
                                                                            className="h-10 w-10 object-cover rounded-lg border border-purple-400/30 transition group-hover:opacity-80"
                                                                        />
                                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-lg">
                                                                            <Eye className="h-3.5 w-3.5 text-white" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    getFileIcon(att.name, att.mime)
                                                                )}
                                                                <div className="flex flex-col max-w-[160px]">
                                                                    <span className="truncate font-semibold text-white text-xs">{att.name}</span>
                                                                    {att.size ? (
                                                                        <span className="text-[10px] text-purple-300">{formatFileSize(att.size)}</span>
                                                                    ) : null}
                                                                </div>
                                                                {att.url && !isImg && (
                                                                    <a
                                                                        href={att.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="p-1 hover:bg-purple-800/60 rounded-md text-purple-300 hover:text-white transition ml-1"
                                                                        title="View/Download Attachment"
                                                                    >
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {msg.content ? (
                                                <div className="rounded-2xl px-5 py-3.5 text-sm leading-relaxed bg-purple-600 text-white rounded-br-none whitespace-pre-wrap shadow-sm">
                                                    {msg.content}
                                                </div>
                                            ) : null}

                                            <button
                                                type="button"
                                                title={copiedPromptId === msg.id ? 'Copied!' : 'Copy prompt'}
                                                onClick={() => handleCopyUserPrompt(msg.id, msg.content)}
                                                className="p-1 text-zinc-400 hover:text-purple-300 transition cursor-pointer rounded-md hover:bg-zinc-800/60 active:scale-95"
                                            >
                                                {copiedPromptId === msg.id ? (
                                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl px-5 py-3.5 text-sm leading-relaxed bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none flex-1 max-w-none markdown-body">
                                            {msg.content.trim() === '' ? (
                                                <div className="flex items-center gap-2.5 text-zinc-400 py-0.5">
                                                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                                    <span className="text-xs font-medium text-zinc-400">Thinking...</span>
                                                </div>
                                            ) : (
                                                <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                                            )}
                                        </div>
                                    )}

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

                    {/* Bottom Chat Input Dock Wrapper */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 w-full bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent backdrop-blur-md pt-4 pb-6 px-4">
                        <div className="w-full max-w-2xl mx-auto space-y-2">
                            {/* Attached Files Previews Dock */}
                            {attachedFiles.length > 0 && (
                                <div className="flex items-center gap-2 overflow-x-auto p-2 bg-[#16161e]/95 border border-purple-500/40 rounded-xl max-h-28 no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-150">
                                    {attachedFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="relative flex items-center gap-2.5 bg-zinc-900 border border-zinc-700/70 rounded-lg px-3 py-1.5 text-xs text-zinc-200 shadow-sm flex-shrink-0 group"
                                        >
                                            {file.type.startsWith('image/') ? (
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={file.name}
                                                    className="h-7 w-7 rounded object-cover border border-zinc-700"
                                                />
                                            ) : (
                                                getFileIcon(file.name, file.type)
                                            )}
                                            <div className="flex flex-col min-w-0 max-w-[130px]">
                                                <span className="truncate font-medium text-white">{file.name}</span>
                                                <span className="text-[10px] text-zinc-400">{formatFileSize(file.size)}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachedFile(idx)}
                                                className="p-1 text-zinc-400 hover:text-red-400 rounded-md hover:bg-zinc-800 transition cursor-pointer"
                                                title="Remove file"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Input Container */}
                            <div className="relative flex items-end rounded-2xl border border-zinc-800 bg-[#16161e] px-4 py-3 shadow-xl focus-within:border-purple-500/60 focus-within:ring-1 focus-within:ring-purple-500/30 transition-all">
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
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isLoading}
                                    className="mr-3 mb-1 flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:text-purple-300 hover:bg-zinc-800/80 transition active:scale-95 cursor-pointer disabled:opacity-50 flex-shrink-0"
                                    title="Attach files (PDF, Images, Word, Excel, Text, Code, MD)"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        activeMode === 'failover'
                                            ? 'Paste code snippet or attach file to analyze failover risks...'
                                            : 'Message CodeBrain or attach files...'
                                    }
                                    disabled={isLoading}
                                    className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none pr-10 disabled:opacity-50 resize-none max-h-48 overflow-y-auto leading-relaxed py-1.5 no-scrollbar"
                                />
                                <button
                                    type="button"
                                    onClick={() => sendPrompt()}
                                    disabled={isLoading || (!inputMessage.trim() && attachedFiles.length === 0)}
                                    className={`absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                                        inputMessage.trim() || attachedFiles.length > 0
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
                            <p className="mt-2 text-center text-[11px] text-zinc-500">
                                CodeBrain can make mistakes. Always verify important info.
                            </p>
                        </div>
                    </div>
                </main>
            </div>

            {/* Image Lightbox Preview Modal */}
            {selectedImageModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150 cursor-pointer"
                    onClick={() => setSelectedImageModal(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-800 bg-[#121218] p-2 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedImageModal(null)}
                            className="absolute top-3 right-3 z-10 rounded-full bg-black/60 p-1.5 text-zinc-300 hover:text-white transition cursor-pointer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img src={selectedImageModal} alt="Preview Attachment" className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain" />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div
                        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#14141b] p-6 shadow-2xl space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex-shrink-0">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Delete Conversation</h3>
                                <p className="text-xs text-zinc-400">This action cannot be undone.</p>
                            </div>
                        </div>

                        <p className="text-sm text-zinc-300 leading-relaxed">
                            Are you sure you want to delete{' '}
                            <span className="font-semibold text-zinc-100">
                                "{conversations.find((c) => c.id === deleteConfirmId)?.title || 'this conversation'}"
                            </span>
                            ? All messages in this chat will be permanently removed.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="rounded-xl border border-zinc-700/80 bg-zinc-800/60 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
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
                                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-red-950/40 hover:bg-red-500 active:scale-95 transition cursor-pointer"
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
                <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                    <div className="flex flex-col rounded-xl border border-zinc-800 bg-[#161622]/95 backdrop-blur-md p-3.5 shadow-2xl shadow-black/80 text-zinc-100 min-w-[320px] max-w-sm space-y-2.5 overflow-hidden">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-400 flex-shrink-0">
                                    <Trash2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-zinc-100">Conversation deleted</p>
                                    <p className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                                        {pendingDelete.title}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleUndoDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/25 hover:bg-purple-500/20 hover:text-purple-300 rounded-lg transition active:scale-95 cursor-pointer flex-shrink-0"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Undo</span>
                            </button>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="w-full bg-zinc-800/80 h-1 rounded-full overflow-hidden">
                            <div
                                key={progressKey}
                                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                                style={{
                                    animation: 'shrinkProgress 3s linear forwards',
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

