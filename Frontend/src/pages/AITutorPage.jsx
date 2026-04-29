import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Loader2, Plus, MessageSquare, Library, Network, Brain, ChevronDown, ChevronRight, Copy, Check, Sparkles, StopCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { apiFetch } from '../api/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ─── Markdown-lite renderer ────────────────────────────────
function renderMarkdown(text) {
    if (!text) return null;
    // Split into lines and process
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeLines = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Code fences
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={`code-${i}`} className="bg-slate-900 text-emerald-300 rounded-xl p-4 text-sm font-mono overflow-x-auto my-2 border border-slate-700">
                        <code>{codeLines.join('\n')}</code>
                    </pre>
                );
                codeLines = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
                codeLang = line.trim().slice(3);
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        // Headers
        if (line.startsWith('### ')) {
            elements.push(<h4 key={i} className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-3 mb-1">{processInline(line.slice(4))}</h4>);
        } else if (line.startsWith('## ')) {
            elements.push(<h3 key={i} className="text-base font-bold text-slate-800 dark:text-white mt-3 mb-1">{processInline(line.slice(3))}</h3>);
        } else if (line.startsWith('# ')) {
            elements.push(<h2 key={i} className="text-lg font-bold text-slate-900 dark:text-white mt-3 mb-1">{processInline(line.slice(2))}</h2>);
        }
        // Bullet list
        else if (line.match(/^\s*[-*]\s/)) {
            elements.push(<li key={i} className="ml-4 text-sm list-disc text-slate-700 dark:text-slate-300">{processInline(line.replace(/^\s*[-*]\s/, ''))}</li>);
        }
        // Numbered list
        else if (line.match(/^\s*\d+\.\s/)) {
            elements.push(<li key={i} className="ml-4 text-sm list-decimal text-slate-700 dark:text-slate-300">{processInline(line.replace(/^\s*\d+\.\s/, ''))}</li>);
        }
        // Empty line
        else if (line.trim() === '') {
            elements.push(<div key={i} className="h-2" />);
        }
        // Regular text
        else {
            elements.push(<p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{processInline(line)}</p>);
        }
    }

    // Flush remaining code block
    if (inCodeBlock && codeLines.length) {
        elements.push(
            <pre key="code-end" className="bg-slate-900 text-emerald-300 rounded-xl p-4 text-sm font-mono overflow-x-auto my-2 border border-slate-700">
                <code>{codeLines.join('\n')}</code>
            </pre>
        );
    }

    return elements;
}

function processInline(text) {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-slate-800 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

// ─── Thinking Collapsible ────────────────────────────────
function ThinkingBlock({ thinking, isStreaming }) {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!thinking) return null;

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
                {isStreaming ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : isExpanded ? (
                    <ChevronDown size={12} />
                ) : (
                    <ChevronRight size={12} />
                )}
                <Brain size={12} />
                {isStreaming ? 'Thinking...' : 'Show reasoning'}
            </button>
            <AnimatePresence>
                {(isExpanded || isStreaming) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-1.5 pl-3 border-l-2 border-purple-300 dark:border-purple-700 text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar italic">
                            {thinking}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Message Bubble ────────────────────────────────
function MessageBubble({ message, navigate }) {
    const [copied, setCopied] = useState(false);
    const isUser = message.sender === 'user';

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Parse <GRAPH>topic</GRAPH> links
    const parseGraphLinks = (elements) => {
        if (typeof elements === 'string') {
            const parts = elements.split(/(<GRAPH>.*?<\/GRAPH>)/s);
            return parts.map((part, i) => {
                if (part.startsWith('<GRAPH>') && part.endsWith('</GRAPH>')) {
                    const topic = part.slice(7, -8).trim();
                    return (
                        <button key={i} onClick={() => navigate('/graph', { state: { autoExpandTopic: topic } })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-adiptify-gold/10 hover:bg-adiptify-gold/20 text-adiptify-gold border border-adiptify-gold/30 rounded-lg text-xs font-semibold transition-colors mt-1">
                            <Network size={11} /> {topic}
                        </button>
                    );
                }
                return <span key={i}>{part}</span>;
            });
        }
        return elements;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
        >
                <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 flex items-center justify-center mt-1">
                    <img src="/favicon.png" alt="Adiptify" className="w-6 h-6 object-contain shadow-sm drop-shadow-sm" />
                </div>
            <div className={`max-w-[78%] relative ${!isUser ? 'group' : ''}`}>
                {/* Thinking block */}
                {!isUser && message.thinking && (
                    <ThinkingBlock thinking={message.thinking} isStreaming={message.isStreaming && !message.content} />
                )}

                {/* Content */}
                <div className={`px-4 py-3 leading-relaxed ${isUser
                    ? 'bg-adiptify-navy text-white rounded-2xl rounded-tr-sm text-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm'
                }`}>
                    {isUser ? (
                        <span className="text-sm">{message.content}</span>
                    ) : (
                        <div className="prose-compact">
                            {message.content ? renderMarkdown(message.content) : (
                                message.isStreaming && !message.thinking ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                        <span className="text-sm text-slate-400">Connecting to AI...</span>
                                    </div>
                                ) : null
                            )}
                            {parseGraphLinks('')}
                        </div>
                    )}
                </div>

                {/* Copy button for AI messages */}
                {!isUser && message.content && !message.isStreaming && (
                    <button
                        onClick={handleCopy}
                        className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        {copied ? <Check size={10} /> : <Copy size={10} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Page Component ─────────────────────────────
const AITutorPage = () => {
    const { user, ollamaStatus, ollamaModel } = useQuiz();
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const abortRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        loadSessions();
        loadSubjects();
    }, []);

    useEffect(() => {
        if (activeSessionId) {
            loadMessages(activeSessionId);
        } else {
            setMessages([{ sender: 'ai', content: 'Hello! I\'m your AI Study Tutor. Select a conversation or start typing to begin.' }]);
        }
    }, [activeSessionId]);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    const loadSubjects = async () => {
        try {
            const data = await apiFetch('/api/subjects');
            setSubjects(data);
        } catch (e) { console.error("Failed to load subjects", e); }
    };

    const loadSessions = async () => {
        try {
            const data = await apiFetch('/api/chat/sessions');
            setSessions(data);
        } catch (e) { console.error("Failed to load sessions", e); }
    };

    const loadMessages = async (sessionId) => {
        try {
            const data = await apiFetch(`/api/chat/sessions/${sessionId}/messages`);
            setMessages(data);
        } catch (e) { console.error("Failed to load messages", e); }
    };

    const handleNewSession = async () => {
        try {
            const session = await apiFetch('/api/chat/sessions', {
                method: 'POST',
                body: { subjectId: selectedSubjectId || null, title: 'New Conversation' }
            });
            setSessions([session, ...sessions]);
            setActiveSessionId(session._id);
        } catch (e) { console.error("New session failed", e); }
    };

    const handleStop = () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setIsStreaming(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        let sessionId = activeSessionId;

        // Create session if none exists
        if (!sessionId) {
            try {
                const session = await apiFetch('/api/chat/sessions', {
                    method: 'POST',
                    body: { subjectId: selectedSubjectId || null, title: input.substring(0, 30) }
                });
                setSessions(prev => [session, ...prev]);
                sessionId = session._id;
                setActiveSessionId(sessionId);
            } catch (e) {
                console.error("New session failed", e);
                return;
            }
        }

        const userMessage = { sender: 'user', content: input };
        const aiPlaceholder = { sender: 'ai', content: '', thinking: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, aiPlaceholder]);
        setInput('');
        setIsStreaming(true);

        // Build history from current messages (exclude the placeholder we just added)
        const history = messages
            .filter(m => m.content && !m.isStreaming)
            .map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.content
            }));

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const token = localStorage.getItem('adiptify_token');
            const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ message: userMessage.content }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accThinking = '';
            let accContent = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep last partial line

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    
                    const payload = trimmed.slice(6);
                    if (payload === '[DONE]') continue;

                    try {
                        const event = JSON.parse(payload);
                        if (event.error) throw new Error(event.error);

                        if (event.thinking) {
                            accThinking += event.thinking;
                        }
                        if (event.content) {
                            accContent += event.content;
                        }

                        // Update the AI placeholder in real-time
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                                updated[lastIdx] = {
                                    ...updated[lastIdx],
                                    thinking: accThinking,
                                    content: accContent,
                                };
                            }
                            return updated;
                        });
                        
                        scrollToBottom();
                    } catch (parseErr) {
                        // Sometimes chunks are fragmented across lines, wait for more data
                        console.debug('SSE parse delay:', parseErr.message);
                    }
                }
            }

            // Finalize the message — remove streaming flag
            setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                    updated[lastIdx] = {
                        ...updated[lastIdx],
                        isStreaming: false,
                        content: accContent || 'No response received.',
                    };
                }
                return updated;
            });

            // Refresh sessions list for updated title
            loadSessions();

        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false, content: updated[lastIdx].content || '⏹ Generation stopped.' };
                    }
                    return updated;
                });
            } else {
                console.error('Stream error:', err);
                setMessages(prev => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].isStreaming) {
                        updated[lastIdx] = { sender: 'ai', content: `⚠️ Error: ${err.message}\n\nMake sure Ollama is running:\n\`$env:OLLAMA_ORIGINS="*"; ollama serve\``, isStreaming: false };
                    }
                    return updated;
                });
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-slate-900">
            {/* ─── Sidebar ─── */}
            <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleNewSession}
                        className="w-full flex items-center justify-center gap-2 bg-adiptify-navy hover:bg-adiptify-navy/90 text-white py-2.5 px-4 rounded-xl transition-colors shadow-sm text-sm font-medium"
                    >
                        <Plus size={16} /> New Chat
                    </button>

                    <div className="mt-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Context Subject</label>
                        <select
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2 text-slate-700 dark:text-slate-300"
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                        >
                            <option value="">General (No Subject)</option>
                            {subjects.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-2 mt-2 mb-2">Conversations</p>
                    {sessions.map(s => (
                        <button
                            key={s._id}
                            onClick={() => setActiveSessionId(s._id)}
                            className={`w-full flex flex-col text-left px-3 py-2 rounded-xl transition-all ${activeSessionId === s._id
                                ? 'bg-adiptify-navy/5 dark:bg-slate-800 text-adiptify-navy dark:text-white border border-adiptify-navy/10 dark:border-slate-700'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                            }`}
                        >
                            <span className="text-sm font-medium truncate flex items-center gap-1.5">
                                <MessageSquare size={12} className="flex-shrink-0 opacity-50" />
                                {s.title || "New Conversation"}
                            </span>
                            {s.subjectId && (
                                <span className="text-[10px] flex items-center gap-1 mt-0.5 opacity-60 ml-5">
                                    <Library size={9} /> {s.subjectId.name}
                                </span>
                            )}
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-xs text-slate-400 text-center mt-6">No history yet</p>
                    )}
                </div>

                {/* Ollama Status */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <div className={`flex items-center gap-2 text-xs ${ollamaStatus === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${ollamaStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {ollamaStatus === 'connected' ? `${ollamaModel}` : 'Ollama Offline'}
                    </div>
                </div>
            </div>

            {/* ─── Main Chat Area ─── */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 relative min-w-0">
                {/* Header */}
                <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center">
                            <img src="/favicon.png" alt="Adiptify" className="w-8 h-8 object-contain drop-shadow-md" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800 dark:text-white leading-tight text-sm">AI Study Tutor</h2>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Sparkles size={10} className="text-adiptify-gold" />
                                {ollamaModel || 'qwen3'} · Streaming
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/graph')}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                            title="Explore in Graph"
                        >
                            <Network size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar scroll-smooth">
                    {messages.length === 0 && !activeSessionId && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                            <img src="/favicon.png" alt="Adiptify" className="w-16 h-16 object-contain mb-4 opacity-70" />
                            <p className="text-lg font-medium">How can I help you study today?</p>
                            <p className="text-sm mt-1">Start typing or select a conversation from the sidebar.</p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <MessageBubble key={i} message={m} navigate={navigate} />
                    ))}

                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-end gap-2">
                        <textarea
                            rows={1}
                            placeholder="Ask a question or request an explanation..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            disabled={isStreaming}
                            className="w-full min-h-[52px] max-h-[180px] resize-y rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white px-4 py-3.5 pr-14 focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 focus:border-adiptify-gold transition-all disabled:opacity-50 text-sm custom-scrollbar shadow-sm"
                        />
                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={handleStop}
                                className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all"
                                title="Stop generation"
                            >
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 flex items-center justify-center hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all disabled:opacity-30 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400"
                            >
                                <Send size={18} className="translate-x-[1px]" />
                            </button>
                        )}
                    </form>
                    <p className="text-center text-[10px] text-slate-400 mt-2">AI can make mistakes. Verify important information.</p>
                </div>
            </div>
        </div>
    );
};

export default AITutorPage;
