import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AdaptifyContext = createContext();

const API_BASE = 'http://localhost:4000/api';

// Helper: get auth headers
function getAuthHeaders() {
    try {
        const token = localStorage.getItem('adiptify_token');
        if (token) {
            return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        }
    } catch (e) { /* ignore */ }
    return { 'Content-Type': 'application/json' };
}

export const AdaptifyProvider = ({ children }) => {
    const [concepts, setConcepts] = useState([]);
    const [userProgress, setUserProgress] = useState({});
    const [dueReviews, setDueReviews] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generateStatus, setGenerateStatus] = useState(null);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [experimentHistory, setExperimentHistory] = useState([]);

    // Fetch enrolled subjects
    const fetchEnrolledSubjects = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/subjects/enrolled`, { headers: getAuthHeaders() });
            if (res.ok) {
                const subjects = await res.json();
                setEnrolledSubjects(subjects);
                return subjects;
            }
        } catch (e) { /* offline */ }
        return [];
    }, []);

    // Fetch concepts filtered by enrolled subjects + user progress
    const fetchConcepts = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/adaptive/concepts?enrolled=true`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setConcepts(data.concepts || []);
                setUserProgress(data.progress || {});
                return data.concepts || [];
            }
        } catch (e) {
            console.warn("[AdaptifyContext] Failed to fetch concepts:", e.message);
        }
        setConcepts([]);
        setUserProgress({});
        return [];
    }, []);

    // Generate AI modules for all enrolled subjects
    const generateModules = useCallback(async () => {
        setGenerating(true);
        setGenerateStatus('Generating AI study modules for your subjects...');
        try {
            const res = await fetch(`${API_BASE}/adaptive/generate`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setGenerateStatus(`Generated ${data.generated} new concepts across ${data.subjects?.length || 0} subjects!`);
                // Refresh concepts after generation
                await fetchConcepts();
                return data;
            } else {
                const err = await res.json();
                setGenerateStatus(`Error: ${err.error || 'Failed to generate'}`);
            }
        } catch (e) {
            setGenerateStatus(`Error: ${e.message}`);
        } finally {
            setGenerating(false);
        }
        return null;
    }, [fetchConcepts]);

    // Fetch due reviews
    const fetchDueReviews = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/sr/due`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setDueReviews(data.due || []);
            }
        } catch (e) { /* ignore */ }
    }, []);

    // Fetch analytics
    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/analytics/dashboard`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
                return data;
            }
        } catch (e) { 
            console.error("[AdaptifyContext] Analytics fetch failed:", e);
        }
        return null;
    }, []);

    // Submit performance
    const submitPerformance = useCallback(async (conceptId, performanceData) => {
        try {
            const res = await fetch(`${API_BASE}/adaptive/submit`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ conceptId, ...performanceData }),
            });
            if (res.ok) {
                const data = await res.json();
                setUserProgress(prev => ({ ...prev, [conceptId]: data }));
                return data;
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, []);

    // Submit review
    const submitReview = useCallback(async (conceptId, quality) => {
        try {
            const res = await fetch(`${API_BASE}/sr/review`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ conceptId, quality }),
            });
            if (res.ok) {
                const data = await res.json();
                await fetchDueReviews();
                return data;
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, [fetchDueReviews]);

    // Get concept by ID
    const getConceptById = useCallback((conceptId) => {
        return concepts.find(c => c.conceptId === conceptId) || null;
    }, [concepts]);

    // Fetch experiment history
    const fetchExperimentHistory = useCallback(async (type) => {
        try {
            const url = type ? `${API_BASE}/experiments/history?type=${type}` : `${API_BASE}/experiments/history`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setExperimentHistory(data.results || []);
                return data.results;
            }
        } catch (e) { /* ignore */ }
        return [];
    }, []);

    // Save experiment result
    const saveExperimentResult = useCallback(async (experimentData) => {
        try {
            const res = await fetch(`${API_BASE}/experiments/save`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(experimentData),
            });
            if (res.ok) {
                await fetchExperimentHistory(experimentData.experimentType);
                return await res.json();
            }
        } catch (e) { /* ignore */ }
        return { ok: false };
    }, [fetchExperimentHistory]);

    // Initialize on mount
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchEnrolledSubjects();
            await fetchConcepts();
            setLoading(false);
        };
        init();
    }, [fetchEnrolledSubjects, fetchConcepts]);

    // Fetch dependent data after initial load
    useEffect(() => {
        if (!loading) {
            fetchDueReviews();
            fetchAnalytics();
        }
    }, [loading, fetchDueReviews, fetchAnalytics]);

    return (
        <AdaptifyContext.Provider value={{
            concepts,
            userProgress,
            dueReviews,
            analytics,
            loading,
            generating,
            generateStatus,
            enrolledSubjects,
            experimentHistory,
            submitPerformance,
            submitReview,
            fetchDueReviews,
            fetchAnalytics,
            fetchConcepts,
            fetchEnrolledSubjects,
            fetchExperimentHistory,
            saveExperimentResult,
            getConceptById,
            generateModules,
        }}>
            {children}
        </AdaptifyContext.Provider>
    );
};

export const useAdaptify = () => useContext(AdaptifyContext);

export default AdaptifyContext;
