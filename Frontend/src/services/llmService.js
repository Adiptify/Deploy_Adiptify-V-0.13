import { apiFetch } from '../api/client';

export const getAIResponse = async (topic, pathContext = "", subjectId = null) => {
  try {
    if (subjectId && !pathContext) {
      // First, try loading the cached graph for the subject
      try {
        const graphData = await apiFetch(`/api/graph/subject/${subjectId}`);
        if (graphData && graphData.root) {
          return graphData;
        }
      } catch (cacheErr) {
        console.warn("Cached graph unretrievable, falling back to live generation:", cacheErr);
      }
    }

    const data = await apiFetch('/api/graph/generate', {
      method: 'POST',
      body: { topic, pathContext }
    });
    return data;
  } catch (error) {
    console.error("Graph Service Error:", error);
    const isInitial = !pathContext;
    return isInitial ? { root: { id: 'root', label: topic, desc: 'Error generating graph' }, children: [] } : { nodes: [] };
  }
};
