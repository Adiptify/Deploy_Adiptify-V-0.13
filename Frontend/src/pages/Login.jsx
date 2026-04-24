import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useQuiz } from '../context/QuizContext';
import { loginUser, registerUser } from '../api/client';
import { LogIn, UserPlus, Sun, Moon, Eye, EyeOff, Loader2, AlertCircle, BrainCircuit, Sparkles, GraduationCap } from 'lucide-react';

const Login = () => {
    const [tab, setTab] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { resolvedTheme, toggleTheme } = useTheme();
    const { login } = useQuiz();
    const navigate = useNavigate();

    // Reset error when switching tabs
    useEffect(() => {
        setError('');
    }, [tab]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await loginUser(email.trim(), password);
            if (data && data.user) {
                login(data.user);
                navigate('/quiz-dashboard');
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (err) {
            setError(err.message || 'Connecting to server failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (!name.trim()) { setError('Name is required'); return; }
        setLoading(true);
        try {
            await registerUser({ name: name.trim(), email: email.trim(), password, studentId: studentId.trim() || undefined });
            // Auto-login after register
            const data = await loginUser(email.trim(), password);
            if (data && data.user) {
                login(data.user);
                navigate('/quiz-dashboard');
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (err) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const Orb = ({ className, delay }) => (
        <div 
            className={`absolute rounded-full mix-blend-screen filter blur-[80px] opacity-60 dark:opacity-40 animate-pulse ${className}`} 
            style={{ animationDelay: delay, animationDuration: '8s' }} 
        />
    );

    return (
        <div className="relative min-h-screen w-full overflow-y-auto bg-slate-50 dark:bg-[#0B0F19] flex transition-colors duration-500">
            {/* Background Animations */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden h-full w-full fixed">
                <Orb className="w-96 h-96 bg-indigo-400 dark:bg-indigo-600 top-[-10%] left-[-10%]" delay="0ms" />
                <Orb className="w-[40rem] h-[40rem] bg-violet-400 dark:bg-purple-900 bottom-[-20%] right-[-10%]" delay="2000ms" />
                <Orb className="w-80 h-80 bg-amber-300 dark:bg-amber-700/60 top-[20%] right-[10%]" delay="4000ms" />
                
                {/* Subtle Grid overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]"></div>
            </div>

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/40 dark:bg-slate-800/60 backdrop-blur-md border border-white/60 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shadow-lg transition-all duration-300 hover:scale-105"
                title={resolvedTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
                {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="relative z-10 flex w-full max-w-7xl mx-auto min-h-screen p-4 md:p-8 lg:p-12 gap-12 items-center justify-center">
                
                {/* Left Side: Form Container */}
                <motion.div
                    initial={{ opacity: 0, x: -40, y: 20 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="w-full max-w-md xl:max-w-lg shrink-0 my-auto py-8"
                >
                    <div className="relative bg-white/80 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-slate-700/50 rounded-[2.5rem] shadow-2xl p-8 sm:p-12 overflow-hidden">
                        
                        {/* Decorative top gradient border */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

                        {/* Logo & Header */}
                        <div className="mb-10 text-center relative z-10">
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, duration: 0.5, type: "spring", bounce: 0.5 }}
                                className="inline-flex items-center justify-center w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-indigo-600 to-purple-600 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] mb-6 text-white relative group"
                            >
                                <div className="absolute inset-0 bg-white/20 rounded-[1.5rem] filter blur-md group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100 duration-500"></div>
                                <BrainCircuit size={40} className="relative z-10" />
                            </motion.div>
                            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 tracking-tight mb-2">
                                Adiptify
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Your localized learning universe</p>
                        </div>

                        {/* Animated Tabs */}
                        <div className="relative flex p-1.5 mb-8 bg-slate-200/50 dark:bg-slate-800/80 rounded-2xl backdrop-blur-md z-10 w-full overflow-hidden">
                            <motion.div
                                className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white dark:bg-slate-700/80 rounded-xl shadow-sm"
                                animate={{ x: tab === 'login' ? 0 : '100%' }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                            {['login', 'register'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`relative z-10 flex-1 py-3 text-sm font-bold transition-all duration-300 ${
                                        tab === t 
                                            ? 'text-indigo-600 dark:text-white' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                >
                                    {t === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            ))}
                        </div>

                        {/* Error Message */}
                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -10, height: 0 }}
                                    className="mb-6 overflow-hidden"
                                >
                                    <div className="p-4 bg-red-50/90 dark:bg-red-900/30 border border-red-200/80 dark:border-red-800/50 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
                                        <AlertCircle size={18} className="text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 leading-relaxed shadow-sm">{error}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Forms wrapper */}
                        <div className="relative z-10">
                            <AnimatePresence mode="wait">
                                <motion.form
                                    key={tab}
                                    initial={{ opacity: 0, x: tab === 'login' ? -20 : 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: tab === 'login' ? 20 : -20 }}
                                    transition={{ duration: 0.3 }}
                                    onSubmit={tab === 'login' ? handleLogin : handleRegister} 
                                    className="space-y-5"
                                >
                                    {tab === 'register' && (
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="John Doe"
                                                required
                                                className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@university.edu"
                                            required
                                            className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                        />
                                    </div>

                                    {tab === 'register' && (
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                                Student ID <span className="text-slate-400 font-normal ml-1">Optional</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={studentId}
                                                onChange={(e) => setStudentId(e.target.value)}
                                                placeholder="e.g. 23BAI70412"
                                                className="w-full px-5 py-3.5 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                                            {tab === 'login' && (
                                                <a href="#" className="flex-shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                                                    Forgot?
                                                </a>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={tab === 'register' ? "Minimum 6 characters" : "••••••••"}
                                                required
                                                minLength={tab === 'register' ? 6 : undefined}
                                                className="w-full px-5 py-3.5 pr-14 rounded-2xl border border-white/60 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-all text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium backdrop-blur-md shadow-inner hover:bg-white/90 dark:hover:bg-slate-700/80"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)} 
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1.5 rounded-lg transition-colors focus:outline-none"
                                            >
                                                {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="relative w-full overflow-hidden group mt-10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl py-4 font-extrabold text-[15px] transition-all shadow-[0_8px_25px_-8px_rgba(79,70,229,0.6)] active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
                                    >
                                        <div className="absolute inset-0 w-full h-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        {loading ? (
                                            <Loader2 size={20} className="animate-spin relative z-10" />
                                        ) : (
                                            tab === 'login' ? <LogIn size={20} className="relative z-10" strokeWidth={2.5} /> : <UserPlus size={20} className="relative z-10" strokeWidth={2.5} />
                                        )}
                                        <span className="relative z-10 tracking-wide uppercase">
                                            {loading 
                                                ? (tab === 'login' ? 'Authenticating...' : 'Creating Account...') 
                                                : (tab === 'login' ? 'Sign In to Dashboard' : 'Get Started Now')}
                                        </span>
                                    </button>
                                </motion.form>
                            </AnimatePresence>
                        </div>
                    </div>
                    
                    {/* Tiny footer under form */}
                    <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-8 drop-shadow-sm">
                        By continuing, you agree to Adiptify's <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Terms of Service</a> & <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</a>
                    </p>
                </motion.div>

                {/* Right Side: Animated Hero (Hidden on smaller screens) */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    className="hidden lg:flex flex-col justify-center flex-1 h-[85vh] rounded-[3rem] p-12 relative overflow-hidden my-auto"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-amber-500/10 backdrop-blur-3xl border border-white/30 dark:border-white/10 rounded-[4rem] shadow-2xl"></div>
                    
                    {/* Hero Content Elements */}
                    <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
                        <motion.div
                            animate={{ y: [0, -20, 0] }}
                            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                            className="bg-white/80 dark:bg-slate-800/80 p-8 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] mb-12 border border-white/50 dark:border-slate-700/50 backdrop-blur-md relative"
                        >
                            <div className="absolute -top-5 -right-5 bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900 p-3 rounded-2xl rotate-12 shadow-xl border border-white/30">
                                <Sparkles size={24} strokeWidth={2.5} />
                            </div>
                            <GraduationCap size={90} strokeWidth={1.5} className="text-indigo-600 dark:text-indigo-400" />
                        </motion.div>

                        <h2 className="text-5xl xl:text-6xl font-extrabold text-slate-800 dark:text-white leading-[1.1] mb-8 tracking-tight">
                            Master any subject with <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500 dark:from-indigo-400 dark:to-purple-400">Intelligent Adaptation</span>
                        </h2>
                        
                        <p className="text-lg xl:text-xl text-slate-600 dark:text-slate-300 max-w-lg mb-14 leading-relaxed font-medium">
                            Adiptify creates custom learning paths, interactive quizzes, and spaced repetition schedules based on your precise knowledge gaps.
                        </p>

                        <div className="flex items-center gap-5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 py-3.5 px-8 rounded-full shadow-lg backdrop-blur-xl border border-white/50 dark:border-slate-700/50">
                            <span className="flex items-center gap-2.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                                AI Models Active
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            <span>Spaced Repetition</span>
                        </div>
                    </div>
                    
                    {/* Decorative abstract orbital rings */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 50, ease: "linear" }}
                        className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] border-2 border-indigo-500/10 dark:border-indigo-400/10 rounded-full border-dashed"
                    />
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ repeat: Infinity, duration: 70, ease: "linear" }}
                        className="absolute -top-32 -right-32 w-[40rem] h-[40rem] border border-amber-500/10 dark:border-amber-400/10 rounded-full"
                    />
                </motion.div>
            </div>
        </div>
    );
};

export default Login;

