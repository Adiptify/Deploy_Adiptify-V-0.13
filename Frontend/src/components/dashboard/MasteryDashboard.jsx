import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SubjectCard from './SubjectCard';
import DeepDivePanel from './DeepDivePanel';
import LearningRoom from '../chat/LearningRoom';
import { Loader2, BookOpen, Play, Clock, HelpCircle, Trophy, Sparkles, Brain, BarChart3, Zap, GraduationCap, ArrowRight, TrendingUp, Library } from 'lucide-react';
import { useQuiz } from '../../context/QuizContext';
import { useAdaptify } from '../../context/AdaptifyContext';
import { apiFetch } from '../../api/client';

const subjectColors = [
    'from-adiptify-navy to-blue-800',
    'from-adiptify-olive to-green-700',
    'from-adiptify-terracotta to-orange-700',
    'from-adiptify-gold to-yellow-600',
    'from-indigo-600 to-purple-700',
    'from-rose-600 to-red-700',
    'from-teal-600 to-cyan-700',
];

// Color mapping from subject color names to the format SubjectCard expects
const COLOR_REMAP = {
    emerald: 'emerald',
    purple: 'violet',
    sky: 'sky',
    amber: 'amber',
    blue: 'blue',
    yellow: 'yellow',
    indigo: 'indigo',
    rose: 'rose',
    teal: 'teal',
};

export default function MasteryDashboard() {
    const navigate = useNavigate();
    const { user, leaderboard, quizzes } = useQuiz();
    const {
        enrolledSubjects,
        concepts,
        userProgress,
        analytics,
        dueReviews,
        loading: adaptifyLoading,
    } = useAdaptify();

    const [dailyPlan, setDailyPlan] = useState(null);
    const [planLoading, setPlanLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: 'Generate your plan to start studying.', type: 'neutral' });

    // Fetch daily plan
    const fetchPlan = async () => {
        setPlanLoading(true);
        try {
            const plan = await apiFetch('/api/plan/generate', {
                method: 'POST',
                body: { goal: 'daily_study' }
            });
            setDailyPlan(plan.daily_plan);
            setStatusMessage({ text: plan.message || 'Ready to learn', type: plan.status || 'on_track' });
        } catch (error) {
            console.error('Failed to generate plan', error);
            setStatusMessage({ text: 'Failed to load plan', type: 'error' });
        } finally {
            setPlanLoading(false);
        }
    };
    
    // Auto-fetch if subjects exist
    React.useEffect(() => {
        if (enrolledSubjects && enrolledSubjects.length > 0 && !dailyPlan && !planLoading) {
            fetchPlan();
        }
    }, [enrolledSubjects]);

    // ─── Compute real mastery data from AdaptifyContext ───
    const subjectsWithMastery = useMemo(() => {
        if (!enrolledSubjects || enrolledSubjects.length === 0) return [];

        return enrolledSubjects.map(subject => {
            const subjectName = subject.name || subject.title;
            // Find concepts belonging to this subject
            const subjectConcepts = concepts.filter(c => c.category === subjectName);
            
            // Calculate real mastery from user progress
            let mastery = 0;
            let studiedCount = 0;
            if (subjectConcepts.length > 0) {
                const scores = subjectConcepts.map(c => {
                    const prog = userProgress[c.conceptId];
                    if (prog && prog.mastery_score > 0) {
                        studiedCount++;
                        return prog.mastery_score;
                    }
                    return 0;
                });
                mastery = Math.round(
                    (scores.reduce((s, v) => s + v, 0) / subjectConcepts.length) * 100
                );
            }

            return {
                id: subject._id || subject.slug,
                title: subjectName,
                mastery,
                totalConcepts: subjectConcepts.length,
                studiedCount,
                trend: mastery > 0 ? `+${mastery}%` : '—',
                modules: {
                    interest: studiedCount > 0 ? Math.round((studiedCount / Math.max(subjectConcepts.length, 1)) * 100) : 0,
                    research: mastery,
                    practice: Math.round(subjectConcepts.filter(c => {
                        const p = userProgress[c.conceptId];
                        return p && p.pipeline_stage >= 2;
                    }).length / Math.max(subjectConcepts.length, 1) * 100),
                    goals: Math.round(subjectConcepts.filter(c => {
                        const p = userProgress[c.conceptId];
                        return p && p.pipeline_completed;
                    }).length / Math.max(subjectConcepts.length, 1) * 100),
                },
                weakestModule: subjectConcepts.length > 0
                    ? (subjectConcepts.reduce((worst, c) => {
                        const p = userProgress[c.conceptId];
                        const score = p?.mastery_score || 0;
                        return score < (worst.score || Infinity) ? { title: c.title, score } : worst;
                    }, { score: Infinity }).title || 'General')
                    : 'No concepts yet',
                color: COLOR_REMAP[subject.color] || 'emerald',
                icon: subject.icon,
                isEnrolled: true,
                topicCount: subject.topics?.length || 0,
            };
        });
    }, [enrolledSubjects, concepts, userProgress]);

    // ─── Leaderboard stats ───
    const userStats = leaderboard.filter(entry => entry.name === user?.name);
    const bestScore = userStats.length > 0 ? Math.max(...userStats.map(s => s.score)) : 0;
    const attempts = userStats.length;

    // ─── Overall mastery (real) ───
    const overallMastery = subjectsWithMastery.length > 0
        ? Math.round(subjectsWithMastery.reduce((sum, s) => sum + s.mastery, 0) / subjectsWithMastery.length)
        : 0;

    // ─── Quick stats from analytics ───
    const totalConceptsStudied = Object.keys(userProgress).length;
    const totalConceptsAvailable = concepts.length;
    const dueCount = dueReviews?.length || 0;

    const [selectedSubject, setSelectedSubject] = useState(null);
    const [isLearningRoomOpen, setIsLearningRoomOpen] = useState(false);

    const loading = adaptifyLoading;

    return (
        <div className="flex-1 h-full flex flex-col overflow-y-auto relative bg-slate-50/50 dark:bg-slate-900/50">

            {/* ─── Hero Header ─── */}
            <header className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-adiptify-navy via-[#1e2d45] to-[#162236]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(229,186,65,0.08),transparent_70%)]" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-adiptify-gold/30 to-transparent" />

                <div className="relative px-8 py-8 md:py-10 flex justify-between items-end">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <p className="text-adiptify-gold/70 text-sm font-medium mb-1">
                            {new Date().getHours() < 12 ? '☀️ Good morning' : new Date().getHours() < 17 ? '🌤️ Good afternoon' : '🌙 Good evening'}{user ? `, ${user.name}` : ''}
                        </p>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Mastery Dashboard</h2>
                        <p className="text-slate-300/60 mt-1 text-sm">Track your adaptive learning progress across all subjects.</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring' }}
                        className="hidden sm:flex items-center gap-5"
                    >
                        {/* Due badge */}
                        {dueCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-300 text-xs font-medium animate-pulseGlow">
                                <Clock size={13} /> {dueCount} reviews due
                            </div>
                        )}
                        {/* Mastery ring */}
                        <div className="text-right mr-1">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Overall Mastery</p>
                            <p className="text-2xl font-bold text-adiptify-gold">{overallMastery}%</p>
                        </div>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center relative">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <path
                                    className="text-white/10"
                                    strokeWidth="3"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className="text-adiptify-gold drop-shadow-sm"
                                    strokeDasharray={`${overallMastery}, 100`}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                />
                            </svg>
                            <Zap size={14} className="absolute text-adiptify-gold/40" />
                        </div>
                    </motion.div>
                </div>
            </header>

            <div className="p-8 flex-1 space-y-8">
                {/* ─── Command Center (Today's Mission) ─── */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    className="relative rounded-2xl bg-gradient-to-r from-adiptify-navy via-slate-800 to-slate-900 p-[1px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-adiptify-gold/20 via-transparent to-transparent opacity-50 animate-pulse" />
                    
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-8 z-10">
                        {/* LEFT: Context */}
                        <div className="flex-1 w-full text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <Sparkles className="text-adiptify-gold w-6 h-6" />
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Today's Mission</h2>
                                <span className="ml-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                                    {planLoading ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span> Analyzing...</>
                                    ) : dailyPlan ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Plan Ready</>
                                    ) : (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Standing By</>
                                    )}
                                </span>
                            </div>
                            
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-6">
                                {statusMessage.text || "You are slightly behind. Start with the easiest topic."}
                            </p>
                            
                            {dailyPlan ? (
                                <div className="flex flex-wrap gap-3">
                                    {dailyPlan.topics_to_study?.[0] && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Study: {dailyPlan.topics_to_study[0].split('(')[0]}</span>
                                        </div>
                                    )}
                                    {dailyPlan.revision_topics?.[0] && (
                                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Review: {dailyPlan.revision_topics[0].split('(')[0]}</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-slate-500 text-sm italic">Click generate to build your optimal path today.</div>
                            )}
                        </div>

                        {/* RIGHT: Action & Progress */}
                        <div className="flex flex-col md:flex-row items-center gap-8 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
                            <div className="flex flex-col items-center">
                                <div className="relative w-24 h-24 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                                        <path className="text-slate-100 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path className="text-adiptify-gold drop-shadow-[0_0_6px_rgba(255,215,0,0.5)]" strokeDasharray={`${overallMastery}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ transition: 'stroke-dasharray 1.5s ease-out' }} />
                                    </svg>
                                    <div className="absolute flex flex-col items-center justify-center">
                                        <span className="text-xl font-bold text-slate-800 dark:text-white">{overallMastery}%</span>
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-2">Daily Completion</span>
                            </div>
                            
                            <button
                                onClick={planLoading ? undefined : (dailyPlan ? () => navigate('/modules') : fetchPlan)}
                                className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 p-[1px] shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                            >
                                <div className="relative bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3.5 rounded-xl flex items-center justify-center gap-2">
                                    <span className="text-white font-bold text-sm tracking-wide">
                                        {planLoading ? "Generating..." : dailyPlan ? "Start Mission" : "Generate Plan"}
                                    </span>
                                    {!planLoading && <ArrowRight size={16} className="text-white group-hover:translate-x-1 transition-transform" />}
                                </div>
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* ─── Quick Stats Row ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-200/40 dark:border-blue-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><GraduationCap size={20} className="text-blue-500" /></div>
                        <div>
                            <p className="text-xs text-blue-500/80 dark:text-blue-400 font-medium">Subjects Enrolled</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{enrolledSubjects?.length || 0}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/10 dark:to-purple-500/5 border border-purple-200/40 dark:border-purple-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><Brain size={20} className="text-purple-500" /></div>
                        <div>
                            <p className="text-xs text-purple-500/80 dark:text-purple-400 font-medium">Concepts Studied</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{totalConceptsStudied} / {totalConceptsAvailable}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5 border border-amber-200/40 dark:border-amber-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock size={20} className="text-amber-500" /></div>
                        <div>
                            <p className="text-xs text-amber-500/80 dark:text-amber-400 font-medium">Due for Review</p>
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{dueCount}</p>
                        </div>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20"
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Trophy size={20} className="text-emerald-500" /></div>
                        <div>
                            <p className="text-xs text-emerald-500/80 dark:text-emerald-400 font-medium">Best Quiz Score</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{bestScore}%</p>
                        </div>
                    </motion.div>
                </div>

                {/* ─── Subject Cards ─── */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-adiptify-gold" />
                    </div>
                ) : subjectsWithMastery.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/20 dark:shadow-none"
                    >
                        <motion.div 
                            animate={{ y: [0, -10, 0] }} 
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-24 h-24 mx-auto mb-8 relative"
                        >
                            <div className="absolute inset-0 bg-adiptify-gold/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative bg-gradient-to-br from-adiptify-gold to-orange-500 w-full h-full rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-white/10">
                                <Sparkles className="w-10 h-10 text-white drop-shadow-md" />
                            </div>
                        </motion.div>
                        
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-3">Welcome to Adiptify</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-10 max-w-lg mx-auto font-medium">
                            Your intelligent learning journey begins here. Complete these 3 steps to start mastering any subject:
                        </p>
                        
                        <div className="flex flex-col md:flex-row justify-center gap-6 max-w-4xl mx-auto mb-12 text-left px-6">
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-4">1</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Add Subject</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Enroll in a subject from the catalog to build your knowledge graph.</p>
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-4">2</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Generate Plan</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Our AI builds your daily mission based on your progress.</p>
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-400 opacity-80" />
                                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-4">3</div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Start Learning</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Master concepts via active recall and verify with quizzes.</p>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate('/catalog')}
                            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-lg rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all active:scale-[0.98] hover:-translate-y-1"
                        >
                            <Library size={22} className="group-hover:rotate-12 transition-transform" />
                            Browse Catalog & Begin
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">Your Subjects</h3>
                            <button
                                onClick={() => navigate('/catalog')}
                                className="text-xs font-medium text-adiptify-gold hover:text-adiptify-gold/80 flex items-center gap-1 transition-colors"
                            >
                                Explore more <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subjectsWithMastery.map((subject, idx) => (
                                <motion.div
                                    key={subject.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.07 }}
                                >
                                    <SubjectCard
                                        subject={subject}
                                        onClick={() => setSelectedSubject(subject)}
                                        isActive={selectedSubject?.id === subject.id}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}

                {/* ─── Next Action Panel (Layer 2) ─── */}
                {subjectsWithMastery.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4">
                        <motion.button
                            onClick={() => navigate('/modules')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                    <BookOpen size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Continue Topic</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Explore {totalConceptsAvailable} concepts</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/review')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-amber-300 dark:hover:border-amber-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                                    <Brain size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Review Weak Areas</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{dueCount} cards due</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-amber-50 dark:group-hover:bg-amber-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>

                        <motion.button
                            onClick={() => navigate('/quiz-dashboard')}
                            whileHover={{ y: -4 }}
                            className="flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-600/50 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                                    <HelpCircle size={24} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-base font-bold text-slate-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Start Quiz</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Verify your mastery</p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-purple-50 dark:group-hover:bg-purple-900/50 transition-colors">
                                <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </motion.button>
                    </div>
                )}

                {/* ─── Recent Quizzes Section ─── */}
                {quizzes.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-adiptify-navy dark:text-white">Recent Quizzes</h3>
                            <button
                                onClick={() => navigate('/quiz-dashboard')}
                                className="text-xs font-medium text-adiptify-gold hover:text-adiptify-gold/80 flex items-center gap-1 transition-colors"
                            >
                                View all <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {quizzes.slice(0, 3).map((quiz, index) => (
                                <motion.div
                                    key={quiz.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.08 }}
                                    whileHover={{ y: -4 }}
                                    className="group cursor-pointer"
                                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                                >
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-slate-100 dark:border-slate-700">
                                        <div className={`h-24 bg-gradient-to-br ${subjectColors[index % subjectColors.length]} relative`}>
                                            <span className="absolute bottom-2 right-4 text-5xl font-black text-white/10">
                                                {index + 1}
                                            </span>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h4 className="text-base font-bold text-adiptify-navy dark:text-white mb-1 group-hover:text-adiptify-terracotta transition-colors">
                                                {quiz.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex-1 line-clamp-2">
                                                {quiz.description}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-adiptify-olive">
                                                    <Clock size={10} /> {quiz.duration} mins
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                                                    <HelpCircle size={10} /> {quiz.questions.length} Qs
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Slide-in Right Panel */}
            <DeepDivePanel
                subject={selectedSubject}
                onClose={() => setSelectedSubject(null)}
                onEnterLearningRoom={() => setIsLearningRoomOpen(true)}
            />

            {/* Learning Room Overlay Chat */}
            <LearningRoom
                subject={selectedSubject}
                isOpen={isLearningRoomOpen}
                onClose={() => setIsLearningRoomOpen(false)}
            />
        </div>
    );
}
