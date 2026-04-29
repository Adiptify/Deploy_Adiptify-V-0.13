import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';

const ACCENT_GRADIENTS = {
    emerald: 'from-emerald-500 to-teal-500',
    violet: 'from-violet-500 to-purple-600',
    sky: 'from-sky-500 to-blue-600',
    amber: 'from-amber-500 to-yellow-600',
    blue: 'from-blue-500 to-indigo-600',
    yellow: 'from-yellow-500 to-amber-600',
    indigo: 'from-indigo-500 to-purple-600',
    rose: 'from-rose-500 to-pink-600',
    teal: 'from-teal-500 to-cyan-600',
};

export default function SubjectCard({ subject, onClick, isActive }) {
    const accentGradient = ACCENT_GRADIENTS[subject.color] || ACCENT_GRADIENTS.emerald;

    return (
        <div
            onClick={onClick}
            className={`
                group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border
                ${isActive
                    ? 'bg-white dark:bg-slate-800 shadow-xl ring-2 ring-adiptify-gold/50 scale-[1.01] border-adiptify-gold/20'
                    : 'bg-white dark:bg-slate-800 shadow-md hover:shadow-xl hover:-translate-y-1 border-slate-100 dark:border-slate-700'
                }
            `}
        >
            {/* Top accent bar */}
            <div className={`h-1.5 bg-gradient-to-r ${accentGradient}`} />

            <div className="p-6">
                <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-lg font-bold tracking-tight text-adiptify-navy dark:text-white group-hover:text-adiptify-terracotta dark:group-hover:text-adiptify-gold transition-colors truncate">
                            {subject.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {subject.studiedCount > 0
                                ? `${subject.studiedCount} of ${subject.totalConcepts} concepts studied`
                                : subject.totalConcepts > 0
                                    ? `${subject.totalConcepts} concepts available`
                                    : 'Generate modules to start'
                            }
                        </p>
                    </div>
                    <div className={`relative w-14 h-14 flex-shrink-0`}>
                        {/* Mastery ring */}
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" className="stroke-slate-100 dark:stroke-slate-700" />
                            <circle
                                cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" strokeLinecap="round"
                                className={`transition-all duration-700`}
                                style={{
                                    stroke: subject.mastery >= 70 ? '#94A378' : subject.mastery >= 40 ? '#E5BA41' : '#D1855C',
                                    strokeDasharray: `${subject.mastery}, 100`
                                }}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-adiptify-navy dark:text-white">
                            {subject.mastery}
                        </span>
                    </div>
                </div>

                {/* Mini progress bars */}
                <div className="space-y-1.5 mb-5">
                    {[
                        { label: 'Coverage', value: subject.modules?.interest || 0, color: 'bg-blue-500' },
                        { label: 'Mastery', value: subject.modules?.research || 0, color: 'bg-adiptify-gold' },
                        { label: 'Practice', value: subject.modules?.practice || 0, color: 'bg-emerald-500' },
                        { label: 'Completed', value: subject.modules?.goals || 0, color: 'bg-purple-500' },
                    ].map(bar => (
                        <div key={bar.label} className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-400 dark:text-slate-500 w-14 text-right font-medium">{bar.label}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                                    style={{ width: `${bar.value}%` }}
                                />
                            </div>
                            <span className="text-[8px] text-slate-500 dark:text-slate-400 w-7 font-bold tabular-nums">{bar.value}%</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="min-w-0">
                        <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                            {subject.mastery > 0 ? 'Focus Area' : 'Status'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]">
                            {subject.weakestModule}
                        </p>
                    </div>

                    <div className={`flex items-center gap-1 text-xs font-semibold transition-all
                        ${isActive ? 'text-adiptify-gold' : 'text-slate-400 group-hover:text-adiptify-gold'}
                    `}>
                        <Sparkles size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span>Details</span>
                        <ChevronRight size={14} className={`transition-transform ${isActive ? 'translate-x-0.5' : 'group-hover:translate-x-0.5'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
