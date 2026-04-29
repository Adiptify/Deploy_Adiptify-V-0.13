import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdaptify } from '../context/AdaptifyContext';
import { BookOpen, Clock, TrendingUp, Filter, ChevronRight, Zap, Brain, BarChart3, Sparkles, Loader2, AlertCircle } from 'lucide-react';

const CATEGORY_COLORS_LIST = [
    { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', ring: 'stroke-blue-500' },
    { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', ring: 'stroke-purple-500' },
    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', ring: 'stroke-emerald-500' },
    { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', ring: 'stroke-amber-500' },
    { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', ring: 'stroke-rose-500' },
    { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', ring: 'stroke-cyan-500' },
    { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', ring: 'stroke-indigo-500' },
    { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', ring: 'stroke-teal-500' },
];

function getCategoryColors(category, index) {
    return CATEGORY_COLORS_LIST[index % CATEGORY_COLORS_LIST.length];
}

const DIFFICULTY_LABELS = ['', 'Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'];
const DIFFICULTY_COLORS = ['', 'text-emerald-500', 'text-sky-500', 'text-amber-500', 'text-orange-500', 'text-red-500'];

function MasteryRing({ value, size = 48, stroke = 4, color = 'stroke-adiptify-gold' }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = circumference - (value / 100) * circumference;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200 dark:text-slate-700" />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={progress} className={color} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">{value}%</span>
        </div>
    );
}

function ConceptCard({ concept, progress, onClick, colorIndex }) {
    const colors = getCategoryColors(concept.category, colorIndex);
    const mastery = Math.round((progress?.mastery_score || 0) * 100);
    const stage = progress?.pipeline_stage || 0;
    const stages = ['Learn', 'Demo', 'Practice', 'Apply', 'Evaluate'];

    return (
        <button onClick={onClick} className={`group relative w-full text-left p-5 rounded-2xl border ${colors.border} bg-white dark:bg-slate-800 hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-slate-900/60 hover:-translate-y-0.5 transition-all duration-300`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text} mb-2`}>{concept.category}</span>
                    <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">{concept.title}</h3>
                </div>
                <MasteryRing value={mastery} color={colors.ring} />
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{concept.description}</p>

            {/* Difficulty badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-semibold ${DIFFICULTY_COLORS[concept.difficulty_level]}`}>
                    ◆ {DIFFICULTY_LABELS[concept.difficulty_level]}
                </span>
                {concept.prerequisites?.length > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{concept.prerequisites.length} prereq{concept.prerequisites.length > 1 ? 's' : ''}</span>
                )}
            </div>

            {/* Pipeline progress bar */}
            <div className="flex gap-1 mb-4">
                {stages.map((s, i) => (
                    <div key={s} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className={`w-full h-1.5 rounded-full transition-colors ${i <= stage ? 'bg-adiptify-gold' : 'bg-slate-100 dark:bg-slate-700'}`} />
                        <span className="text-[8px] text-slate-400 dark:text-slate-500">{s}</span>
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 relative z-10" onClick={e => e.stopPropagation()}>
                <button
                    onClick={(e) => { e.preventDefault(); /* Logic to start quiz */ }}
                    className="flex-1 px-3 py-2 bg-adiptify-gold text-adiptify-navy font-semibold text-xs rounded-xl hover:bg-adiptify-gold/90 transition-all active:scale-[0.98]"
                >
                    Start Quiz
                </button>
                <button
                    onClick={(e) => { e.preventDefault(); /* Logic to mark complete */ }}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-[0.98]"
                >
                    Mark Complete
                </button>
            </div>

            <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-hover:text-adiptify-gold group-hover:translate-x-1 transition-all" />
        </button>
    );
}

// Empty state when no enrolled subjects
function NoSubjectsState() {
    const navigate = useNavigate();
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-500/10 flex items-center justify-center mb-6">
                <AlertCircle size={36} className="text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No Subjects Enrolled</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                Enroll in subjects from the Subject Explorer to unlock AI-powered study modules, spaced review, and analytics.
            </p>
            <button
                onClick={() => navigate('/catalog')}
                className="px-6 py-2.5 rounded-xl bg-adiptify-navy dark:bg-slate-700 text-white font-medium text-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
                Browse Subjects
            </button>
        </div>
    );
}

// Empty state when enrolled but no concepts generated yet
function GenerateModulesState({ onGenerate, generating, generateStatus }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-500/20 dark:to-blue-500/10 flex items-center justify-center mb-6">
                <Sparkles size={36} className="text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {generating ? 'Generating Study Modules...' : 'Ready to Generate Study Modules'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
                {generating
                    ? generateStatus || 'AI is creating personalized study concepts from your enrolled subjects. This may take a minute...'
                    : 'Your enrolled subjects have topics ready. Click below to let AI generate 8 study concepts per topic with explanations, practice questions, and application tasks.'}
            </p>
            {generating ? (
                <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/40 dark:border-purple-500/20">
                    <Loader2 size={20} className="text-purple-500 animate-spin" />
                    <span className="text-sm text-purple-700 dark:text-purple-400 font-medium">{generateStatus || 'Generating...'}</span>
                </div>
            ) : (
                <button
                    onClick={onGenerate}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg shadow-purple-200 dark:shadow-purple-900/30 flex items-center gap-2"
                >
                    <Sparkles size={18} />
                    Generate AI Study Modules
                </button>
            )}
        </div>
    );
}

export default function StudyModules() {
    const { concepts, userProgress, loading, dueReviews, enrolledSubjects, generating, generateStatus, generateModules } = useAdaptify();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [studyMode, setStudyMode] = useState('quick'); // quick, exam, deep

    // Build category list from actual concepts (subjects)
    const categories = useMemo(() => {
        const cats = new Set(concepts.map(c => c.category));
        return ['all', ...Array.from(cats)];
    }, [concepts]);

    // Assign color index per category
    const categoryColorMap = useMemo(() => {
        const map = {};
        const uniqueCats = [...new Set(concepts.map(c => c.category))];
        uniqueCats.forEach((cat, i) => { map[cat] = i; });
        return map;
    }, [concepts]);

    const filtered = useMemo(() => {
        return concepts.filter(c => {
            if (filter !== 'all' && c.category !== filter) return false;
            if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [concepts, filter, search]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-3 border-adiptify-gold border-t-transparent rounded-full" />
            </div>
        );
    }

    // No enrolled subjects
    if (!enrolledSubjects || enrolledSubjects.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-adiptify-gold" size={28} />
                        Study Modules
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Master concepts through the structured learning pipeline.</p>
                </header>
                <NoSubjectsState />
            </div>
        );
    }

    // Enrolled but no concepts generated yet
    if (concepts.length === 0) {
        return (
            <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                    <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <BookOpen className="text-adiptify-gold" size={28} />
                        Study Modules
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        You're enrolled in {enrolledSubjects.length} subject{enrolledSubjects.length > 1 ? 's' : ''}. Generate AI modules to start learning.
                    </p>
                </header>
                <GenerateModulesState onGenerate={generateModules} generating={generating} generateStatus={generateStatus} />
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Header */}
            <header className="px-8 py-8 backdrop-blur-sm bg-slate-50/80 dark:bg-slate-900/80 sticky top-0 z-10 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-adiptify-navy dark:text-slate-100 tracking-tight flex items-center gap-3">
                            <BookOpen className="text-adiptify-gold" size={28} />
                            Study Modules
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Master concepts through the structured learning pipeline.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={generateModules}
                            disabled={generating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200/60 dark:border-purple-500/20 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                        >
                            {generating ? <Loader2 size={14} className="text-purple-500 animate-spin" /> : <Sparkles size={14} className="text-purple-500" />}
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                                {generating ? 'Generating...' : 'Regenerate'}
                            </span>
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
                            <Clock size={14} className="text-amber-500" />
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">{dueReviews.length} due for review</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                            <TrendingUp size={14} className="text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{concepts.length} concepts</span>
                        </div>
                    </div>
                </div>

                {/* Filters + Search */}
                <div className="flex flex-wrap items-center gap-3 mt-5">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                        <Filter size={14} className="text-slate-400" />
                        <select value={filter} onChange={e => setFilter(e.target.value)} className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent outline-none cursor-pointer">
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'all' ? 'All Subjects' : cat}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        type="text"
                        placeholder="Search concepts..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="text-xs px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-adiptify-gold/50 focus:ring-2 focus:ring-adiptify-gold/10 transition w-52"
                    />
                    
                    {/* Mode Switch */}
                    <div className="flex bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                        {['quick', 'exam', 'deep'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setStudyMode(mode)}
                                className={`px-4 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                                    studyMode === mode
                                        ? 'bg-white dark:bg-slate-700 text-adiptify-navy dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-200/40 dark:border-blue-500/20">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Brain size={20} className="text-blue-500" /></div>
                    <div>
                        <p className="text-xs text-blue-500/80 dark:text-blue-400 font-medium">Concepts Studied</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{Object.keys(userProgress).length} / {concepts.length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5 border border-amber-200/40 dark:border-amber-500/20">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Zap size={20} className="text-amber-500" /></div>
                    <div>
                        <p className="text-xs text-amber-500/80 dark:text-amber-400 font-medium">Pipeline Completions</p>
                        <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{Object.values(userProgress).filter(p => p.pipeline_completed || p.pipeline_stage >= 4).length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><BarChart3 size={20} className="text-emerald-500" /></div>
                    <div>
                        <p className="text-xs text-emerald-500/80 dark:text-emerald-400 font-medium">Avg Mastery</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                            {Object.values(userProgress).length > 0
                                ? Math.round(Object.values(userProgress).reduce((sum, p) => sum + (p.mastery_score || 0), 0) / Object.values(userProgress).length * 100)
                                : 0}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Concept Grid */}
            <div className="p-8 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtered.map(concept => (
                        <ConceptCard
                            key={concept.conceptId}
                            concept={concept}
                            progress={userProgress[concept.conceptId]}
                            colorIndex={categoryColorMap[concept.category] || 0}
                            onClick={() => navigate(`/concept/${concept.conceptId}`)}
                        />
                    ))}
                </div>
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                        <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No concepts match your filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
