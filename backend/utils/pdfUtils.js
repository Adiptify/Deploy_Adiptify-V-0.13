/**
 * PDF Text Processing Utilities
 * 
 * cleanText  — Strips headers, footers, page numbers, and normalises whitespace.
 * chunkText  — Splits cleaned text into 500-1000 word windows with overlap
 *              to prevent LLM context overflow and hallucination.
 */

/**
 * Clean raw extracted PDF text.
 * Removes:
 *  - Page number lines  (e.g. "Page 12", "- 3 -", standalone digits)
 *  - Common header/footer artifacts
 *  - Excessive whitespace / line-breaks
 *  - Non-printable characters
 */
export function cleanText(raw) {
    if (!raw || typeof raw !== 'string') return '';

    let text = raw;

    // 1. Strip non-printable / zero-width chars (keep newlines)
    text = text.replace(/[^\S\n\r]*[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 2. Remove standalone page-number lines
    //    "Page 5", "— 12 —", "- 3 -", or just a bare number on its own line
    text = text.replace(/^\s*(?:page\s*\d+|\d+\s*$|[-—–]\s*\d+\s*[-—–])\s*$/gim, '');

    // 3. Collapse 3+ consecutive newlines into 2 (paragraph boundary)
    text = text.replace(/\n{3,}/g, '\n\n');

    // 4. Collapse multiple spaces/tabs on the same line
    text = text.replace(/[^\S\n]+/g, ' ');

    // 5. Trim each line
    text = text
        .split('\n')
        .map(line => line.trim())
        .join('\n');

    // 6. Final overall trim
    return text.trim();
}

/**
 * Split cleaned text into overlapping word-based chunks.
 *
 * @param {string} text        — Cleaned text
 * @param {object} opts
 * @param {number} opts.target — Target chunk size in words (default 750)
 * @param {number} opts.min    — Minimum chunk size in words  (default 400)
 * @param {number} opts.max    — Maximum chunk size in words  (default 1000)
 * @param {number} opts.overlap — Word overlap between chunks  (default 50)
 * @returns {string[]}  Array of text chunks
 */
export function chunkText(text, opts = {}) {
    const {
        target = 750,
        min = 400,
        max = 1000,
        overlap = 50,
    } = opts;

    if (!text || typeof text !== 'string') return [];

    const words = text.split(/\s+/).filter(Boolean);

    // If already within a single chunk, return as-is
    if (words.length <= max) {
        return [words.join(' ')];
    }

    const chunks = [];
    let start = 0;

    while (start < words.length) {
        let end = Math.min(start + target, words.length);

        // Try to extend to a sentence boundary (period followed by capital or newline)
        // within the max window
        const windowEnd = Math.min(start + max, words.length);
        for (let i = end; i < windowEnd; i++) {
            if (/[.!?]$/.test(words[i])) {
                end = i + 1;
                break;
            }
        }

        // If we couldn't reach a sentence boundary, just use the target
        end = Math.min(end, windowEnd);

        const chunk = words.slice(start, end).join(' ');

        // Only add if the chunk meets the minimum word count
        // (last chunk is exempt from minimum)
        if (chunk.split(/\s+/).length >= min || start + target >= words.length) {
            chunks.push(chunk);
        } else {
            // If the remaining tail is too short, merge it with the previous chunk
            if (chunks.length > 0) {
                chunks[chunks.length - 1] += ' ' + chunk;
            } else {
                chunks.push(chunk);
            }
        }

        // Advance with overlap
        start = end - overlap;
        if (start <= (end - target) || start < 0) start = end; // safety guard
    }

    return chunks;
}
