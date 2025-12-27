'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface GradeDistributionProps {
    data: { grade: string; count: number; credits: number; courses: string[] }[]
}

const COLORS = ['#FDFD96', '#FFB7B2', '#AEC6CF', '#B39EB5', '#FF6961', '#77DD77', '#CFCFC4'];

const CustomTooltip = ({ active, payload, label, mode }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#2B3A42] border-2 border-white/50 p-3 rounded-lg shadow-xl chalk-border">
                <p className="text-[#FDFD96] font-bold text-lg mb-1 font-sans">{label}</p>
                <p className="text-[#EDEDED] font-mono text-sm mb-2">
                    {mode === 'count' ? `${data.count} Course${data.count !== 1 ? 's' : ''}` : `${data.credits} Credits`}
                </p>
                {data.courses && data.courses.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {data.courses.map((course: string, i: number) => (
                            <span key={i} className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-[#AEC6CF] font-mono">
                                {course}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        )
    }
    return null
}

export function GradeDistribution({ data }: GradeDistributionProps) {
    const [mode, setMode] = useState<'count' | 'credits'>('count')

    return (
        <Card className="bg-[#2B3A42] border-2 border-white/80 chalk-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[#EDEDED] font-sans text-2xl">Grade Distribution</CardTitle>
                <div className="flex bg-white/10 rounded-full p-1 border border-white/20">
                    <button
                        onClick={() => setMode('count')}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all font-mono ${mode === 'count' ? 'bg-[#EDEDED] text-[#2B3A42]' : 'text-[#EDEDED] hover:text-white'
                            }`}
                    >
                        Count
                    </button>
                    <button
                        onClick={() => setMode('credits')}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all font-mono ${mode === 'credits' ? 'bg-[#EDEDED] text-[#2B3A42]' : 'text-[#EDEDED] hover:text-white'
                            }`}
                    >
                        Credits
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis
                                dataKey="grade"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#EDEDED', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                            />
                            <YAxis
                                allowDecimals={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#EDEDED', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                            />
                            <Tooltip
                                content={<CustomTooltip mode={mode} />}
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                            />
                            <Bar dataKey={mode} radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={1} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
