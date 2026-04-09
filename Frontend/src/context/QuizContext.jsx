import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [ollamaStatus, setOllamaStatus] = useState('checking');
    const [ollamaModel, setOllamaModel] = useState('deepseek-r1');

    // Fetch enrolled subjects from backend
    useEffect(() => {
        const fetchEnrolled = async () => {
            try {
                const subjects = await apiFetch('/api/subjects/enrolled');
                setEnrolledSubjects(subjects);
            } catch (e) { /* ignore — offline mode */ }
        };
        fetchEnrolled();
    }, []);

    // Check Ollama connectivity (matching CaseStudy-1 approach)
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const response = await fetch('http://localhost:11434/api/tags');
                if (response.ok) {
                    const data = await response.json();
                    setOllamaStatus('connected');
                    // Pick the first available model or use env default
                    if (data.models && data.models.length > 0) {
                        setOllamaModel(data.models[0].name);
                    }
                } else {
                    setOllamaStatus('error');
                }
            } catch {
                setOllamaStatus('error');
            }
        };
        checkOllama();
        // Re-check every 30s
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, []);

    const [categories, setCategories] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('adiptify_user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    // Fetch initial quizzes from Backend
    const fetchQuizzes = useCallback(async () => {
        try {
            const data = await apiFetch('/api/ai/generated');
            // Map backend generated assessments to frontend quiz shape
            const formattedQuizzes = data.map(assessment => {
                return {
                    id: assessment._id,
                    title: assessment.title || assessment.topic,
                    topic: assessment.topic,
                    description: `AI Generated Quiz on ${assessment.topic}`,
                    duration: Math.max(2, (assessment.items?.length || 3) * 2), // 2 mins per question
                    aiGenerated: true,
                    questions: (assessment.items || []).map((item, idx) => {
                        let correctIndex = 0;
                        if (typeof item.answer === 'number') {
                            correctIndex = item.answer;
                        } else if (typeof item.correctIndex === 'number') {
                            correctIndex = item.correctIndex;
                        } else if (typeof item.answer === 'string') {
                            correctIndex = (item.choices || item.options || []).indexOf(item.answer);
                            if (correctIndex === -1) correctIndex = 0;
                        }
                        return {
                            id: item._id || idx,
                            question: item.question,
                            options: item.choices || item.options || [],
                            correctAnswer: correctIndex,
                            explanation: item.explanation || '',
                            hint: item.hints?.[0] || item.hint || '',
                        };
                    }).filter(q => q.question && q.options.length > 0) // filter out broken items
                };
            }).filter(q => q.questions.length > 0); // filter out empty quizzes
            setQuizzes(formattedQuizzes);
        } catch (e) {
            console.error('Failed to load quizzes', e);
        }
    }, []);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const data = await apiFetch('/api/assessment/leaderboard');
            setLeaderboard(data || []);
        } catch (e) {
            console.error('Failed to load leaderboard', e);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const subjectsContent = await apiFetch('/api/subjects');
            if (subjectsContent) {
                const uniqueCategories = new Set();
                const processedCategories = [];
                subjectsContent.forEach(sub => {
                    const catName = sub.category?.name || sub.category || "General";
                    if (!uniqueCategories.has(catName)) {
                        uniqueCategories.add(catName);
                        processedCategories.push({ _id: catName, name: catName });
                    }
                });
                setCategories(processedCategories);
            }
        } catch (e) {
            console.error('Failed to load categories', e);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchQuizzes();
            fetchLeaderboard();
            fetchCategories();
        }
    }, [user, fetchQuizzes, fetchLeaderboard, fetchCategories]);

    // Show ALL quizzes — no aggressive filtering that hides AI-generated ones
    // The old filter was hiding quizzes when enrolled topics didn't match quiz titles
    const addQuiz = (newQuiz) => {
        fetchQuizzes(); // refetch from backend after a new one is saved
    };

    const login = (userData) => {
        setUser(userData);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('adiptify_user');
        localStorage.removeItem('adiptify_token');
    };

    const addScore = async (score, quizId = null, answers = {}) => {
        if (user) {
            try {
                await apiFetch('/api/assessment/simple-finish', {
                    method: 'POST',
                    body: { score, quizId, answers }
                });
                fetchLeaderboard();
            } catch (e) {
                console.error("Failed to save score", e);
            }
        }
    };

    const refreshSubjects = useCallback(async () => {
        try {
            const subjects = await apiFetch('/api/subjects/enrolled');
            setEnrolledSubjects(subjects);
        } catch (e) { /* ignore */ }
    }, []);

    return (
        <QuizContext.Provider value={{
            user, login, logout,
            leaderboard, addScore,
            quizzes,
            allQuizzes: quizzes,
            addQuiz,
            enrolledSubjects, refreshSubjects,
            fetchQuizzes,
            categories,
            ollamaStatus, ollamaModel,
        }}>
            {children}
        </QuizContext.Provider>
    );
};

export const useQuiz = () => useContext(QuizContext);
