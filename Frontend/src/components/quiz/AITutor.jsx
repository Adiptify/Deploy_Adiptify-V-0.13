import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuiz } from '../../context/QuizContext';
import { Bot, X, Send, Loader2, Network, Brain, ChevronDown, ChevronRight, StopCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';

const API_BASE = 'http://localhost:4000';

// Simple inline markdown for chat bubbles
function renderInline(text) {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
        // Code block fence — skip
        if (line.trim().startsWith('```')) return null;
        // Bold
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        const rendered = parts.map((p, j) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
            if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="bg-slate-100 dark:bg-slate-600 px-1 rounded text-[11px] font-mono text-pink-600 dark:text-pink-300">{p.slice(1, -1)}</code>;
            return p;
        });
        return <React.Fragment key={i}>{rendered}{i < lines.length - 1 && <br />}</React.Fragment>;
    });
}

const AITutor = () => {
    const { user, ollamaStatus, ollamaModel } = useQuiz();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([
        { sender: 'ai', content: 'Hello! I\'m your AI Study Tutor. Ask me anything!' }
    ]);
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef(null);
    const abortRef = useRef(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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

        // Create session if needed
        if (!sessionId) {
            try {
                const session = await apiFetch('/api/chat/sessions', {
                    method: 'POST',
                    body: { title: input.substring(0, 30) }
                });
                sessionId = session._id;
                setActiveSessionId(sessionId);
            } catch (err) {
                console.error("Failed to create session", err);
                setMessages(prev => [...prev, { sender: 'ai', content: '⚠️ Could not create chat session. Is the backend running?' }]);
                return;
            }
        }

        const userMessage = { sender: 'user', content: input };
        const aiPlaceholder = { sender: 'ai', content: '', thinking: '', isStreaming: true };

        setMessages(prev => [...prev, userMessage, aiPlaceholder]);
        setInput('');
        setIsStreaming(true);

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

            if (!response.ok) throw new Error(`Server: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accThinking = '';
            let accContent = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;

                    try {
                        const event = JSON.parse(payload);
                        if (event.error) throw new Error(event.error);
                        if (event.thinking) accThinking += event.thinking;
                        if (event.content) accContent += event.content;

                        setMessages(prev => {
                            const updated = [...prev];
                            const last = updated.length - 1;
                            if (last >= 0 && updated[last].isStreaming) {
                                updated[last] = { ...updated[last], thinking: accThinking, content: accContent };
                            }
                            return updated;
                        });
                        scrollToBottom();
                    } catch { /* skip parse errors */ }
                }
            }

            // Finalize
            setMessages(prev => {
                const updated = [...prev];
                const last = updated.length - 1;
                if (last >= 0 && updated[last].isStreaming) {
                    updated[last] = { ...updated[last], isStreaming: false, content: accContent || 'No response.' };
                }
                return updated;
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated.length - 1;
                    if (last >= 0 && updated[last].isStreaming) {
                        updated[last] = { ...updated[last], isStreaming: false, content: updated[last].content || '⏹ Stopped.' };
                    }
                    return updated;
                });
            } else {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated.length - 1;
                    if (last >= 0 && updated[last].isStreaming) {
                        updated[last] = { sender: 'ai', content: `⚠️ ${err.message}`, isStreaming: false };
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
        <>
            {/* Floating Button */}
            {!isOpen && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    className="fixed bottom-5 right-5 z-50"
                >
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-14 h-14 rounded-full bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 shadow-xl hover:shadow-2xl flex items-center justify-center transition-all relative"
                    >
                        <Bot size={24} />
                        {/* Status dot */}
                        <span className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${ollamaStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </button>
                </motion.div>
            )}

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        className="fixed bottom-5 right-5 z-[60] w-[380px] max-w-[92vw]"
                    >
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[520px]">
                            {/* Header */}
                            <div className="bg-adiptify-navy dark:bg-slate-900 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                        <Bot size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold leading-tight">AI Study Tutor</p>
                                        <p className="text-[10px] text-white/50 flex items-center gap-1">
                                            <Sparkles size={8} />
                                            {ollamaStatus === 'connected' ? `${ollamaModel} · Streaming` : 'Offline'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        handleStop();
                                    }}
                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                                {messages.map((m, i) => (
                                    <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className="max-w-[88%]">
                                            {/* Thinking indicator */}
                                            {m.sender === 'ai' && m.thinking && (
                                                <div className="mb-1 flex items-center gap-1 text-[10px] text-purple-500 dark:text-purple-400">
                                                    {m.isStreaming && !m.content ? (
                                                        <Loader2 size={10} className="animate-spin" />
                                                    ) : (
                                                        <Brain size={10} />
                                                    )}
                                                    <span className="italic truncate max-w-[180px]">
                                                        {m.isStreaming && !m.content ? 'Thinking...' : 'Reasoned through this'}
                                                    </span>
                                                </div>
                                            )}

                                            <div className={`px-3 py-2 text-[13px] leading-relaxed ${m.sender === 'user'
                                                ? 'bg-adiptify-navy text-white rounded-2xl rounded-br-sm'
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-bl-sm shadow-sm border border-slate-100 dark:border-slate-700'
                                            }`}>
                                                {m.sender === 'ai' ? (
                                                    m.content ? renderInline(m.content) : (
                                                        m.isStreaming ? (
                                                            <div className="flex items-center gap-2">
                                                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                                                <span className="text-xs text-slate-400">{m.thinking ? 'Thinking...' : 'Connecting...'}</span>
                                                            </div>
                                                        ) : null
                                                    )
                                                ) : m.content}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2 flex-shrink-0">
                                <input
                                    type="text"
                                    placeholder="Ask a question..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    disabled={isStreaming}
                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 focus:border-adiptify-gold transition-all disabled:opacity-50 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                                {isStreaming ? (
                                    <button
                                        type="button"
                                        onClick={handleStop}
                                        className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all"
                                    >
                                        <StopCircle size={16} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="w-9 h-9 rounded-xl bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 flex items-center justify-center hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all disabled:opacity-40"
                                    >
                                        <Send size={16} />
                                    </button>
                                )}
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AITutor;
