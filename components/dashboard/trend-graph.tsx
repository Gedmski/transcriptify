'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'

interface TrendGraphProps {
    data: { term: string; gpa: number; cumulative: number }[];
    onTermClick: (term: string) => void;
}

export function TrendGraph({ data, onTermClick }: TrendGraphProps) {
    return (
        <Card className="relative overflow-hidden bg-[#2B3A42] border-2 border-white/80 chalk-border">
            <CardHeader>
                <CardTitle className="text-[#EDEDED]">GPA Trend</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={data}
                            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                            onClick={(e) => {
                                if (e && e.activeLabel) {
                                    onTermClick(String(e.activeLabel))
                                }
                            }}
                        >
                            <defs>
                                <filter id="chalk-stroke">
                                    <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise" />
                                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
                                </filter>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.1)" />
                            <XAxis
                                dataKey="term"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#EDEDED', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                                dy={10}
                            />
                            <YAxis
                                domain={[0, 4]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#EDEDED', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#2B3A42',
                                    borderRadius: '8px',
                                    border: '2px solid #fff',
                                    color: '#EDEDED',
                                    fontFamily: 'var(--font-mono)'
                                }}
                                itemStyle={{ color: '#EDEDED' }}
                                labelStyle={{ color: '#FDFD96', fontFamily: 'var(--font-sans)', fontSize: '1.2em' }}
                            />
                            <Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', color: '#EDEDED' }} />
                            <Line
                                type="monotone"
                                dataKey="gpa"
                                stroke="var(--chalk-blue)"
                                strokeWidth={3}
                                filter="url(#chalk-stroke)"
                                dot={{ r: 5, fill: 'var(--chalk-blue)', strokeWidth: 0 }}
                                activeDot={{ r: 7, fill: 'var(--chalk-blue)', stroke: '#fff', strokeWidth: 2 }}
                                name="Term GPA"
                                animationDuration={2000}
                                animationEasing="ease-in-out"
                            />
                            <Line
                                type="monotone"
                                dataKey="cumulative"
                                stroke="var(--chalk-pink)"
                                strokeWidth={3}
                                filter="url(#chalk-stroke)"
                                dot={{ r: 5, fill: 'var(--chalk-pink)', strokeWidth: 0 }}
                                activeDot={{ r: 7, fill: 'var(--chalk-pink)', stroke: '#fff', strokeWidth: 2 }}
                                name="Cumulative GPA"
                                animationDuration={2500}
                                animationEasing="ease-in-out"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
