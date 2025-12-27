'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { DropZone } from '@/components/ui/drop-zone'
import { MetricsCards } from '@/components/dashboard/metrics-cards'
import { TrendGraph } from '@/components/dashboard/trend-graph'
import { GradeDistribution } from '@/components/dashboard/grade-distribution'
import { SimulatorCard } from '@/components/dashboard/simulator-card'
import { SubjectRadar } from '@/components/dashboard/subject-radar'
import { CourseList } from '@/components/dashboard/course-list'
import { InsightCard } from '@/components/dashboard/insight-card'
import { Button } from '@/components/ui/button'
import {
  parseTranscript,
  calculateStats,
  calculateTrends,
  calculateGradeDistribution,
  calculateSubjectStats,
  Course,
  SUBJECT_MAP
} from '@/utils/transcript-parser'
import { Trash2 } from 'lucide-react'

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filter States
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>('All')
  const [selectedSeason, setSelectedSeason] = useState<string>('All')

  const containerRef = useRef<HTMLDivElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('transcriptify_data')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCourses(parsed)
        }
      } catch (e) {
        console.error("Failed to load saved data", e)
      }
    }
  }, [])

  // GSAP Dust Off Transition
  useEffect(() => {
    if (courses.length > 0 && containerRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(containerRef.current,
          { filter: "blur(8px)", opacity: 0.8 },
          { filter: "blur(0px)", opacity: 1, duration: 0.6, ease: "power2.out" }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [selectedTerm, courses.length, selectedYear, selectedSeason])

  // Derived State: Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const parts = c.term.split(' ')
      const cSeason = parts[0]
      const cYear = parts[1] || ''

      const termMatch = !selectedTerm || c.term === selectedTerm
      const subjectMatch = !selectedSubject || (SUBJECT_MAP[c.code] || "Other") === selectedSubject
      const yearMatch = selectedYear === 'All' || cYear === selectedYear
      const seasonMatch = selectedSeason === 'All' || cSeason === selectedSeason

      return termMatch && subjectMatch && yearMatch && seasonMatch
    })
  }, [courses, selectedTerm, selectedSubject, selectedYear, selectedSeason])

  // Derived State: Stats based on Filtered Courses
  const trendCourses = useMemo(() => {
    return courses.filter(c => {
      const parts = c.term.split(' ')
      const cSeason = parts[0]
      const cYear = parts[1] || ''

      const subjectMatch = !selectedSubject || (SUBJECT_MAP[c.code] || "Other") === selectedSubject
      const yearMatch = selectedYear === 'All' || cYear === selectedYear
      const seasonMatch = selectedSeason === 'All' || cSeason === selectedSeason

      return subjectMatch && yearMatch && seasonMatch
    })
  }, [courses, selectedSubject, selectedYear, selectedSeason])

  const stats = useMemo(() => calculateStats(filteredCourses), [filteredCourses])
  const trends = useMemo(() => calculateTrends(trendCourses), [trendCourses])
  const distribution = useMemo(() => calculateGradeDistribution(filteredCourses), [filteredCourses])
  const subjectStats = useMemo(() => calculateSubjectStats(filteredCourses), [filteredCourses])

  const handleFile = async (file: File) => {
    setIsParsing(true)
    setError(null)
    try {
      // Dynamically import pdfjs-dist to avoid SSR issues with DOMMatrix
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        // @ts-ignore
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n'
      }

      const parsedCourses = parseTranscript(fullText)
      if (parsedCourses.length === 0) {
        setError("No courses found. Please ensure this is a valid UDST transcript.")
      } else {
        setCourses(parsedCourses)
        localStorage.setItem('transcriptify_data', JSON.stringify(parsedCourses))
      }
    } catch (err) {
      console.error(err)
      setError("Failed to parse PDF. Please try again.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleReset = () => {
    // Trigger wipe out animation before resetting?
    // For now, just reset and let the enter animation play if we want, or just clear.
    setCourses([])
    setSelectedTerm(null)
    setSelectedSubject(null)
    localStorage.removeItem('transcriptify_data')
  }

  const handleTermClick = (term: string) => {
    setSelectedTerm(term === selectedTerm ? null : term)
  }

  return (
    <main className="min-h-screen p-8 font-sans relative overflow-x-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#FDFD96] font-sans">Transcriptify</h1>
            <p className="text-[#AEC6CF] mt-2 font-mono">Visualize your UDST academic performance.</p>
          </div>
          {courses.length > 0 && (
            <Button
              onClick={handleReset}
              className="border-red-400/50 text-red-200 hover:bg-red-900/20 hover:border-red-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Board
            </Button>
          )}
        </header>

        {courses.length === 0 ? (
          <div className="max-w-xl mx-auto mt-20">
            <DropZone onFileAccepted={handleFile} />
            {isParsing && (
              <div className="mt-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#FDFD96] border-t-transparent"></div>
                <p className="mt-2 text-[#EDEDED]">Parsing transcript...</p>
              </div>
            )}
            {error && (
              <div className="mt-6 p-4 bg-red-900/20 text-red-200 rounded-lg text-center border border-red-500/30 chalk-border">
                {error}
              </div>
            )}
            <div className="mt-12 text-center text-sm text-[#AEC6CF]">
              <p>Privacy First: Your transcript is processed 100% in your browser.</p>
              <p>No data is ever sent to a server.</p>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="space-y-8">
            <InsightCard courses={filteredCourses} trends={trends} stats={stats} />

            {stats && (
              <MetricsCards
                cgpa={stats.cgpa}
                totalCredits={stats.totalCredits}
                totalCourses={stats.totalCourses}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TrendGraph data={trends} onTermClick={handleTermClick} />
              <GradeDistribution data={distribution} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SimulatorCard
                currentPoints={courses.reduce((acc, c) => acc + c.points, 0)}
                currentCredits={courses.reduce((acc, c) => acc + c.credits, 0)}
              />
              <SubjectRadar data={subjectStats} />
            </div>

            <CourseList
              courses={filteredCourses}
              allCourses={courses}
              selectedTerm={selectedTerm}
              selectedSubject={selectedSubject}
              onSubjectFilterChange={setSelectedSubject}
              selectedYear={selectedYear}
              onYearFilterChange={setSelectedYear}
              selectedSeason={selectedSeason}
              onSeasonFilterChange={setSelectedSeason}
              stats={stats}
            />
          </div>
        )}
      </div>
    </main>
  )
}
