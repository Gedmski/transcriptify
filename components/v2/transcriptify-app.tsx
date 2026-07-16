'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Download,
  FileCheck2,
  FileJson,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  Printer,
  RefreshCcw,
  Route,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { parseUdSTTranscript } from '@/domain/udst-parser'
import {
  AcademicPlan,
  CourseAttempt,
  GRADE_POINTS,
  TranscriptDocument,
  calculateStats,
  calculatePrefixStats,
  calculateTermStats,
  gradeStatus,
  normalizeGrade,
  reconcileRepeats,
  solveTargetCgpa,
  migrateTranscriptDocument,
} from '@/domain/transcript'
import { ProgramDataset, ProgramPlan, UdSTProgram, programProgress, selectProgramPlan } from '@/domain/programs'
import { academicPlanKey, buildAcademicTimeline, calculatePlanProjection, createAcademicPlan, remainingProgramCredits } from '@/domain/planning'
import { AcademicTimeline, CourseFamilyRadar, CourseGradePlanner, DetailedAcademicReport } from './academic-analytics'
import { TermPicker } from './term-combobox'

type View = 'overview' | 'courses' | 'plan' | 'report' | 'privacy'
type PersistenceMode = 'session' | 'device' | 'clear-after-export'

const STORAGE_KEY = 'transcriptify_v2_document'
const MODE_KEY = 'transcriptify_v2_persistence'
const gradeOptions = Object.keys(GRADE_POINTS)

const demoAttempts: Omit<CourseAttempt, 'original'>[] = [
  { id: 'demo-1', term: 'Fall 2024', code: 'COMM', number: '1010', fullCode: 'COMM1010', title: 'English Communication I', credits: 3, grade: 'B+', gradePoints: 3.5, points: 10.5, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-2', term: 'Fall 2024', code: 'INFS', number: '1101', fullCode: 'INFS1101', title: 'Introduction to Computing & Problem Solving', credits: 3, grade: 'A', gradePoints: 4, points: 12, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-3', term: 'Winter 2025', code: 'MATH', number: '1030', fullCode: 'MATH1030', title: 'Calculus I', credits: 3, grade: 'C+', gradePoints: 2.5, points: 7.5, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-4', term: 'Winter 2025', code: 'INFS', number: '1201', fullCode: 'INFS1201', title: 'Computer Programming', credits: 4, grade: 'B', gradePoints: 3, points: 12, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-5', term: 'Fall 2025', code: 'MATH', number: '1030', fullCode: 'MATH1030', title: 'Calculus I', credits: 3, grade: 'B+', gradePoints: 3.5, points: 10.5, includedInGpa: true, status: 'completed', validation: 'warning', warning: 'Higher repeated attempt included under UDST policy.' },
  { id: 'demo-6', term: 'Fall 2025', code: 'INFS', number: '2201', fullCode: 'INFS2201', title: 'Object-Oriented Programming', credits: 4, grade: 'A', gradePoints: 4, points: 16, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-7', term: 'Fall 2025', code: 'DSAI', number: '2201', fullCode: 'DSAI2201', title: 'Introduction to Data Science & AI', credits: 3, grade: 'A', gradePoints: 4, points: 12, includedInGpa: true, status: 'completed', validation: 'verified' },
  { id: 'demo-8', term: 'Winter 2026', code: 'DSAI', number: '3201', fullCode: 'DSAI3201', title: 'Machine Learning', credits: 3, grade: 'B+', gradePoints: 3.5, points: 10.5, includedInGpa: true, status: 'completed', validation: 'verified' },
]

function createDemoDocument(): TranscriptDocument {
  const attempts = reconcileRepeats(demoAttempts.map((attempt) => ({
    ...attempt,
    original: {
      term: attempt.term,
      fullCode: attempt.fullCode,
      title: attempt.title,
      credits: attempt.credits,
      grade: attempt.grade,
      points: attempt.points,
    },
  })))
  return {
    schemaVersion: 3,
    institutionId: 'udst',
    adapterVersion: 'udst-2026.1',
    importedAt: new Date().toISOString(),
    programId: 'bachelor-of-science-in-data-science-and-artificial-intelligence-b-sc-dsai',
    programPlanSelection: 'inferred',
    verificationStatus: 'verified',
    attempts,
    warnings: ['Synthetic demo data — not a real student record.'],
  }
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number | boolean | null) {
  const raw = String(value ?? '')
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

function shortProgramName(program?: UdSTProgram) {
  if (!program) return 'Program not selected'
  return program.name.replace(/\s*\([^)]*\)\s*$/, '')
}

export function TranscriptifyApp() {
  const [transcript, setTranscript] = useState<TranscriptDocument | null>(null)
  const [stage, setStage] = useState<'import' | 'review' | 'dashboard'>('import')
  const [view, setView] = useState<View>('overview')
  const [programs, setPrograms] = useState<UdSTProgram[]>([])
  const [persistence, setPersistence] = useState<PersistenceMode>('session')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [search, setSearch] = useState('')
  const [targetCgpa, setTargetCgpa] = useState(3.2)
  const [futureCredits, setFutureCredits] = useState(30)
  const [programQuery, setProgramQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY) as PersistenceMode | null
    if (storedMode) setPersistence(storedMode)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = migrateTranscriptDocument(JSON.parse(saved))
        if (parsed) {
          setTranscript(parsed)
          setStage('dashboard')
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    import('@/data/udst-programs.json').then((module) => {
      const dataset = module.default as ProgramDataset
      setPrograms(dataset.programs)
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(MODE_KEY, persistence)
    if (!transcript) return
    if (persistence === 'device' || persistence === 'clear-after-export') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transcript))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [persistence, transcript])

  const stats = useMemo(() => calculateStats(transcript?.attempts ?? []), [transcript])
  const terms = useMemo(() => calculateTermStats(transcript?.attempts ?? []), [transcript])
  const selectedProgram = programs.find((program) => program.id === transcript?.programId)
  const planSelection = selectedProgram && transcript
    ? selectProgramPlan(
      selectedProgram,
      transcript.attempts,
      transcript.programPlanSelection === 'manual' ? transcript.programPlanVersion : undefined,
    )
    : null
  const selectedPlan = planSelection?.plan
  const activePlanKey = selectedProgram && selectedPlan ? academicPlanKey(selectedProgram.id, selectedPlan.version) : undefined
  const academicPlan = useMemo(() => {
    if (!selectedProgram || !selectedPlan || !transcript) return undefined
    const existing = activePlanKey ? transcript.academicPlans?.[activePlanKey] : undefined
    return createAcademicPlan(selectedProgram.id, selectedPlan, transcript.attempts, existing)
  }, [activePlanKey, selectedPlan, selectedProgram, transcript])
  const degreeProgress = useMemo(
    () => selectedPlan && transcript ? programProgress(selectedPlan, transcript.attempts, academicPlan) : null,
    [academicPlan, selectedPlan, transcript],
  )
  const automaticFutureCredits = degreeProgress
    ? remainingProgramCredits(degreeProgress.requiredCredits, degreeProgress.completedCredits)
    : null
  const timeline = useMemo(
    () => selectedPlan && transcript && academicPlan ? buildAcademicTimeline(selectedPlan, transcript.attempts, academicPlan) : undefined,
    [academicPlan, selectedPlan, transcript],
  )
  const planProjection = useMemo(
    () => selectedPlan && transcript && academicPlan ? calculatePlanProjection(stats, selectedPlan, transcript.attempts, academicPlan) : undefined,
    [academicPlan, selectedPlan, stats, transcript],
  )
  const target = useMemo(() => solveTargetCgpa(stats, targetCgpa, futureCredits), [stats, targetCgpa, futureCredits])
  const filteredAttempts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return transcript?.attempts ?? []
    return transcript?.attempts.filter((attempt) =>
      `${attempt.fullCode} ${attempt.title} ${attempt.term} ${attempt.grade}`.toLowerCase().includes(query),
    ) ?? []
  }, [search, transcript])

  useEffect(() => {
    if (!transcript || !academicPlan || !activePlanKey || transcript.academicPlans?.[activePlanKey]) return
    setTranscript((current) => current ? {
      ...current,
      academicPlans: { ...(current.academicPlans ?? {}), [activePlanKey]: academicPlan },
    } : current)
  }, [academicPlan, activePlanKey, transcript])

  useEffect(() => {
    if (automaticFutureCredits === null) return
    setFutureCredits(automaticFutureCredits)
  }, [activePlanKey, automaticFutureCredits])

  const persistTranscript = (next: TranscriptDocument) => setTranscript(next)

  const persistAcademicPlan = (nextPlan: AcademicPlan) => {
    if (!transcript) return
    const key = academicPlanKey(nextPlan.programId, nextPlan.planVersion)
    persistTranscript({ ...transcript, academicPlans: { ...(transcript.academicPlans ?? {}), [key]: { ...nextPlan, updatedAt: new Date().toISOString() } } })
  }

  const updatePlanEntry = (entryId: string, patch: Partial<{ courseCode: string; plannedTerm: string; expectedGrade: string }>) => {
    if (!academicPlan) return
    persistAcademicPlan({ ...academicPlan, entries: academicPlan.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry) })
  }

  const updatePlanStartTerm = (startTerm: string) => {
    if (!academicPlan) return
    persistAcademicPlan({ ...academicPlan, startTerm })
  }

  const handleFile = async (file: File) => {
    setError('')
    setProgress('Checking PDF signature and file limits…')
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('This PDF is larger than the 15 MB local-processing limit.')
      const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
      if (file.type !== 'application/pdf' || signature !== '%PDF-') throw new Error('Choose a valid text-based PDF transcript.')

      setProgress('Reading pages locally…')
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
      const pdf = await loadingTask.promise
      if (pdf.numPages > 50) throw new Error('This transcript exceeds the 50-page processing limit.')

      let rawText = ''
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setProgress(`Extracting page ${pageNumber} of ${pdf.numPages}…`)
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        rawText += `${pageText}\n`
      }

      setProgress('Validating courses against UDST grade rules…')
      const parsed = parseUdSTTranscript(rawText)
      if (!parsed.attempts.length) throw new Error('No supported course rows were found. Scanned PDFs need OCR before import.')
      setTranscript(parsed)
      setReviewConfirmed(false)
      setStage('review')
      setProgress('')
    } catch (caught) {
      setProgress('')
      setError(caught instanceof Error ? caught.message : 'The PDF could not be processed.')
    }
  }

  const updateAttempt = (id: string, field: keyof CourseAttempt, value: string | number | boolean) => {
    if (!transcript) return
    const attempts = transcript.attempts.map((attempt) => {
      if (attempt.id !== id) return attempt
      const updated = { ...attempt, [field]: value }
      if (field === 'grade') {
        const grade = normalizeGrade(String(value))
        updated.grade = grade
        updated.gradePoints = GRADE_POINTS[grade] ?? null
        updated.points = updated.gradePoints === null ? 0 : updated.credits * updated.gradePoints
        updated.status = gradeStatus(grade)
        updated.includedInGpa = updated.gradePoints !== null
      }
      if (field === 'credits') {
        updated.credits = Math.max(0, Number(value) || 0)
        updated.points = updated.gradePoints === null ? 0 : updated.credits * updated.gradePoints
      }
      updated.validation = updated.credits > 12 || !updated.fullCode ? 'invalid' : 'verified'
      updated.warning = updated.validation === 'invalid' ? 'Complete the course code and use credits from 0 to 12.' : undefined
      return updated
    })
    persistTranscript({ ...transcript, attempts: reconcileRepeats(attempts) })
  }

  const addAttempt = () => {
    if (!transcript) return
    const id = crypto.randomUUID()
    const attempt: CourseAttempt = {
      id,
      term: 'Fall 2026',
      code: 'COUR',
      number: '1000',
      fullCode: 'COUR1000',
      title: 'New course',
      credits: 3,
      grade: 'B',
      gradePoints: 3,
      points: 9,
      includedInGpa: true,
      status: 'completed',
      validation: 'warning',
      warning: 'Manually added course — verify against the transcript.',
      original: { term: '', fullCode: '', title: '', credits: 0, grade: '', points: 0 },
    }
    persistTranscript({ ...transcript, attempts: [...transcript.attempts, attempt] })
  }

  const undoAttempt = (attempt: CourseAttempt) => {
    if (!transcript) return
    const [code = '', number = ''] = attempt.original.fullCode.match(/^([A-Z]+)(\d.*)$/)?.slice(1) ?? ['', '']
    const grade = normalizeGrade(attempt.original.grade)
    const restored: CourseAttempt = {
      ...attempt,
      ...attempt.original,
      code,
      number,
      gradePoints: GRADE_POINTS[grade] ?? null,
      includedInGpa: (GRADE_POINTS[grade] ?? null) !== null,
      status: gradeStatus(grade),
      validation: 'verified',
      warning: undefined,
    }
    persistTranscript({ ...transcript, attempts: transcript.attempts.map((item) => item.id === attempt.id ? restored : item) })
  }

  const confirmReview = () => {
    if (!transcript) return
    const hasInvalid = transcript.attempts.some((attempt) => attempt.validation === 'invalid')
    if (hasInvalid) {
      setError('Resolve invalid rows before opening the report.')
      return
    }
    persistTranscript({ ...transcript, verificationStatus: 'verified' })
    setStage('dashboard')
    setView('overview')
    setError('')
  }

  const setProgram = (programId: string) => {
    if (!transcript) return
    persistTranscript({
      ...transcript,
      programId,
      programPlanVersion: undefined,
      programPlanSelection: 'inferred',
    })
    setProgramQuery('')
  }

  const setPlanVersion = (version: string) => {
    if (!transcript) return
    persistTranscript({ ...transcript, programPlanVersion: version, programPlanSelection: 'manual' })
  }

  const useRecommendedPlan = () => {
    if (!transcript) return
    persistTranscript({ ...transcript, programPlanVersion: undefined, programPlanSelection: 'inferred' })
  }

  const exportJson = () => {
    if (!transcript) return
    downloadFile('transcriptify-data.json', JSON.stringify({ schemaVersion: 3, transcript, program: selectedProgram?.name, studyPlan: selectedPlan?.version }, null, 2), 'application/json')
    if (persistence === 'clear-after-export') clearAll()
  }

  const exportCsv = () => {
    if (!transcript) return
    const headers = ['term', 'course_code', 'title', 'credits', 'grade', 'grade_points', 'quality_points', 'included_in_gpa']
    const rows = transcript.attempts.map((attempt) => [attempt.term, attempt.fullCode, attempt.title, attempt.credits, attempt.grade, attempt.gradePoints, attempt.points, attempt.includedInGpa])
    downloadFile('transcriptify-courses.csv', [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8')
    if (persistence === 'clear-after-export') clearAll()
  }

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY)
    setTranscript(null)
    setStage('import')
    setView('overview')
    setError('')
  }

  if (stage === 'import') {
    return (
      <main className="landing-shell">
        <header className="landing-header">
          <Brand />
          <button className="text-button" onClick={() => setView('privacy')}><ShieldCheck size={17} /> Local by design</button>
        </header>
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span>v2</span> UDST academic decision workspace</p>
            <h1>Know where you stand.<br /><em>Plan what comes next.</em></h1>
            <p className="hero-lede">Import your transcript privately, verify every course, and get a program-aware academic report grounded in official UDST rules.</p>
            <div className="trust-row" aria-label="Privacy assurances">
              <span><Check size={16} /> Runs in your browser</span>
              <span><Check size={16} /> Editable before analysis</span>
              <span><Check size={16} /> 83 UDST programs</span>
            </div>
          </div>
          <div className="upload-board">
            <div className="board-pin" />
            <p className="board-kicker">Start with your transcript</p>
            <button className="drop-target" onClick={() => fileInputRef.current?.click()} disabled={!!progress}>
              <span className="upload-icon"><Upload size={28} /></span>
              <strong>{progress || 'Choose a UDST transcript PDF'}</strong>
              <span>{progress ? 'Keep this tab open — your file stays here.' : 'Text-based PDF · up to 15 MB · 50 pages'}</span>
            </button>
            <input ref={fileInputRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
            {error && <div className="error-note" role="alert"><AlertTriangle size={18} /> {error}</div>}
            <div className="or-divider"><span>or</span></div>
            <button className="demo-button" onClick={() => { setTranscript(createDemoDocument()); setStage('dashboard') }}>
              <Sparkles size={18} /> Explore with synthetic demo data <ArrowRight size={18} />
            </button>
          </div>
        </section>
        <section className="promise-strip">
          <div><span>01</span><strong>Import</strong><p>Validate the PDF and extract course attempts locally.</p></div>
          <div><span>02</span><strong>Verify</strong><p>Correct uncertain fields before any conclusions appear.</p></div>
          <div><span>03</span><strong>Decide</strong><p>See standing, degree progress, and realistic GPA paths.</p></div>
        </section>
      </main>
    )
  }

  if (stage === 'review' && transcript) {
    const warnings = transcript.attempts.filter((attempt) => attempt.validation !== 'verified').length
    return (
      <main className="review-shell">
        <header className="app-topbar"><Brand /><span className="privacy-badge"><ShieldCheck size={16} /> On-device review</span></header>
        <section className="review-heading">
          <div>
            <p className="eyebrow"><span>Step 2</span> Verify the import</p>
            <h1>Check the rows before the numbers.</h1>
            <p>{transcript.attempts.length} course attempts found · {warnings} need attention · edits recalculate instantly</p>
          </div>
          <div className="reconcile-card">
            <span>Calculated CGPA</span><strong>{stats.cgpa.toFixed(2)}</strong><small>{stats.totalCredits.toFixed(1)} GPA credits · {stats.excludedAttempts} excluded</small>
          </div>
        </section>
        {transcript.warnings.length > 0 && <div className="review-alert"><AlertTriangle size={20} /><div><strong>Review notes</strong><p>{transcript.warnings.join(' ')}</p></div></div>}
        <section className="review-table-wrap">
          <div className="review-toolbar"><strong>Extracted course attempts</strong><button className="secondary-button" onClick={addAttempt}><Plus size={16} /> Add course</button></div>
          <div className="review-table-scroll">
            <table className="review-table">
              <thead><tr><th>Status</th><th>Term</th><th>Course</th><th>Title</th><th>Credits</th><th>Grade</th><th>Included</th><th>Undo</th></tr></thead>
              <tbody>{transcript.attempts.map((attempt) => (
                <tr key={attempt.id} className={`row-${attempt.validation}`}>
                  <td><span className={`status-dot ${attempt.validation}`} title={attempt.warning}>{attempt.validation === 'verified' ? <Check size={14} /> : <AlertTriangle size={14} />}</span></td>
                  <td><input aria-label={`${attempt.fullCode} term`} value={attempt.term} onChange={(e) => updateAttempt(attempt.id, 'term', e.target.value)} /></td>
                  <td><input aria-label="Course code" value={attempt.fullCode} onChange={(e) => updateAttempt(attempt.id, 'fullCode', e.target.value.toUpperCase().replace(/\s/g, ''))} /></td>
                  <td><input aria-label={`${attempt.fullCode} title`} value={attempt.title} onChange={(e) => updateAttempt(attempt.id, 'title', e.target.value)} /></td>
                  <td><input aria-label={`${attempt.fullCode} credits`} type="number" min="0" max="12" step="0.5" value={attempt.credits} onChange={(e) => updateAttempt(attempt.id, 'credits', Number(e.target.value))} /></td>
                  <td><select aria-label={`${attempt.fullCode} grade`} value={attempt.grade} onChange={(e) => updateAttempt(attempt.id, 'grade', e.target.value)}>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select></td>
                  <td><label className="switch-label"><input type="checkbox" checked={attempt.includedInGpa} onChange={(e) => updateAttempt(attempt.id, 'includedInGpa', e.target.checked)} /><span>{attempt.includedInGpa ? 'Yes' : 'No'}</span></label></td>
                  <td><button className="icon-button" aria-label={`Undo changes to ${attempt.fullCode}`} onClick={() => undoAttempt(attempt)}><RotateCcw size={16} /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        {error && <div className="error-note" role="alert"><AlertTriangle size={18} /> {error}</div>}
        <footer className="review-footer">
          <button className="text-button" onClick={clearAll}><X size={17} /> Cancel import</button>
          <label className="confirm-check"><input type="checkbox" checked={reviewConfirmed} onChange={(e) => setReviewConfirmed(e.target.checked)} /><span>I checked flagged rows and understand this is an unofficial planning tool.</span></label>
          <button className="primary-button" disabled={!reviewConfirmed} onClick={confirmReview}>Confirm & open report <ArrowRight size={18} /></button>
        </footer>
      </main>
    )
  }

  if (!transcript) return null

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Primary navigation">
          <NavButton active={view === 'overview'} icon={<LayoutDashboard />} label="Overview" onClick={() => setView('overview')} />
          <NavButton active={view === 'courses'} icon={<BookOpen />} label="Courses" onClick={() => setView('courses')} />
          <NavButton active={view === 'plan'} icon={<Target />} label="Plan" onClick={() => setView('plan')} />
          <NavButton active={view === 'report'} icon={<FileCheck2 />} label="Report" onClick={() => setView('report')} />
          <NavButton active={view === 'privacy'} icon={<ShieldCheck />} label="Data & privacy" onClick={() => setView('privacy')} />
        </nav>
        <div className="sidebar-foot">
          <div className="verified-stamp"><CheckCircle2 size={20} /><span><strong>Verified locally</strong><small>{transcript.attempts.length} course attempts</small></span></div>
          <button className="text-button" onClick={() => setStage('review')}><RefreshCcw size={16} /> Review import</button>
        </div>
      </aside>
      <main className={`dashboard-main view-${view}`}>
        <header className="dashboard-header">
          <div><p className="eyebrow">Academic workspace</p><h1>{view === 'overview' ? 'Your academic position' : view === 'courses' ? 'Verified course history' : view === 'plan' ? 'Build a realistic path' : view === 'report' ? 'Program-aware report' : 'Your data, your decision'}</h1></div>
          <div className="header-actions"><span className="privacy-badge"><LockKeyhole size={15} /> Local session</span><button className="icon-button danger" aria-label="Delete all data" onClick={clearAll}><Trash2 size={18} /></button></div>
        </header>

        {view === 'overview' && <Overview stats={stats} terms={terms} attempts={transcript.attempts} selectedProgram={selectedProgram} selectedPlan={selectedPlan} degreeProgress={degreeProgress} onPlan={() => setView('plan')} onProgram={() => setView('report')} />}
        {view === 'courses' && <CoursesView attempts={filteredAttempts} allAttempts={transcript.attempts} search={search} setSearch={setSearch} selectedPlan={selectedPlan} academicPlan={academicPlan} timeline={timeline} updatePlanStartTerm={updatePlanStartTerm} />}
        {view === 'plan' && <PlanView stats={stats} attempts={transcript.attempts} targetCgpa={targetCgpa} setTargetCgpa={setTargetCgpa} futureCredits={futureCredits} setFutureCredits={setFutureCredits} automaticFutureCredits={automaticFutureCredits} target={target} selectedProgram={selectedProgram} selectedPlan={selectedPlan} progress={degreeProgress} academicPlan={academicPlan} updatePlanEntry={updatePlanEntry} />}
        {view === 'report' && <ReportView stats={stats} transcript={transcript} programs={programs} selectedProgram={selectedProgram} selectedPlan={selectedPlan} planSelection={planSelection} progress={degreeProgress} timeline={timeline} projection={planProjection} programQuery={programQuery} setProgramQuery={setProgramQuery} setProgram={setProgram} setPlanVersion={setPlanVersion} useRecommendedPlan={useRecommendedPlan} exportCsv={exportCsv} exportJson={exportJson} />}
        {view === 'privacy' && <PrivacyView persistence={persistence} setPersistence={setPersistence} exportCsv={exportCsv} exportJson={exportJson} clearAll={clearAll} />}
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={view === 'overview'} icon={<LayoutDashboard />} label="Overview" onClick={() => setView('overview')} />
        <NavButton active={view === 'courses'} icon={<BookOpen />} label="Courses" onClick={() => setView('courses')} />
        <NavButton active={view === 'plan'} icon={<Target />} label="Plan" onClick={() => setView('plan')} />
        <NavButton active={view === 'report'} icon={<FileCheck2 />} label="Report" onClick={() => setView('report')} />
      </nav>
    </div>
  )
}

function Brand() {
  return <div className="brand"><span className="brand-mark">T</span><span><strong>Transcriptify</strong><small>UDST · private by design</small></span></div>
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function FamilyCoursesDialog({ prefix, gpa, attempts, onClose }: { prefix: string; gpa: number; attempts: CourseAttempt[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return <dialog className="family-course-dialog" ref={dialogRef} aria-labelledby={`family-dialog-${prefix}`} onClose={onClose} onKeyDown={(event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.currentTarget.close()
    }
  }} onMouseDown={(event) => {
    if (event.target === event.currentTarget) event.currentTarget.close()
  }}>
    <section className="family-dialog-sheet" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><p className="eyebrow">Course-family ledger</p><h2 id={`family-dialog-${prefix}`}>{prefix} courses</h2><span>{attempts.length} GPA-bearing course{attempts.length === 1 ? '' : 's'} · {gpa.toFixed(2)} family GPA</span></div><button type="button" aria-label={`Close ${prefix} course list`} onClick={() => dialogRef.current?.close()}><X size={20} /></button></header>
      <ul className="family-course-ledger">
        {attempts.map((attempt) => <li key={attempt.id}>
          <div><strong>{attempt.fullCode}</strong><span>{attempt.title}</span><small>{attempt.term} · {attempt.credits.toFixed(1)} credits</small></div>
          <span className="family-grade" aria-label={`Grade ${attempt.grade}`}>{attempt.grade}</span>
        </li>)}
      </ul>
      <footer>Only GPA-bearing attempts included in this family average are shown.</footer>
    </section>
  </dialog>
}

function Overview({ stats, terms, attempts, selectedProgram, selectedPlan, degreeProgress, onPlan, onProgram }: {
  stats: ReturnType<typeof calculateStats>
  terms: ReturnType<typeof calculateTermStats>
  attempts: CourseAttempt[]
  selectedProgram?: UdSTProgram
  selectedPlan?: ProgramPlan
  degreeProgress: ReturnType<typeof programProgress> | null
  onPlan: () => void
  onProgram: () => void
}) {
  const latest = terms.at(-1)
  const previous = terms.at(-2)
  const delta = latest && previous ? latest.cgpa - previous.cgpa : 0
  const standing = stats.cgpa >= 2 ? 'Clear standing range' : 'Below clear-standing threshold'
  const prefixStats = calculatePrefixStats(attempts)
  const [openFamily, setOpenFamily] = useState<string | null>(null)
  const openFamilyStats = prefixStats.find((subject) => subject.prefix === openFamily)
  const openFamilyAttempts = attempts.filter((attempt) => attempt.code === openFamily && attempt.includedInGpa && attempt.gradePoints !== null)
  return <>
    <section className="metric-grid">
      <article className="metric-card hero-metric"><span>Overall CGPA</span><strong>{stats.cgpa.toFixed(2)}<small>/ 4.00</small></strong><p><CheckCircle2 size={16} /> {standing}</p><details><summary>Show the chalkwork</summary><div>Σ quality points ({stats.qualityPoints.toFixed(2)}) ÷ GPA credits ({stats.totalCredits.toFixed(1)}). Non-calculable grades and lower repeat attempts are excluded.</div></details></article>
      <article className="metric-card"><span>Latest term</span><strong>{latest?.cgpa.toFixed(2) ?? '—'}<small>GPA</small></strong><p className={delta >= 0 ? 'positive' : 'negative'}>{delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(2)} from prior term</p><small>{latest?.term ?? 'No term data'}</small></article>
      <article className="metric-card"><span>GPA credits</span><strong>{stats.totalCredits.toFixed(1)}</strong><p>{stats.earnedCredits.toFixed(1)} credits passed</p><small>{stats.excludedAttempts} attempt(s) excluded</small></article>
      <article className="metric-card progress-metric"><span>Program progress</span><strong>{degreeProgress ? `${degreeProgress.percent}%` : '—'}</strong><p>{selectedProgram ? `${shortProgramName(selectedProgram)} · ${selectedPlan?.version}` : 'Select a program for tailored requirements'}</p><button className="inline-link" onClick={onProgram}>{selectedProgram ? 'Check study plan' : 'Choose program'} <ChevronRight size={15} /></button></article>
    </section>
    <section className="overview-grid">
      <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">Trajectory</p><h2>Term performance</h2></div><span className="data-badge">{terms.length} terms</span></div>
        <div className="term-bars" role="region" tabIndex={0} aria-label="Term GPA chart. Scroll horizontally to view every term.">{terms.map((term) => <div className="term-bar-item" key={term.term}><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(4, term.cgpa / 4 * 100)}%` }}><span>{term.cgpa.toFixed(2)}</span></div></div><small>{term.term.replace(' ', "\n")}</small></div>)}</div>
        <p className="term-scroll-hint" aria-hidden="true">Swipe to see every term <span>↔</span></p>
        <table className="sr-only"><caption>Term GPA data</caption><tbody>{terms.map((term) => <tr key={term.term}><th>{term.term}</th><td>{term.cgpa.toFixed(2)}</td></tr>)}</tbody></table>
      </article>
      <article className="panel action-panel"><div className="chalk-note"><span>Recommended next move</span><h2>{stats.cgpa < 2 ? 'Prioritize recovery before adding load.' : 'Turn your target into a credit-level plan.'}</h2><p>{stats.cgpa < 2 ? 'UDST clear standing begins at a 2.00 cumulative GPA. Model repeat and future-grade scenarios, then confirm course choices with your adviser.' : 'Set a target CGPA and see the average required across your next planned credits.'}</p><button className="dark-button" onClick={onPlan}>Open GPA planner <ArrowRight size={17} /></button></div>
        <div className="evidence-note"><CircleHelp size={18} /><p><strong>Why this appears</strong><br />Based on your verified CGPA, credit total, and UDST’s current standing threshold. It is planning support, not official academic advice.</p></div>
      </article>
    </section>
    <section className="panel subject-panel">
      <div className="panel-heading"><div><p className="eyebrow">Course-family breakdown</p><h2>Where your grades actually come from</h2></div><span className="chalk-annotation">prefix by prefix ↘</span></div>
      {prefixStats.length >= 3 && <CourseFamilyRadar attempts={attempts} overallGpa={stats.cgpa} />}
      {prefixStats.length ? <div className="subject-grid">{prefixStats.map((subject, index) => <article className={`subject-card subject-${index % 4}`} key={subject.prefix}>
        <div className="subject-card-top"><strong>{subject.prefix}</strong><span>{subject.gpa.toFixed(2)}</span></div>
        <div className="chalk-progress" aria-label={`${subject.prefix} GPA ${subject.gpa.toFixed(2)} out of 4`}><i style={{ width: `${subject.gpa / 4 * 100}%` }} /></div>
        <p>{subject.courses} course{subject.courses === 1 ? '' : 's'} · {subject.credits.toFixed(1)} GPA credits</p>
        <small className={subject.delta >= 0 ? 'positive' : 'negative'}>{subject.delta >= 0 ? '+' : ''}{subject.delta.toFixed(2)} vs your CGPA {!subject.sufficient && '· early signal'}</small>
        <button type="button" className="subject-card-action" aria-haspopup="dialog" onClick={() => setOpenFamily(subject.prefix)}>View courses <ChevronRight size={15} /></button>
      </article>)}</div> : <div className="empty-state"><BookOpen size={32} /><h3>No GPA-bearing course families yet</h3></div>}
    </section>
    {openFamilyStats && <FamilyCoursesDialog prefix={openFamilyStats.prefix} gpa={openFamilyStats.gpa} attempts={openFamilyAttempts} onClose={() => setOpenFamily(null)} />}
  </>
}

function CoursesView({ attempts, allAttempts, search, setSearch, selectedPlan, academicPlan, timeline, updatePlanStartTerm }: {
  attempts: CourseAttempt[]
  allAttempts: CourseAttempt[]
  search: string
  setSearch: (value: string) => void
  selectedPlan?: ProgramPlan
  academicPlan?: AcademicPlan
  timeline?: ReturnType<typeof buildAcademicTimeline>
  updatePlanStartTerm: (value: string) => void
}) {
  const [mode, setMode] = useState<'timeline' | 'attempts'>('timeline')
  const [filters, setFilters] = useState({ course: '', termName: '', termYear: '', credits: '', grade: '', gpaStatus: '' })
  const courseCodeOptions = [...new Set(allAttempts.map((attempt) => attempt.code))].sort((a, b) => a.localeCompare(b))
  const termParts = allAttempts.map((attempt) => {
    const [name, year] = attempt.term.trim().split(/\s+(?=\d{4}$)/)
    return { name, year }
  })
  const termNameOrder = new Map(['Fall', 'Winter', 'Spring', 'Summer'].map((name, index) => [name, index]))
  const termNameOptions = [...new Set(termParts.map(({ name }) => name))].sort((a, b) => (termNameOrder.get(a) ?? 999) - (termNameOrder.get(b) ?? 999) || a.localeCompare(b))
  const termYearOptions = [...new Set(termParts.map(({ year }) => year).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
  const creditOptions = [...new Set(allAttempts.map((attempt) => attempt.credits.toFixed(1)))].sort((a, b) => Number(a) - Number(b))
  const gradeOrder = new Map(gradeOptions.map((grade, index) => [grade, index]))
  const gradeFilterOptions = [...new Set(allAttempts.map((attempt) => attempt.grade))].sort((a, b) => (gradeOrder.get(a) ?? 999) - (gradeOrder.get(b) ?? 999) || a.localeCompare(b))
  const visibleAttempts = attempts.filter((attempt) =>
    (!filters.course || attempt.code === filters.course)
    && (!filters.termName || attempt.term.startsWith(`${filters.termName} `))
    && (!filters.termYear || attempt.term.endsWith(` ${filters.termYear}`))
    && (!filters.credits || attempt.credits.toFixed(1) === filters.credits)
    && (!filters.grade || attempt.grade === filters.grade)
    && (!filters.gpaStatus || (filters.gpaStatus === 'included' ? attempt.includedInGpa : !attempt.includedInGpa)),
  )
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }))
  const resetFilters = () => setFilters({ course: '', termName: '', termYear: '', credits: '', grade: '', gpaStatus: '' })
  return <>
    <section className="courses-modebar"><div className="view-switch" aria-label="Course view"><button className={mode === 'timeline' ? 'active' : ''} onClick={() => setMode('timeline')}>Timeline</button><button className={mode === 'attempts' ? 'active' : ''} onClick={() => setMode('attempts')}>Attempts</button></div>{mode === 'timeline' && academicPlan && <div className="start-term-field"><span>Semester 1 started</span><TermPicker value={academicPlan.startTerm} onChange={updatePlanStartTerm} knownTerms={[academicPlan.startTerm, ...allAttempts.map((attempt) => attempt.term), ...academicPlan.entries.map((entry) => entry.plannedTerm)]} ariaLabel="Program start term" allowEmpty={false} /></div>}<span className="data-badge">{selectedPlan?.version ?? 'Select a plan'}</span></section>
    <div className="courses-content-viewport">
    {mode === 'timeline' ? timeline ? <AcademicTimeline timeline={timeline} /> : <section className="panel empty-state"><Route size={34} /><h3>Select a program first</h3><p>Choose your program and study-plan version in Report to compare the official sequence with all {allAttempts.length} transcript attempts.</p></section> : <section className="panel courses-panel">
    <div className="panel-heading"><div><p className="eyebrow">Audit trail</p><h2>{visibleAttempts.length} course attempts</h2></div><label className="search-field"><span className="sr-only">Search courses</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search course, term, or grade…" /></label></div>
    <div className="column-filters" role="group" aria-label="Course table filters">
      <label className="course-column-filter"><span>Course code</span><select aria-label="Filter by course code" value={filters.course} onChange={(event) => setFilter('course', event.target.value)}><option value="">All codes</option>{courseCodeOptions.map((code) => <option value={code} key={code}>{code}</option>)}</select></label>
      <label><span>Term name</span><select aria-label="Filter by term name" value={filters.termName} onChange={(event) => setFilter('termName', event.target.value)}><option value="">All terms</option>{termNameOptions.map((termName) => <option value={termName} key={termName}>{termName}</option>)}</select></label>
      <label><span>Year</span><select aria-label="Filter by term year" value={filters.termYear} onChange={(event) => setFilter('termYear', event.target.value)}><option value="">All years</option>{termYearOptions.map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
      <label><span>Credits</span><select aria-label="Filter by credits" value={filters.credits} onChange={(event) => setFilter('credits', event.target.value)}><option value="">All credits</option>{creditOptions.map((credits) => <option value={credits} key={credits}>{credits}</option>)}</select></label>
      <label><span>Grade</span><select aria-label="Filter by grade" value={filters.grade} onChange={(event) => setFilter('grade', event.target.value)}><option value="">All grades</option>{gradeFilterOptions.map((grade) => <option value={grade} key={grade}>{grade}</option>)}</select></label>
      <label><span>GPA status</span><select aria-label="Filter by GPA status" value={filters.gpaStatus} onChange={(event) => setFilter('gpaStatus', event.target.value)}><option value="">All statuses</option><option value="included">Included</option><option value="excluded">Excluded</option></select></label>
      <button type="button" className="reset-filters" disabled={!activeFilterCount} onClick={resetFilters}><RotateCcw size={14} /> Reset {activeFilterCount ? `(${activeFilterCount})` : ''}</button>
    </div>
    {visibleAttempts.length ? <><div className="course-table-wrap"><table className="course-table"><thead><tr><th>Course</th><th>Term</th><th>Credits</th><th>Grade</th><th>Quality points</th><th>GPA status</th></tr></thead><tbody>{visibleAttempts.map((attempt) => <tr key={attempt.id}><td><strong>{attempt.fullCode}</strong><span>{attempt.title}</span></td><td>{attempt.term}</td><td>{attempt.credits.toFixed(1)}</td><td><span className={`grade-pill grade-${attempt.grade.replace('+', 'plus').toLowerCase()}`}>{attempt.grade}</span></td><td>{attempt.points.toFixed(2)}</td><td>{attempt.includedInGpa ? <span className="included"><Check size={14} /> Included</span> : <span className="excluded"><X size={14} /> Excluded</span>}</td></tr>)}</tbody></table></div>
      <div className="course-cards">{visibleAttempts.map((attempt) => <article key={attempt.id}><div><strong>{attempt.fullCode}</strong><span className={`grade-pill grade-${attempt.grade.replace('+', 'plus').toLowerCase()}`}>{attempt.grade}</span></div><h3>{attempt.title}</h3><p>{attempt.term} · {attempt.credits.toFixed(1)} credits · {attempt.includedInGpa ? 'Included in GPA' : 'Excluded from GPA'}</p></article>)}</div></> : <div className="empty-state"><BookOpen size={32} /><h3>No matching courses</h3><p>Choose another course prefix or clear the search.</p></div>}
    </section>}
    </div>
  </>
}

function PlanView({ stats, attempts, targetCgpa, setTargetCgpa, futureCredits, setFutureCredits, automaticFutureCredits, target, selectedProgram, selectedPlan, progress, academicPlan, updatePlanEntry }: {
  stats: ReturnType<typeof calculateStats>
  attempts: CourseAttempt[]
  targetCgpa: number
  setTargetCgpa: (value: number) => void
  futureCredits: number
  setFutureCredits: (value: number) => void
  automaticFutureCredits: number | null
  target: ReturnType<typeof solveTargetCgpa>
  selectedProgram?: UdSTProgram
  selectedPlan?: ProgramPlan
  progress: ReturnType<typeof programProgress> | null
  academicPlan?: AcademicPlan
  updatePlanEntry: (entryId: string, patch: Partial<{ courseCode: string; plannedTerm: string; expectedGrade: string }>) => void
}) {
  const scenarios = [{ name: 'Conservative', gpa: 2.5 }, { name: 'Expected', gpa: 3 }, { name: 'Optimistic', gpa: 3.5 }]
  return <>
    <section className="planner-grid">
      <article className="panel target-panel"><div className="panel-heading"><div><p className="eyebrow">Target solver</p><h2>What average do you need?</h2></div><Target size={28} /></div>
        <div className="input-pair"><label><span>Target CGPA</span><input type="number" min="0" max="4" step="0.05" value={targetCgpa} onChange={(e) => setTargetCgpa(Number(e.target.value))} /></label><label><span>Future credits</span><div className="auto-credit-input"><input type="number" min="0" max="180" step="0.5" value={futureCredits} onChange={(e) => setFutureCredits(Number(e.target.value))} />{automaticFutureCredits !== null && futureCredits !== automaticFutureCredits && <button type="button" onClick={() => setFutureCredits(automaticFutureCredits)}>Use plan balance</button>}</div>{progress && <small className="plan-credit-source">Auto: {progress.requiredCredits.toFixed(1)} program credits − {progress.completedCredits.toFixed(1)} completed = {automaticFutureCredits?.toFixed(1)} remaining</small>}</label></div>
        <div className={`solver-result ${futureCredits === 0 ? 'already-reached' : target.feasibility}`}><span>Required future average</span><strong>{futureCredits === 0 ? '—' : target.requiredGpa < 0 ? '0.00' : target.requiredGpa.toFixed(2)}</strong><b>{futureCredits === 0 ? 'program complete' : target.feasibility.replace('-', ' ')}</b></div>
        <p className="formula">{futureCredits === 0 ? 'The selected study plan has no remaining matched credits.' : `(${targetCgpa.toFixed(2)} × ${(stats.totalCredits + futureCredits).toFixed(1)} total credits − ${stats.qualityPoints.toFixed(2)} current points) ÷ ${futureCredits} future credits`}</p>
      </article>
      <article className="panel scenarios-panel"><div className="panel-heading"><div><p className="eyebrow">Three paths</p><h2>Scenario comparison</h2></div></div>{scenarios.map((scenario) => { const projected = (stats.qualityPoints + futureCredits * scenario.gpa) / (stats.totalCredits + futureCredits); return <div className="scenario-row" key={scenario.name}><span><strong>{scenario.name}</strong><small>{scenario.gpa.toFixed(2)} future average</small></span><b>{projected.toFixed(2)}</b><i style={{ width: `${projected / 4 * 100}%` }} /></div> })}<p className="disclaimer">Projection assumes all future credits are GPA-bearing and does not replace UDST adviser approval.</p></article>
    </section>
    <section className="panel prerequisite-panel"><div className="panel-heading"><div><p className="eyebrow">Program sequence · {selectedPlan?.version ?? 'no plan selected'}</p><h2>{selectedProgram ? shortProgramName(selectedProgram) : 'Choose a program in Report'}</h2></div>{selectedPlan && <a href={selectedPlan.sourceUrl} target="_blank" rel="noreferrer">Official {selectedPlan.version} plan</a>}</div>
      {!progress ? <div className="empty-state"><GraduationCap size={34} /><h3>No program selected</h3><p>Select your UDST program in Report to see completed requirements, courses you may be ready for, and prerequisite blockers.</p></div> : progress.requirements.length === 0 ? <div className="review-alert"><AlertTriangle size={20} /><div><strong>Study plan not yet published</strong><p>UDST lists this new program, but its public page does not yet include a course table. Use the official link and confirm requirements with your adviser.</p></div></div> : <div className="progress-columns"><div><h3><CheckCircle2 size={18} /> Ready next</h3>{progress.readyNext.length ? progress.readyNext.map((requirement) => <div className="requirement-row" key={requirement.id}><span><strong>{requirement.kind === 'course' ? requirement.completedOptions[0]?.code || requirement.readyOptions[0]?.code : `Choose ${requirement.remainingCount}`}</strong><small>{requirement.label}</small></span><b>{requirement.creditsPerSlot} CR</b></div>) : <p className="empty-copy">No immediately ready requirements.</p>}</div><div><h3><LockKeyhole size={18} /> Prerequisite blockers</h3>{progress.blocked.length ? progress.blocked.map((requirement) => <div className="requirement-row locked" key={requirement.id}><span><strong>{requirement.kind === 'course' ? requirement.lockedOptions[0]?.code : `Elective · ${requirement.remainingCount} left`}</strong><small>{requirement.kind === 'course' ? requirement.lockedOptions[0]?.prerequisite || 'Prior requirement' : requirement.label}</small></span><b>{requirement.semester}</b></div>) : <p className="empty-copy">No parsed prerequisite blockers.</p>}</div></div>}
    </section>
    {selectedPlan && academicPlan && <CourseGradePlanner stats={stats} plan={selectedPlan} attempts={attempts} academicPlan={academicPlan} targetCgpa={targetCgpa} onEntryChange={updatePlanEntry} />}
  </>
}

function ReportView({ stats, transcript, programs, selectedProgram, selectedPlan, planSelection, progress, timeline, projection, programQuery, setProgramQuery, setProgram, setPlanVersion, useRecommendedPlan, exportCsv, exportJson }: {
  stats: ReturnType<typeof calculateStats>
  transcript: TranscriptDocument
  programs: UdSTProgram[]
  selectedProgram?: UdSTProgram
  selectedPlan?: ProgramPlan
  planSelection: ReturnType<typeof selectProgramPlan> | null
  progress: ReturnType<typeof programProgress> | null
  timeline?: ReturnType<typeof buildAcademicTimeline>
  projection?: ReturnType<typeof calculatePlanProjection>
  programQuery: string
  setProgramQuery: (value: string) => void
  setProgram: (value: string) => void
  setPlanVersion: (value: string) => void
  useRecommendedPlan: () => void
  exportCsv: () => void
  exportJson: () => void
}) {
  const filteredPrograms = programs.filter((program) => program.name.toLowerCase().includes(programQuery.toLowerCase())).slice(0, 12)
  return <>
    <section className="panel program-picker"><div className="panel-heading"><div><p className="eyebrow">Tailor this report</p><h2>Your UDST program</h2></div><span className="data-badge">{programs.length} official listings</span></div>
      <label className="program-search"><span>Search program name</span><input value={programQuery} onChange={(e) => setProgramQuery(e.target.value)} placeholder={selectedProgram?.name || 'e.g. Software Engineering'} /></label>
      {programQuery && <div className="program-results">{filteredPrograms.map((program) => <button key={program.id} onClick={() => setProgram(program.id)}><span><strong>{program.name}</strong><small>{program.college} · {program.duration}</small></span><ChevronRight size={18} /></button>)}</div>}
      {selectedProgram && <div className="program-and-plans">
        <div className="selected-program"><GraduationCap size={28} /><div><span>Selected program</span><strong>{selectedProgram.name}</strong><p>{selectedProgram.college} · {selectedProgram.plans.length} published plan version{selectedProgram.plans.length === 1 ? '' : 's'}</p></div><a href={selectedProgram.sourceUrl} target="_blank" rel="noreferrer">Verify on UDST</a></div>
        <aside className="plan-version-rail" aria-label="Study plan versions">
          <div><span>Study plan</span><strong>{selectedPlan?.version ?? 'Not published'}</strong></div>
          {planSelection?.cohort && <p className="cohort-note"><Sparkles size={15} /> {transcript.programPlanSelection === 'manual' ? 'Manual choice.' : `Suggested from your first term, ${planSelection.cohort.term}.`}</p>}
          <div className="plan-options">{selectedProgram.plans.map((plan) => <button className={selectedPlan?.version === plan.version ? 'active' : ''} key={plan.id} onClick={() => setPlanVersion(plan.version)}><span>{plan.version}</span><small>{plan.requiredCredits ? `${plan.requiredCredits} credits` : `${plan.courses.length} rows`}</small>{selectedPlan?.version === plan.version && <Check size={15} />}</button>)}</div>
          {transcript.programPlanSelection === 'manual' && <button className="inline-link" onClick={useRecommendedPlan}>Use cohort suggestion <RefreshCcw size={14} /></button>}
          <small className="plan-caveat">Cohort detection is a best estimate. Program transfers, deferrals, and approved substitutions can change the applicable plan.</small>
        </aside>
      </div>}
    </section>
    <DetailedAcademicReport stats={stats} attempts={transcript.attempts} program={selectedProgram} plan={selectedPlan} progress={progress} timeline={timeline} projection={projection} />
    <div className="export-row"><button className="secondary-button" onClick={exportCsv}><FileSpreadsheet size={18} /> Export CSV</button><button className="secondary-button" onClick={exportJson}><FileJson size={18} /> Export JSON</button><button className="primary-button" onClick={() => window.print()}><Printer size={18} /> Print report</button></div>
  </>
}

function PrivacyView({ persistence, setPersistence, exportCsv, exportJson, clearAll }: { persistence: PersistenceMode; setPersistence: (value: PersistenceMode) => void; exportCsv: () => void; exportJson: () => void; clearAll: () => void }) {
  return <>
    <section className="privacy-hero"><ShieldCheck size={38} /><div><p className="eyebrow">Plain-language privacy</p><h2>Your transcript does not need an account—or a server.</h2><p>PDF text is read in this browser. After verification, Transcriptify keeps normalized course fields only according to the mode you choose; it does not store the original PDF.</p></div></section>
    <section className="panel persistence-panel"><div className="panel-heading"><div><p className="eyebrow">Retention choice</p><h2>How long should this device remember?</h2></div></div><div className="mode-grid">{([
      ['session', 'Current session only', 'Clears when you delete or leave; not restored after reload.'],
      ['device', 'Remember on this device', 'Stores normalized data in this browser until you delete it.'],
      ['clear-after-export', 'Clear after export', 'Remembers locally, then deletes after CSV or JSON export.'],
    ] as const).map(([mode, title, description]) => <label className={persistence === mode ? 'selected' : ''} key={mode}><input type="radio" name="persistence" checked={persistence === mode} onChange={() => setPersistence(mode)} /><span><strong>{title}</strong><small>{description}</small></span>{persistence === mode && <CheckCircle2 size={20} />}</label>)}</div></section>
    <section className="privacy-actions"><article className="panel"><Download size={24} /><h3>Take your data</h3><p>Download normalized course records with no original PDF text.</p><div><button className="secondary-button" onClick={exportCsv}>CSV</button><button className="secondary-button" onClick={exportJson}>JSON</button></div></article><article className="panel danger-zone"><Trash2 size={24} /><h3>Delete all local data</h3><p>Removes transcript records and returns to the empty state immediately.</p><button className="danger-button" onClick={clearAll}>Delete all local data</button></article></section>
    <section className="source-list"><h3>Official rule sources</h3><a href="https://www.udst.edu.qa/about-udst/institutional-excellence-ie/policies-and-procedures/final-grade-policy" target="_blank" rel="noreferrer">Final Grade Policy <ArrowRight size={15} /></a><a href="https://www.udst.edu.qa/about-udst/institutional-excellence-ie/policies-and-procedures/academic-standing-policy" target="_blank" rel="noreferrer">Academic Standing Policy <ArrowRight size={15} /></a><a href="https://www.udst.edu.qa/current-student/graduation-requirements" target="_blank" rel="noreferrer">Graduation Requirements <ArrowRight size={15} /></a><a href="https://www.udst.edu.qa/admissions/all-programs" target="_blank" rel="noreferrer">All Programs <ArrowRight size={15} /></a></section>
  </>
}
