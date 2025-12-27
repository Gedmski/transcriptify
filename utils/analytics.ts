import { Course, SUBJECT_MAP } from './transcript-parser';

export interface InsightData {
    statusBadge: {
        label: string;
        color: string;
        icon: 'award' | 'trending-up' | 'trending-down' | 'alert' | 'check';
    };
    trendIndicator: {
        direction: 'up' | 'down' | 'flat';
        slope: string; // e.g., "+0.15"
    };
    narrative: {
        trajectory: string;
        outlier: string;
        advice: string;
    };
    keyTakeaway: string;
}

export function calculateVolatility(courses: Course[]): number {
    if (courses.length === 0) return 0;
    const points = courses.map(c => c.points / c.credits); // Get GPA per course
    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / points.length;
    return Math.sqrt(variance);
}

export function calculateCreditImpact(courses: Course[]): { highCreditGPA: number; lowCreditGPA: number } {
    const highCreditCourses = courses.filter(c => c.credits > 3);
    const lowCreditCourses = courses.filter(c => c.credits <= 3);

    const calculateGPA = (subset: Course[]) => {
        const totalPoints = subset.reduce((sum, c) => sum + c.points, 0);
        const totalCredits = subset.reduce((sum, c) => sum + c.credits, 0);
        return totalCredits > 0 ? totalPoints / totalCredits : 0;
    };

    return {
        highCreditGPA: calculateGPA(highCreditCourses),
        lowCreditGPA: calculateGPA(lowCreditCourses)
    };
}

export function calculateSubjectStrength(courses: Course[]): { strongest: string; weakest: string } {
    const subjects: Record<string, { points: number; credits: number }> = {};

    courses.forEach(c => {
        const subject = SUBJECT_MAP[c.code] || "Other";
        if (!subjects[subject]) subjects[subject] = { points: 0, credits: 0 };
        subjects[subject].points += c.points;
        subjects[subject].credits += c.credits;
    });

    const subjectGPAs = Object.entries(subjects).map(([subject, data]) => ({
        subject,
        gpa: data.credits > 0 ? data.points / data.credits : 0
    }));

    subjectGPAs.sort((a, b) => b.gpa - a.gpa);

    return {
        strongest: subjectGPAs.length > 0 ? subjectGPAs[0].subject : "N/A",
        weakest: subjectGPAs.length > 0 ? subjectGPAs[subjectGPAs.length - 1].subject : "N/A"
    };
}

export function generateInsight(courses: Course[], trends: { term: string; gpa: number }[], stats: { cgpa: string }): InsightData {
    const cgpa = parseFloat(stats.cgpa);
    const volatility = calculateVolatility(courses);
    const { highCreditGPA, lowCreditGPA } = calculateCreditImpact(courses);
    const { strongest, weakest } = calculateSubjectStrength(courses);

    // 1. Status Badge Logic
    let statusBadge: InsightData['statusBadge'] = { label: "Consistent", color: "blue", icon: "check" };
    if (cgpa >= 3.8) statusBadge = { label: "Top Performer", color: "purple", icon: "award" };
    else if (cgpa >= 3.5) statusBadge = { label: "High Achiever", color: "green", icon: "award" };
    else if (volatility > 0.7) statusBadge = { label: "Volatile", color: "orange", icon: "alert" };
    else if (cgpa < 2.5) statusBadge = { label: "At Risk", color: "red", icon: "alert" };

    // 2. Trend Indicator
    let trendIndicator: InsightData['trendIndicator'] = { direction: 'flat', slope: "0.00" };
    if (trends.length >= 2) {
        const last = trends[trends.length - 1].gpa;
        const prev = trends[trends.length - 2].gpa;
        const diff = last - prev;
        trendIndicator = {
            direction: diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat',
            slope: (diff > 0 ? '+' : '') + diff.toFixed(2)
        };
    }

    // 3. Narrative Generation

    // Trajectory
    let trajectory = "Your performance has been stable.";
    if (trends.length >= 3) {
        const last = trends[trends.length - 1].gpa;
        const mid = trends[trends.length - 2].gpa;
        const first = trends[trends.length - 3].gpa;

        if (last > mid && mid > first) trajectory = "You are on a consistent upward growth trajectory.";
        else if (last < mid && mid < first) trajectory = "Your grades have been slipping over the last few terms.";
        else if (last > mid && mid < first) trajectory = "You have successfully bounced back with a V-shaped recovery.";
        else if (last < mid && mid > first) trajectory = "You experienced a recent dip after a strong previous term.";
    }

    // Outlier / Diagnosis
    let outlier = `You demonstrate strong proficiency in ${strongest} courses.`;
    if (weakest !== strongest && weakest !== "N/A") {
        outlier += ` However, ${weakest} modules tend to drag your average down.`;
    }

    // Advice
    let advice = "Maintain your current study habits to ensure consistency.";
    if (highCreditGPA < lowCreditGPA - 0.3) {
        advice = "Focus more on high-credit courses (4.0+) as they heavily impact your CGPA.";
    } else if (volatility > 0.5) {
        advice = "Your performance varies significantly. Aim for more consistency across all subjects.";
    } else if (trendIndicator.direction === 'down') {
        advice = "Identify the root cause of the recent dip to prevent further decline.";
    } else if (cgpa > 3.5) {
        advice = "You are doing excellent. Challenge yourself with advanced electives.";
    }

    // Key Takeaway
    // Find course with highest impact (highest credits * grade points) or lowest grade
    const sortedByImpact = [...courses].sort((a, b) => (b.credits * b.points) - (a.credits * a.points));
    const highestImpact = sortedByImpact[0];
    const lowestGrade = [...courses].sort((a, b) => a.points - b.points)[0];

    let keyTakeaway = `Your strongest asset is ${highestImpact?.fullCode} (${highestImpact?.grade}).`;
    if (lowestGrade && lowestGrade.grade.startsWith('D') || lowestGrade.grade === 'F') {
        keyTakeaway = `Retaking ${lowestGrade.fullCode} could significantly boost your CGPA.`;
    }

    return {
        statusBadge,
        trendIndicator,
        narrative: {
            trajectory,
            outlier,
            advice
        },
        keyTakeaway
    };
}
