'use client'
import { useState } from 'react'
import { Course, generateResumeSummary, SUBJECT_MAP } from '@/utils/transcript-parser'
import { Copy, Check, Filter, Calendar } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CourseListProps {
    courses: Course[];
    allCourses: Course[];
    selectedTerm: string | null;
    selectedSubject: string | null;
    onSubjectFilterChange: (subject: string | null) => void;
    selectedYear: string;
    onYearFilterChange: (year: string) => void;
    selectedSeason: string;
    onSeasonFilterChange: (season: string) => void;
    stats: any;
}

export function CourseList({
    courses,
    allCourses,
    selectedTerm,
    selectedSubject,
    onSubjectFilterChange,
    selectedYear,
    onYearFilterChange,
    selectedSeason,
    onSeasonFilterChange,
    stats
}: CourseListProps) {
    const [copied, setCopied] = useState(false)

    const subjects = Array.from(new Set(Object.values(SUBJECT_MAP))).sort()

    // Extract unique years and terms from ALL courses to populate dropdowns
    // Filter years to only include 4-digit numbers
    const years = Array.from(new Set(allCourses.map(c => c.term.split(' ')[1]).filter(y => y && /^\d{4}$/.test(y)))).sort().reverse()
    const terms = Array.from(new Set(allCourses.map(c => c.term.split(' ')[0]))).sort()

    const copyResumeBullet = () => {
        const text = generateResumeSummary(stats)
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="mt-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-3xl font-bold text-[#FDFD96] font-sans">
                        {selectedTerm ? `${selectedTerm} Courses` : "Course History"}
                    </h3>
                    <p className="text-sm text-[#AEC6CF] mt-1 font-mono">
                        Showing {courses.length} courses {selectedSubject ? `in ${selectedSubject}` : ''}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Year Filter */}
                    <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#AEC6CF]" />
                        <select
                            value={selectedYear}
                            onChange={(e) => onYearFilterChange(e.target.value)}
                            className="pl-9 pr-8 py-2 text-sm border-2 border-white/30 rounded-full bg-[#2B3A42] text-[#EDEDED] focus:border-white focus:outline-none appearance-none font-mono"
                        >
                            <option value="All">All Years</option>
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Term Filter */}
                    <div className="relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#AEC6CF]" />
                        <select
                            value={selectedSeason}
                            onChange={(e) => onSeasonFilterChange(e.target.value)}
                            className="pl-9 pr-8 py-2 text-sm border-2 border-white/30 rounded-full bg-[#2B3A42] text-[#EDEDED] focus:border-white focus:outline-none appearance-none font-mono"
                        >
                            <option value="All">All Terms</option>
                            {terms.map(term => (
                                <option key={term} value={term}>{term}</option>
                            ))}
                        </select>
                    </div>

                    {/* Subject Filter */}
                    <div className="relative">
                        <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-[#AEC6CF]" />
                        <select
                            value={selectedSubject || ''}
                            onChange={(e) => onSubjectFilterChange(e.target.value || null)}
                            className="pl-9 pr-8 py-2 text-sm border-2 border-white/30 rounded-full bg-[#2B3A42] text-[#EDEDED] focus:border-white focus:outline-none appearance-none font-mono"
                        >
                            <option value="">All Subjects</option>
                            {subjects.map(subject => (
                                <option key={subject} value={subject}>{subject}</option>
                            ))}
                        </select>
                    </div>

                    <Button
                        onClick={copyResumeBullet}
                        className="bg-[#EDEDED] text-[#2B3A42] hover:bg-white border-none font-bold font-mono text-xs"
                    >
                        {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                        {copied ? "Copied!" : "Copy Resume Bullet"}
                    </Button>
                </div>
            </div>

            <Card className="bg-[#2B3A42] border-2 border-white/80 chalk-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#EDEDED] font-mono">
                        <thead className="bg-white/5 text-[#FDFD96] font-sans text-lg border-b-2 border-white/20">
                            <tr>
                                <th className="px-6 py-4 font-normal">Term</th>
                                <th className="px-6 py-4 font-normal">Code</th>
                                <th className="px-6 py-4 font-normal">Title</th>
                                <th className="px-6 py-4 font-normal">Credits</th>
                                <th className="px-6 py-4 font-normal">Grade</th>
                                <th className="px-6 py-4 font-normal">Points</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {courses.map((course, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 text-[#AEC6CF]">{course.term}</td>
                                    <td className="px-6 py-4 font-bold text-[#EDEDED] group-hover:text-white">{course.fullCode}</td>
                                    <td className="px-6 py-4">{course.title}</td>
                                    <td className="px-6 py-4">{course.credits.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border-2 ${course.grade.startsWith('A') ? 'border-[#77DD77] text-[#77DD77]' :
                                            course.grade.startsWith('B') ? 'border-[#AEC6CF] text-[#AEC6CF]' :
                                                course.grade.startsWith('C') ? 'border-[#FDFD96] text-[#FDFD96]' :
                                                    'border-[#FF6961] text-[#FF6961]'
                                            }`}>
                                            {course.grade}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{course.points.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}
