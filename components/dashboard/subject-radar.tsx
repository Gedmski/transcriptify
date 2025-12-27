'use client'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface SubjectRadarProps {
    data: { subject: string; gpa: number; fullMark: number; courses: string[] }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-[#2B3A42] p-4 rounded-lg shadow-lg border-2 border-white text-[#EDEDED] max-w-xs font-mono">
                <p className="font-bold text-[#FDFD96] mb-2 font-sans text-lg">{data.subject}</p>
                <p className="text-sm text-[#AEC6CF] font-bold mb-2">GPA: {data.gpa}</p>
                <div className="text-xs text-[#EDEDED]/80">
                    <p className="font-bold mb-1 text-white border-b border-white/20 pb-1">Courses:</p>
                    <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                        {data.courses.map((course: string, idx: number) => (
                            <li key={idx}>{course}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }
    return null;
};

export function SubjectRadar({ data }: SubjectRadarProps) {
    return (
        <Card className="bg-[#2B3A42] border-2 border-white/80 chalk-border">
            <CardHeader>
                <CardTitle className="text-[#EDEDED]">Subject Proficiency</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#EDEDED', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 4]} tick={false} axisLine={false} />
                            <Radar
                                name="GPA"
                                dataKey="gpa"
                                stroke="#B39EB5"
                                strokeWidth={2}
                                fill="#B39EB5"
                                fillOpacity={0.4}
                            />
                            <Tooltip content={<CustomTooltip />} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
