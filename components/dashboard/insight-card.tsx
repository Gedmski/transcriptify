'use client'
import { useMemo } from 'react'
import { generateInsight } from '@/utils/analytics'
import { Course } from '@/utils/transcript-parser'
import { TrendingUp, TrendingDown, Minus, Award, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/utils/cn'

interface InsightCardProps {
    courses: Course[];
    trends: { term: string; gpa: number }[];
    stats: { cgpa: string; totalCredits: number; totalCourses: number } | null;
}

export function InsightCard({ courses, trends, stats }: InsightCardProps) {
    const insight = useMemo(() => {
        if (!stats || courses.length === 0) return null;
        return generateInsight(courses, trends, stats);
    }, [courses, trends, stats]);

    if (!insight) return null;

    const { statusBadge, trendIndicator, narrative, keyTakeaway } = insight;

    const StatusIcon = {
        'award': Award,
        'trending-up': TrendingUp,
        'trending-down': TrendingDown,
        'alert': AlertCircle,
        'check': CheckCircle
    }[statusBadge.icon] || Lightbulb;

    const TrendIcon = trendIndicator.direction === 'up' ? TrendingUp :
        trendIndicator.direction === 'down' ? TrendingDown : Minus;

    return (
        <div
            className={cn(
                "relative p-6 rotate-1 transform transition-transform hover:rotate-0",
                "bg-[#FDFD96] text-[#2B3A42]", // Sticky note yellow
                "shadow-lg",
                "font-sans" // Patrick Hand
            )}
            style={{
                boxShadow: '5px 5px 15px rgba(0,0,0,0.2)'
            }}
        >
            {/* Tape visual */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-white/30 rotate-2 backdrop-blur-sm" />

            {/* Header */}
            <div className="border-b border-[#2B3A42]/10 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full border-2 border-[#2B3A42] text-[#2B3A42]">
                        <StatusIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Performance Insight</h3>
                        <div className="inline-block px-2 py-0.5 border-2 border-[#2B3A42] rounded-full text-xs font-bold uppercase mt-1">
                            {statusBadge.label}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg border-2 border-[#2B3A42]/20">
                    <div className="p-1 rounded-full border border-[#2B3A42]">
                        <TrendIcon className="w-4 h-4" />
                    </div>
                    <div className="text-sm font-mono">
                        <span className="opacity-70">Trend: </span>
                        <span className="font-bold">{trendIndicator.slope} GPA</span>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-sm">
                <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider border-b border-[#2B3A42]/20 pb-1">Trajectory</h4>
                    <p className="leading-relaxed">{narrative.trajectory}</p>
                </div>
                <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider border-b border-[#2B3A42]/20 pb-1">Diagnosis</h4>
                    <p className="leading-relaxed">{narrative.outlier}</p>
                </div>
                <div className="space-y-2">
                    <h4 className="font-bold uppercase tracking-wider border-b border-[#2B3A42]/20 pb-1">Strategic Advice</h4>
                    <p className="leading-relaxed">{narrative.advice}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t-2 border-dashed border-[#2B3A42]/20 flex items-start gap-3">
                <Lightbulb className="w-6 h-6 flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold text-lg">Key Takeaway: </span>
                    <span className="text-lg">{keyTakeaway}</span>
                </div>
            </div>
        </div>
    )
}
