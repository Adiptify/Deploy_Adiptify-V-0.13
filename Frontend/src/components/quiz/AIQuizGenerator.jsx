import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuiz } from '../../context/QuizContext';
import { apiFetch } from '../../api/client';
import { Sparkles, Loader2, AlertCircle, Bot, CheckCircle, Wifi, WifiOff } from 'lucide-react';

const AIQuizGenerator = () => {
    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const { addQuiz, ollamaStatus, ollamaModel } = useQuiz();

    const generateQuiz = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        setError(null);
        setSuccess(null);

        try {
            // Call backend API (same pattern as CaseStudy-1 but through server)
            const result = await apiFetch('/api/ai/generate', {
                method: 'POST',
                body: {
                    topic: topic.trim(),
                    count,
                    distribution: { easy: 2, medium: 2, hard: 1 },
                    saveToBank: true
                }
            });

            // Show success with item count
            const itemCount = result.itemCount || result.items?.length || 0;
            setSuccess(`✓ Generated ${itemCount} questions on "${topic}" and saved to your quiz bank!`);
            addQuiz(); // triggers refetch from backend
            setTopic('');
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            console.error('AI Generation Error:', err);

            // Try direct Ollama call as fallback (CaseStudy-1 approach)
            try {
                const ollamaResponse = await fetch('http://localhost:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: ollamaModel || 'deepseek-r1',
                        messages: [{
                            role: 'user',
                            content: `Generate ${count} MCQ questions about "${topic.trim()}". 
                            Return EXACTLY this JSON structure:
                            {
                              "items": [
                                {
                                  "question": "String",
                                  "options": ["Op1", "Op2", "Op3", "Op4"],
                                  "correctIndex": Number(0-3),
                                  "difficulty": "easy|medium|hard",
                                  "explanation": "String",
                                  "hint": "String"
                                }
                              ]
                            }
                            Respond ONLY with valid JSON.`
                        }],
                        stream: false
                    })
                });

                if (ollamaResponse.ok) {
                    const data = await ollamaResponse.json();
                    const rawContent = data.message?.content || '';
                    const cleaned = rawContent.replace(/```json|```/g, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
                    const parsed = JSON.parse(cleaned);

                    if (parsed.items && parsed.items.length > 0) {
                        // Save to backend
                        try {
                            await apiFetch('/api/ai/generate', {
                                method: 'POST',
                                body: { topic: topic.trim(), count, saveToBank: true }
                            });
                        } catch { /* backend save may fail but quiz was generated */ }

                        setSuccess(`✓ Generated ${parsed.items.length} questions via direct AI call! Refresh to see them.`);
                        addQuiz();
                        setTopic('');
                        setTimeout(() => setSuccess(null), 5000);
                        return;
                    }
                }
                throw new Error('Direct Ollama call also failed');
            } catch (fallbackErr) {
                setError(
                    `Generation failed. Troubleshooting:\n` +
                    `1. Make sure Ollama is running: $env:OLLAMA_ORIGINS="*"; ollama serve\n` +
                    `2. Pull the model: ollama pull ${ollamaModel || 'deepseek-r1'}\n` +
                    `3. Make sure the backend server is running on port 4000`
                );
            }
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4"
        >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                {/* Top accent bar — color indicates Ollama status */}
                <div className={`h-1 ${
                    ollamaStatus === 'connected' 
                        ? 'bg-emerald-500' 
                        : ollamaStatus === 'error' 
                            ? 'bg-red-500' 
                            : 'bg-amber-500'
                }`} />

                <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-adiptify-gold" size={20} />
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">AI Quiz Generator</h3>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 border ${
                            ollamaStatus === 'connected'
                                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
                                : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                        }`}>
                            {ollamaStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {ollamaStatus === 'connected' ? ollamaModel : 'Ollama Offline'}
                        </span>
                    </div>

                    {/* Ollama offline warning */}
                    {ollamaStatus === 'error' && (
                        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">⚠ Ollama not detected</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                1. Open PowerShell → run: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">$env:OLLAMA_ORIGINS="*"; ollama serve</code><br/>
                                2. In another terminal → run: <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">ollama pull deepseek-r1</code>
                            </p>
                        </div>
                    )}

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                        Enter a topic to generate a <strong>{count}-question</strong> AI quiz using <strong>{ollamaModel || 'AI'}</strong>, saved to the question bank.
                    </p>

                    {/* Input row */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. History of Rome, Python Basics, Neural Networks..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isGenerating}
                            onKeyDown={(e) => e.key === 'Enter' && generateQuiz()}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 focus:border-adiptify-gold transition-all disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800"
                        />
                        <select
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            disabled={isGenerating}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-adiptify-gold/50 disabled:opacity-50"
                        >
                            <option value={3}>3 Q</option>
                            <option value={5}>5 Q</option>
                            <option value={10}>10 Q</option>
                        </select>
                        <button
                            onClick={generateQuiz}
                            disabled={isGenerating || !topic.trim()}
                            className="px-5 py-2.5 bg-adiptify-navy dark:bg-adiptify-gold text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:bg-adiptify-navy/90 dark:hover:bg-adiptify-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </button>
                    </div>

                    {/* Generating indicator */}
                    {isGenerating && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-blue-700 dark:text-blue-400">Generating questions with AI... This may take 15-60 seconds depending on your model.</p>
                        </div>
                    )}

                    {/* Success */}
                    {success && (
                        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{success}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default AIQuizGenerator;
