export interface Course {
    code: string;       // e.g., "DSAI"
    number: string;     // e.g., "3201"
    fullCode: string;   // e.g., "DSAI 3201"
    title: string;      // e.g., "Machine Learning"
    credits: number;    // e.g., 3.0
    grade: string;      // e.g., "A", "B+"
    points: number;     // e.g., 12.0
    term: string;       // Derived from context (e.g., "Winter 2025")
}

export function parseTranscript(rawText: string): Course[] {
    const courses: Course[] = [];

    // Regex for Course: matches the standard row format
    // Added negative lookahead in title group to prevent consuming the next course start
    const courseRegex = /([A-Z]{4})\s+(\d{4})\s+((?:(?![A-Z]{4}\s+\d{4}).)+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})\s+([A-F][+]?)\s+(\d+\.\d{2})/gi;

    // Regex for Term Header: e.g., "Fall 2022", "Winter 2023"
    const termRegex = /(Fall|Winter|Spring|Summer)\s+(\d{4})/gi;

    // Find all terms with their indices
    const terms: { name: string; index: number }[] = [];
    let termMatch;
    while ((termMatch = termRegex.exec(rawText)) !== null) {
        terms.push({
            name: termMatch[0],
            index: termMatch.index
        });
    }

    // Find all courses and assign the most recent term
    let courseMatch;
    while ((courseMatch = courseRegex.exec(rawText)) !== null) {
        const courseIndex = courseMatch.index;

        // Find the term that appears most recently before this course
        // We filter terms that started before the course, and take the last one
        const currentTermObj = terms.filter(t => t.index < courseIndex).pop();
        const currentTerm = currentTermObj ? currentTermObj.name : "Unknown Term";

        courses.push({
            code: courseMatch[1],
            number: courseMatch[2],
            fullCode: `${courseMatch[1]} ${courseMatch[2]}`,
            title: courseMatch[3].trim(),
            credits: parseFloat(courseMatch[5]), // Use "Earned" credits
            grade: courseMatch[6],
            points: parseFloat(courseMatch[7]),
            term: currentTerm
        });
    }

    return courses;
}

export function calculateStats(courses: Course[]) {
    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
    const totalPoints = courses.reduce((sum, c) => sum + c.points, 0);
    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00";

    return {
        totalCourses: courses.length,
        totalCredits,
        cgpa
    };
}

export function calculateTrends(courses: Course[]) {
    // Group by term
    const terms: Record<string, Course[]> = {};
    courses.forEach(c => {
        const term = c.term || 'Unknown';
        if (!terms[term]) {
            terms[term] = [];
        }
        terms[term].push(c);
    });

    // Helper to parse term to comparable value
    const termOrder = (term: string) => {
        const parts = term.split(' ');
        if (parts.length < 2) return 0;
        const season = parts[0];
        const year = parseInt(parts[1]);
        const seasonOrder = { "Winter": 1, "Spring": 2, "Summer": 3, "Fall": 4 };
        return year * 10 + (seasonOrder[season as keyof typeof seasonOrder] || 0);
    };

    const sortedTerms = Object.keys(terms).sort((a, b) => termOrder(a) - termOrder(b));

    let cumulativePoints = 0;
    let cumulativeCredits = 0;

    return sortedTerms.map(term => {
        const termCourses = terms[term];
        const termPoints = termCourses.reduce((sum, c) => sum + c.points, 0);
        const termCredits = termCourses.reduce((sum, c) => sum + c.credits, 0);

        const termGpa = termCredits > 0 ? termPoints / termCredits : 0;

        cumulativePoints += termPoints;
        cumulativeCredits += termCredits;
        const cumulativeGpa = cumulativeCredits > 0 ? cumulativePoints / cumulativeCredits : 0;

        return {
            term,
            gpa: parseFloat(termGpa.toFixed(2)),
            cumulative: parseFloat(cumulativeGpa.toFixed(2))
        };
    });
}

export function calculateGradeDistribution(courses: Course[]) {
    const distribution: Record<string, { count: number; credits: number; courses: string[] }> = {};
    courses.forEach(c => {
        const grade = c.grade;
        if (!distribution[grade]) {
            distribution[grade] = { count: 0, credits: 0, courses: [] };
        }
        distribution[grade].count += 1;
        distribution[grade].credits += c.credits;
        distribution[grade].courses.push(c.code + " " + c.number);
    });

    const gradeOrder = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"];
    const allGrades = Array.from(new Set([...gradeOrder, ...Object.keys(distribution)]));

    allGrades.sort((a, b) => {
        const idxA = gradeOrder.indexOf(a);
        const idxB = gradeOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    return allGrades.map(g => ({
        grade: g,
        count: distribution[g]?.count || 0,
        credits: distribution[g]?.credits || 0,
        courses: distribution[g]?.courses || []
    })).filter(d => d.count > 0);
}

export const SUBJECT_MAP: Record<string, string> = {
    // ============================================
    // 1. TECH & AI (The "Logic" Spoke)
    // ============================================
    DSAI: "Tech & AI",   // Data Science & AI
    INFS: "Tech & AI",   // Information Systems
    INFT: "Tech & AI",   // Info Tech (Hardware/Net)
    COMP: "Tech & AI",   // Computing / Practicum
    DACS: "Tech & AI",   // Data & Cyber Security
    AICC: "Tech & AI",   // AI & Cognitive Computing (Masters)
    MISY: "Tech & AI",   // Management Info Systems

    // ============================================
    // 2. ENGINEERING (The "Build" Spoke)
    // ============================================
    // AE** = Applied Engineering Series
    AEAC: "Engineering", // Air Conditioning / HVAC
    AECE: "Engineering", // Civil Engineering
    AECH: "Engineering", // Chemical Engineering
    AEEL: "Engineering", // Electrical Engineering
    AEEP: "Engineering", // Electrical Power
    AEMA: "Engineering", // Maintenance / Mechanical
    AEMR: "Engineering", // Marine Engineering
    AETN: "Engineering", // Telecommunications
    FENG: "Engineering", // Foundation Engineering
    FTEN: "Engineering", // Foundation Tech
    AVMG: "Engineering", // Aviation Management
    MADC: "Engineering", // Master of Applied Design/Construction

    // ============================================
    // 3. BUSINESS (The "Strategy" Spoke)
    // ============================================
    ACCT: "Business",    // Accounting
    BKFT: "Business",    // Banking & FinTech
    BUSG: "Business",    // General Business
    ECON: "Business",    // Economics
    HCMT: "Business",    // Healthcare Management
    HRMG: "Business",    // Human Resources
    LSCM: "Business",    // Logistics & Supply Chain
    MGMT: "Business",    // Management
    MRKT: "Business",    // Marketing

    // ============================================
    // 4. HEALTH SCIENCES (The "Care" Spoke)
    // ============================================
    // HS** = Health Sciences Series
    HSDH: "Health",      // Dental Hygiene
    HSEH: "Health",      // Environmental Health
    HSHG: "Health",      // Health General/Hygiene
    HSMR: "Health",      // Medical Radiography
    HSOH: "Health",      // Occupational Health
    HSPA: "Health",      // Paramedicine / Pharmacy
    HSPT: "Health",      // Physiotherapy
    HSRT: "Health",      // Respiratory Therapy
    NURS: "Health",      // Nursing
    NUPN: "Health",      // Practical Nursing
    NUMW: "Health",      // Midwifery
    HMED: "Health",      // Health Medical Foundations
    FBIO: "Health",      // Foundation Biology
    FCHE: "Health",      // Foundation Chemistry

    // ============================================
    // 5. MATH & SCIENCE (The "Quant" Spoke)
    // ============================================
    MATH: "Math/Sci",    // Mathematics
    PHYS: "Math/Sci",    // Physics
    CHEM: "Math/Sci",    // Chemistry
    BIOL: "Math/Sci",    // Biology
    SCIE: "Math/Sci",    // General Science
    FMAT: "Math/Sci",    // Foundation Math
    HMAT: "Math/Sci",    // Health Math

    // ============================================
    // 6. GENERAL & SOFT SKILLS (The "Core" Spoke)
    // ============================================
    ACAD: "General",     // Academic Skills
    RSST: "General",     // Research Studies
    COMM: "General",     // Communication (Standard)
    ENGL: "General",     // English (Standard)
    HIST: "General",     // History (Standard)
    SSHA: "General",     // Social Sciences
    EFFL: "General",     // Effective Learning
};

// Robust Helper Function
export function getSubjectCategory(code: string): string {
    // 1. Handle standard format "DSAI 3201"
    const prefix = code.split(' ')[0].trim().toUpperCase();

    // 2. Direct Lookup
    if (SUBJECT_MAP[prefix]) {
        return SUBJECT_MAP[prefix];
    }

    // 3. Smart Fallbacks for unknown codes
    if (prefix.startsWith('AE')) return "Engineering"; // Catch-all for new Engineering codes
    if (prefix.startsWith('HS')) return "Health";      // Catch-all for new Health codes

    return "General"; // Default fallback
}

export function calculateSubjectStats(courses: Course[]) {
    const subjects: Record<string, { points: number; credits: number; courses: string[] }> = {};

    courses.forEach(c => {
        const prefix = c.code;
        const subject = SUBJECT_MAP[prefix] || "Other";

        if (!subjects[subject]) {
            subjects[subject] = { points: 0, credits: 0, courses: [] };
        }
        subjects[subject].points += c.points;
        subjects[subject].credits += c.credits;
        subjects[subject].courses.push(c.fullCode);
    });

    return Object.keys(subjects).map(subject => {
        const { points, credits, courses } = subjects[subject];
        return {
            subject,
            gpa: credits > 0 ? parseFloat((points / credits).toFixed(2)) : 0,
            fullMark: 4.0, // For Radar Chart scaling
            courses: courses // List of courses for tooltip
        };
    });
}

export function generateResumeSummary(stats: { cgpa: string; totalCredits: number; totalCourses: number }) {
    return `Maintained a ${stats.cgpa} CGPA across ${stats.totalCredits} credits, demonstrating consistent academic performance in Data Science and Artificial Intelligence coursework.`;
}

