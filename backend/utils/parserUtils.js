import JSZip from 'jszip';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseRaw = require("pdf-parse");

let pdfParse;
if (typeof pdfParseRaw === 'function') {
    pdfParse = pdfParseRaw;
} else if (pdfParseRaw && typeof pdfParseRaw.default === 'function') {
    pdfParse = pdfParseRaw.default;
}

/**
 * Streams pages from a PDF buffer.
 * @param {Buffer} buffer 
 */
export async function* extractPdfPages(buffer) {
    if (!pdfParse) throw new Error("PDF parser not initialized");
    const data = await pdfParse(buffer);
    const pages = data.text.split('\f');
    for (const page of pages) {
        yield cleanAndFilterText(page);
    }
}

/**
 * Streams slides from a PPTX buffer using JSZip.
 * @param {Buffer} buffer 
 */
export async function* extractSlides(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
        .filter(name => name.includes('ppt/slides/slide'))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
            const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
            return numA - numB;
        });

    for (const file of slideFiles) {
        const content = await zip.files[file].async('text');
        // Extract text content from XML tags (safe fallback)
        const text = content.match(/>([^<>]+)</g)?.map(t =>
            t.replace(/[<>]/g, '')
        ).join(' ') || '';
        
        yield cleanAndFilterText(text);
        
        // Manual cleanup to help GC
        zip.files[file] = null;
    }
}

/**
 * Generator that yields text chunks of a specific size.
 * Uses an array to avoid string accumulation memory spikes.
 * @param {AsyncGenerator} stream 
 * @param {number} maxWords 
 */
export async function* chunkGenerator(stream, maxWords = 500) {
    let currentChunk = [];
    let wordCount = 0;

    for await (const text of stream) {
        const words = text.split(/\s+/);

        for (const word of words) {
            if (!word) continue;
            currentChunk.push(word);
            wordCount++;

            if (wordCount >= maxWords) {
                yield currentChunk.join(' ');
                currentChunk = [];
                wordCount = 0;
            }
        }
    }

    if (currentChunk.length > 0) {
        yield currentChunk.join(' ');
    }
}

/**
 * Cleans syllabus text by removing noise like PEOs, POs, and References.
 * @param {string} text 
 */
export function cleanAndFilterText(text) {
    return text
        .replace(/PEO\s*\d.*?(\n|$)/gi, '')
        .replace(/PO\s*\d.*?(\n|$)/gi, '')
        .replace(/PSO\s*\d.*?(\n|$)/gi, '')
        .replace(/Reference Books.*?/gis, '')
        .replace(/Assessment Model.*?/gis, '')
        .replace(/\s+/g, ' ')
        .trim();
}
