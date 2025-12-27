import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MetricsCardsProps {
    cgpa: string;
    totalCredits: number;
    totalCourses: number;
}

export function MetricsCards({ cgpa, totalCredits, totalCourses }: MetricsCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-[#AEC6CF] uppercase tracking-wider font-mono">CGPA</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-[#EDEDED] font-sans">{cgpa}</span>
                        <span className="ml-2 text-sm text-[#AEC6CF] font-mono">/ 4.00</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-[#AEC6CF] uppercase tracking-wider font-mono">Total Credits</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-[#EDEDED] font-sans">{totalCredits.toFixed(1)}</span>
                        <span className="ml-2 text-sm text-[#AEC6CF] font-mono">Earned</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-[#AEC6CF] uppercase tracking-wider font-mono">Total Courses</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-[#EDEDED] font-sans">{totalCourses}</span>
                        <span className="ml-2 text-sm text-[#AEC6CF] font-mono">Completed</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
