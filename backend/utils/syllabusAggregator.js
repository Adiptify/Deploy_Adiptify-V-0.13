/**
 * Syllabus Aggregator
 * 
 * Merges multiple partial syllabus extractions (from chunked LLM calls)
 * into a single unified structure.  Handles:
 *  - Module de-duplication (by normalised title)
 *  - Topic de-duplication within modules
 *  - Learning-outcomes de-duplication
 *  - Picking the best (longest) name / description / category
 */

/**
 * Normalise a string for comparison: lowercase, collapse whitespace, strip punctuation.
 */
function normalise(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Pick the longer (more descriptive) of two strings.
 */
function pickLonger(a, b) {
    if (!a) return b || '';
    if (!b) return a || '';
    return a.length >= b.length ? a : b;
}

/**
 * De-duplicate an array of strings (case-insensitive).
 */
function dedupeStrings(arr) {
    const seen = new Set();
    return arr.filter(s => {
        const key = normalise(s);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Merge an array of partial syllabus JSON objects into one.
 *
 * Each partial can have:
 *   { name, description, category, learningOutcomes[], modules[] }
 *
 * @param {object[]} partials - Array of partial extractions
 * @returns {object} Unified syllabus
 */
export function mergeSyllabusPartials(partials) {
    if (!Array.isArray(partials) || partials.length === 0) {
        return { name: '', description: '', category: '', learningOutcomes: [], modules: [] };
    }

    // If there's only one partial, return it directly (already complete)
    if (partials.length === 1) {
        const p = partials[0];
        return {
            name: p.name || '',
            description: p.description || '',
            category: p.category || '',
            learningOutcomes: Array.isArray(p.learningOutcomes) ? p.learningOutcomes : [],
            modules: Array.isArray(p.modules) ? p.modules : [],
        };
    }

    // ── Aggregate top-level metadata ──
    let name = '';
    let description = '';
    let category = '';
    let learningOutcomes = [];

    for (const p of partials) {
        name = pickLonger(name, p.name);
        description = pickLonger(description, p.description);
        category = pickLonger(category, p.category);

        if (Array.isArray(p.learningOutcomes)) {
            learningOutcomes.push(...p.learningOutcomes);
        }
    }

    learningOutcomes = dedupeStrings(learningOutcomes);

    // ── Merge modules ──
    // Key: normalised module title → aggregated module
    const moduleMap = new Map();

    for (const p of partials) {
        if (!Array.isArray(p.modules)) continue;

        for (const mod of p.modules) {
            const key = normalise(mod.title);
            if (!key) continue;

            if (!moduleMap.has(key)) {
                moduleMap.set(key, {
                    title: mod.title,
                    description: mod.description || '',
                    topics: [],
                    _topicKeys: new Set(),
                });
            }

            const target = moduleMap.get(key);
            target.title = pickLonger(target.title, mod.title);
            target.description = pickLonger(target.description, mod.description);

            if (Array.isArray(mod.topics)) {
                for (const topic of mod.topics) {
                    const topicKey = normalise(topic.title);
                    if (!topicKey || target._topicKeys.has(topicKey)) continue;
                    target._topicKeys.add(topicKey);
                    target.topics.push({
                        title: topic.title,
                        description: topic.description || '',
                    });
                }
            }
        }
    }

    // Clean up internal tracking field
    const modules = [...moduleMap.values()].map(({ _topicKeys, ...mod }) => mod);

    return { name, description, category, learningOutcomes, modules };
}
