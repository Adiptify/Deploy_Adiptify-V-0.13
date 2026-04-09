/**
 * PPT Processing Utilities
 * 
 * Handles PPTX → JSON conversion via pptxtojson, then:
 *  - extractSlideTexts: pulls readable text from each slide's elements
 *  - chunkSlides: groups slides into LLM-sized chunks (2-3 slides per chunk)
 *  - stripHtml: removes HTML tags from pptxtojson's rich-text content
 */

import { createRequire } from 'module';

// pptxtojson only ships a CJS build for Node.js
const require = createRequire(import.meta.url);
const pptxtojson = require('pptxtojson/dist/index.cjs');

/**
 * Parse a PPTX buffer into the pptxtojson JSON structure.
 * @param {Buffer} buffer  — The raw PPTX file buffer
 * @returns {Promise<object>} Parsed JSON: { slides, size, themeColors }
 */
export async function parsePptxToJson(buffer) {
    // pptxtojson.parse expects an ArrayBuffer.
    // Ensure we handle Node.js Buffer → ArrayBuffer correctly regardless of pooling.
    const arrayBuffer = new Uint8Array(buffer).buffer;
    
    try {
        const json = await pptxtojson.parse(arrayBuffer);
        return json;
    } catch (err) {
        console.error("[pptUtils] pptxtojson.parse core error:", err.message);
        if (err.message.includes('a:firstCol')) {
            throw new Error("PPTX Parsing failed: This file contains complex tables that the parser cannot process. Try simplifying the tables or exporting to PDF before uploading.");
        }
        throw err;
    }
}

/**
 * Strip HTML tags from a string, returning plain text.
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Recursively extract text from a pptxtojson element.
 * Handles nested groups and diagrams with a safety depth limit.
 */
function extractElementText(el, depth = 0) {
    if (depth > 10) return []; // Safety limit to prevent heap exhaustion on circular/deep structures
    const texts = [];

    // Direct content field (HTML rich text)
    if (el.content) {
        const plain = stripHtml(el.content);
        if (plain) texts.push(plain);
    }

    // Table data
    if (el.type === 'table' && Array.isArray(el.data)) {
        for (const row of el.data) {
            for (const cell of row) {
                if (cell?.text) texts.push(stripHtml(cell.text));
                if (cell?.content) texts.push(stripHtml(cell.content));
            }
        }
    }

    // Diagram/Smart Art text list
    if (el.type === 'diagram' && Array.isArray(el.textList)) {
        for (const t of el.textList) {
            if (t) texts.push(stripHtml(t));
        }
    }

    // Nested elements (groups, diagrams)
    if (Array.isArray(el.elements)) {
        for (const child of el.elements) {
            texts.push(...extractElementText(child, depth + 1));
        }
    }

    return texts;
}

/**
 * Extract readable text from each slide, returning per-slide text arrays.
 *
 * @param {object[]} slides — The `slides` array from pptxtojson output
 * @returns {{ slideIndex: number, texts: string[], note: string }[]}
 */
export function extractSlideTexts(slides) {
    if (!Array.isArray(slides)) return [];

    return slides.map((slide, idx) => {
        const texts = [];

        // Process main elements
        if (Array.isArray(slide.elements)) {
            for (const el of slide.elements) {
                texts.push(...extractElementText(el));
            }
        }

        // Process layout (master) elements
        if (Array.isArray(slide.layoutElements)) {
            for (const el of slide.layoutElements) {
                texts.push(...extractElementText(el));
            }
        }

        return {
            slideIndex: idx,
            texts: texts.filter(Boolean),
            note: slide.note ? stripHtml(slide.note) : '',
        };
    });
}

/**
 * Group slide texts into chunks for LLM processing.
 * Default: 3 slides per chunk.
 *
 * @param {{ slideIndex: number, texts: string[], note: string }[]} slideTexts
 * @param {number} slidesPerChunk — How many slides per chunk (default 3)
 * @returns {string[]} Array of text chunks, each is the combined text of N slides
 */
export function chunkSlides(slideTexts, slidesPerChunk = 3) {
    const chunks = [];

    for (let i = 0; i < slideTexts.length; i += slidesPerChunk) {
        const group = slideTexts.slice(i, i + slidesPerChunk);
        const combined = group
            .map(s => {
                const body = s.texts.join(' ');
                const note = s.note ? ` [Speaker Notes: ${s.note}]` : '';
                return `[Slide ${s.slideIndex + 1}] ${body}${note}`;
            })
            .join('\n\n');

        if (combined.trim()) {
            chunks.push(combined.trim());
        }
    }

    return chunks;
}
