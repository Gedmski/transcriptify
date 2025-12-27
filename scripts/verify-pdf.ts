import fs from 'fs';
import path from 'path';
import { parseTranscript, calculateStats } from '../utils/transcript-parser';

// Polyfill DOMMatrix for Node.js environment
if (typeof global.DOMMatrix === 'undefined') {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix {
        a: number; b: number; c: number; d: number; e: number; f: number;
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    };
}

async function main() {
    const pdfPath = path.join(process.cwd(), 'public', 'SSR_TSRPT.pdf');

    if (!fs.existsSync(pdfPath)) {
        console.error(`File not found: ${pdfPath}`);
        process.exit(1);
    }

    const buffer = fs.readFileSync(pdfPath);
    const data = new Uint8Array(buffer);

    try {
        // Use legacy build for Node.js
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const loadingTask = pdfjsLib.getDocument({
            data,
            isEvalSupported: false,
            useSystemFonts: true,
        });

        const pdf = await loadingTask.promise;

        console.log(`PDF loaded. Pages: ${pdf.numPages}`);

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // @ts-ignore
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
        }

        console.log('Text extracted. Length:', fullText.length);

        const courses = parseTranscript(fullText);
        console.log(`Found ${courses.length} courses.`);

        if (courses.length > 0) {
            console.log('--- FIRST COURSE ---');
            console.log(courses[0]);
            console.log('--- LAST COURSE ---');
            console.log(courses[courses.length - 1]);
            console.log('--- STATS ---');
            console.log(calculateStats(courses));
        } else {
            console.error('No courses found! Regex might not match.');
            console.log('--- TEXT PREVIEW ---');
            console.log(fullText.substring(0, 1000));
        }

    } catch (error) {
        console.error('Error processing PDF:', error);
    }
}

main();
