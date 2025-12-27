'use client'
import { useState, useEffect } from 'react'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SimulatorCardProps {
    currentPoints: number;
    currentCredits: number;
}

interface HypotheticalCourse {
    id: string;
    credits: number;
    grade: string;
}

const GRADE_POINTS: Record<string, number> = {
    'A+': 4.0, 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5, 'C': 2.0, 'D+': 1.5, 'D': 1.0, 'F': 0.0
}

export function SimulatorCard({ currentPoints, currentCredits }: SimulatorCardProps) {
    const [courses, setCourses] = useState<HypotheticalCourse[]>([])
    const [projectedGPA, setProjectedGPA] = useState<string>("0.00")

    useEffect(() => {
        let newPoints = 0
        let newCredits = 0

        courses.forEach(c => {
            newPoints += c.credits * (GRADE_POINTS[c.grade] || 0)
            newCredits += c.credits
        })

        const totalPoints = currentPoints + newPoints
        const totalCredits = currentCredits + newCredits

        setProjectedGPA(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : "0.00")
    }, [courses, currentPoints, currentCredits])

    const addCourse = () => {
        setCourses([...courses, { id: Math.random().toString(), credits: 3, grade: 'A' }])
    }

    const updateCourse = (id: string, field: keyof HypotheticalCourse, value: any) => {
        setCourses(courses.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    const removeCourse = (id: string) => {
        setCourses(courses.filter(c => c.id !== id))
    }

    return (
        <Card className="bg-[#2B3A42] border-2 border-white/80 chalk-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[#EDEDED] flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-[#FDFD96]" />
                    GPA Simulator
                </CardTitle>
                <div className="text-right">
                    <p className="text-xs text-[#AEC6CF] uppercase tracking-wider font-mono">Projected CGPA</p>
                    <p className="text-3xl font-bold text-[#FDFD96] font-sans">{projectedGPA}</p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mb-6">
                    {courses.map(course => (
                        <div key={course.id} className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="w-24">
                                <Input
                                    type="number"
                                    min="1"
                                    max="9"
                                    value={course.credits}
                                    onChange={(e) => updateCourse(course.id, 'credits', parseFloat(e.target.value))}
                                    className="text-center font-mono text-lg"
                                />
                            </div>
                            <div className="flex-1">
                                <select
                                    value={course.grade}
                                    onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}
                                    className="w-full bg-transparent border-b-2 border-white/50 text-[#EDEDED] font-mono text-lg py-2 focus:outline-none focus:border-white"
                                >
                                    {Object.keys(GRADE_POINTS).map(g => (
                                        <option key={g} value={g} className="bg-[#2B3A42] text-[#EDEDED]">{g} ({GRADE_POINTS[g]})</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => removeCourse(course.id)}
                                className="text-[#FF6961] hover:text-[#FFB7B2] transition-colors p-2"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>

                <Button
                    onClick={addCourse}
                    className="w-full border-dashed border-2 border-white/30 text-[#AEC6CF] hover:bg-white/5 hover:border-white/50 hover:text-white"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Hypothetical Course
                </Button>
            </CardContent>
        </Card>
    )
}
