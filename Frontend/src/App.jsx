import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QuizProvider, useQuiz } from './context/QuizContext';
import { AdaptifyProvider } from './context/AdaptifyContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import MasteryDashboard from './components/dashboard/MasteryDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import QuizDashboard from './pages/QuizDashboard';
import QuizPage from './pages/Quiz';
import Result from './pages/Result';
import Leaderboard from './pages/Leaderboard';
import StudyModules from './pages/StudyModules';
import ConceptLearning from './pages/ConceptLearning';
import SpacedReview from './pages/SpacedReview';
import ExperimentLab from './pages/ExperimentLab';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import UserPreferences from './pages/UserPreferences';
import GraphExplorer from './components/graph/GraphExplorer';
import AITutorPage from './pages/AITutorPage';
import SubjectCatalog from './pages/SubjectCatalog';
import AITutor from './components/quiz/AITutor';
import {
  BookOpen, BarChart2, MessageSquare, User, Trophy, GraduationCap,
  Network, LogOut, Brain, FlaskConical, BarChart3, Sun, Moon,
  Settings, Library, ClipboardList, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';

/* ─── Page transition variants ─── */
const pageVariants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(2px)' },
};
const pageTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] };

function AnimatedPage({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="flex-1 flex flex-col h-full"
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useQuiz();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  // Derive active tab from route
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/quiz-dashboard' || path.startsWith('/quiz/') || path === '/result') return 'quiz';
    if (path === '/leaderboard') return 'leaderboard';
    if (path === '/graph') return 'graph';
    if (path === '/modules' || path.startsWith('/concept/')) return 'modules';
    if (path === '/review') return 'review';
    if (path === '/lab') return 'lab';
    if (path === '/analytics') return 'analytics';
    if (path === '/catalog') return 'catalog';
    if (path === '/tutor') return 'tutor';
    if (path === '/settings') return 'settings';
    if (path === '/login') return 'login';
    return 'dashboard';
  };

  const activeTab = getActiveTab();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Hide sidebar on login page
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      {!isLoginPage && (
        <aside
          className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-adiptify-navy dark:bg-slate-950 text-white flex flex-col shadow-xl z-20 flex-shrink-0 transition-all duration-300 relative`}
        >
          {/* Logo */}
          <div className={`${collapsed ? 'p-3' : 'p-6'} flex items-center justify-center min-h-[80px]`}>
            {collapsed ? (
              <img
                src="/favicon.png"
                alt="A"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
              />
            ) : (
              <img
                src={resolvedTheme === 'dark' ? '/logos/logo-dark-premium.png' : '/logos/logo-dark-gold.png'}
                alt="Adiptify"
                className="w-full object-contain max-h-14 drop-shadow-[0_0_12px_rgba(255,215,0,0.3)] transition-transform hover:scale-105 duration-300"
              />
            )}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-adiptify-navy dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 text-white flex items-center justify-center z-30 hover:bg-adiptify-gold hover:text-adiptify-navy transition-all duration-200 shadow-md"
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2 mt-1">Learning</p>}
            <NavItem icon={<BarChart2 size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigate('/')} collapsed={collapsed} />
            <NavItem icon={<Library size={20} />} label="Subject Catalog" active={activeTab === 'catalog'} onClick={() => navigate('/catalog')} collapsed={collapsed} />
            <NavItem icon={<BookOpen size={20} />} label="Study Modules" active={activeTab === 'modules'} onClick={() => navigate('/modules')} collapsed={collapsed} />
            <NavItem icon={<Brain size={20} />} label="Spaced Review" active={activeTab === 'review'} onClick={() => navigate('/review')} collapsed={collapsed} />
            <NavItem icon={<MessageSquare size={20} />} label="AI Tutor" active={activeTab === 'tutor'} onClick={() => navigate('/tutor')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2">Assessment</p>}
            <NavItem icon={<ClipboardList size={20} />} label="Quizzes" active={activeTab === 'quiz'} onClick={() => navigate('/quiz-dashboard')} collapsed={collapsed} />
            <NavItem icon={<Trophy size={20} />} label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => navigate('/leaderboard')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            {!collapsed && <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/60 px-3 mb-2">Explore</p>}
            <NavItem icon={<FlaskConical size={20} />} label="Experiment Lab" active={activeTab === 'lab'} onClick={() => navigate('/lab')} collapsed={collapsed} />
            <NavItem icon={<BarChart3 size={20} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => navigate('/analytics')} collapsed={collapsed} />
            <NavItem icon={<Network size={20} />} label="Knowledge Graph" active={activeTab === 'graph'} onClick={() => navigate('/graph')} collapsed={collapsed} />

            <div className="my-2 mx-2 border-t border-white/8" />
            <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => navigate('/settings')} collapsed={collapsed} />
          </nav>

          {/* User footer */}
          <div className="p-3 border-t border-white/10">
            {user ? (
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
                <div className={`flex items-center gap-2.5 ${collapsed ? '' : 'px-1'} py-1`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-adiptify-gold to-adiptify-terracotta flex items-center justify-center text-sm font-bold text-adiptify-navy flex-shrink-0 shadow-lg ring-2 ring-white/10">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email || 'Student'}</p>
                    </div>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={toggleTheme}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-adiptify-gold transition-colors"
                      title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                      {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                      title="Logout"
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className={`flex items-center gap-2.5 ${collapsed ? 'p-2' : 'px-3 py-2.5'} rounded-xl hover:bg-white/5 transition-colors w-full`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 flex items-center justify-center text-adiptify-navy flex-shrink-0">
                    <User size={18} />
                  </div>
                  {!collapsed && (
                    <div>
                      <p className="text-sm font-medium">Guest</p>
                      <p className="text-[10px] text-slate-400">Sign in</p>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<AnimatedPage><ProtectedRoute><MasteryDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/login" element={<Login />} />
            <Route path="/modules" element={<AnimatedPage><ProtectedRoute><StudyModules /></ProtectedRoute></AnimatedPage>} />
            <Route path="/concept/:conceptId" element={<AnimatedPage><ProtectedRoute><ConceptLearning /></ProtectedRoute></AnimatedPage>} />
            <Route path="/review" element={<AnimatedPage><ProtectedRoute><SpacedReview /></ProtectedRoute></AnimatedPage>} />
            <Route path="/lab" element={<AnimatedPage><ProtectedRoute><ExperimentLab /></ProtectedRoute></AnimatedPage>} />
            <Route path="/analytics" element={<AnimatedPage><ProtectedRoute><AnalyticsDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/tutor" element={<AnimatedPage><ProtectedRoute><AITutorPage /></ProtectedRoute></AnimatedPage>} />
            <Route path="/quiz-dashboard" element={<AnimatedPage><ProtectedRoute><QuizDashboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/catalog" element={<AnimatedPage><ProtectedRoute><SubjectCatalog /></ProtectedRoute></AnimatedPage>} />
            <Route path="/quiz/:id" element={<AnimatedPage><ProtectedRoute><QuizPage /></ProtectedRoute></AnimatedPage>} />
            <Route path="/result" element={<AnimatedPage><ProtectedRoute><Result /></ProtectedRoute></AnimatedPage>} />
            <Route path="/leaderboard" element={<AnimatedPage><ProtectedRoute><Leaderboard /></ProtectedRoute></AnimatedPage>} />
            <Route path="/graph" element={<AnimatedPage><ProtectedRoute><GraphExplorer /></ProtectedRoute></AnimatedPage>} />
            <Route path="/settings" element={<AnimatedPage><ProtectedRoute><UserPreferences /></ProtectedRoute></AnimatedPage>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Floating AI Tutor */}
      {!isLoginPage && <AITutor />}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3.5 ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl transition-all duration-200 text-left group relative overflow-hidden ${active
        ? 'text-adiptify-gold font-medium bg-gradient-to-r from-adiptify-gold/10 to-transparent'
        : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-white/5 hover:to-transparent'
      }`}
    >
      {/* Active indicator bar */}
      {active && (
        <motion.div
          layoutId="activeNav"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-6 rounded-r-full bg-adiptify-gold shadow-[0_0_8px_rgba(255,215,0,0.8)]"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <span className={`flex-shrink-0 flex items-center justify-center transition-all duration-200 ${active ? 'text-adiptify-gold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-110'}`}>
        {icon}
      </span>
      {!collapsed && <span className="text-sm truncate pt-0.5">{label}</span>}
    </button>
  );
}

function App() {
  return (
    <QuizProvider>
      <ThemeProvider>
        <AdaptifyProvider>
          <Router>
            <AppContent />
          </Router>
        </AdaptifyProvider>
      </ThemeProvider>
    </QuizProvider>
  );
}

export default App;
