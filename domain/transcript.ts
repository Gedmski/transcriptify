export const GRADE_POINTS: Record<string, number | null> = {
  A: 4,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  'D+': 1.5,
  D: 1,
  F: 0,
  AF: 0,
  W: null,
  I: null,
  IP: null,
  AU: null,
  EN: null,
  EX: null,
  P: null,
  S: null,
  U: null,
  TR: null,
  NS: null,
}

export type AttemptStatus = 'completed' | 'withdrawn' | 'incomplete' | 'transfer' | 'audit'
export type ValidationLevel = 'verified' | 'warning' | 'invalid'

export interface CourseAttempt {
  id: string
  term: string
  code: string
  number: string
  fullCode: string
  title: string
  credits: number
  grade: string
  gradePoints: number | null
  points: number
  includedInGpa: boolean
  status: AttemptStatus
  validation: ValidationLevel
  warning?: string
  original: {
    term: string
    fullCode: string
    title: string
    credits: number
    grade: string
    points: number
  }
}

export interface TranscriptDocument {
  schemaVersion: 2
  institutionId: 'udst'
  adapterVersion: 'udst-2026.1'
  importedAt: string
  programId?: string
  programPlanVersion?: string
  programPlanSelection?: 'inferred' | 'manual'
  verificationStatus: 'unreviewed' | 'warnings' | 'verified'
  attempts: CourseAttempt[]
  warnings: string[]
}

export interface TranscriptStats {
  cgpa: number
  totalCredits: number
  earnedCredits: number
  qualityPoints: number
  totalCourses: number
  excludedAttempts: number
}

export const normalizeGrade = (grade: string) => grade.trim().toUpperCase().replace(/\s+/g, '')

export function gradeStatus(grade: string): AttemptStatus {
  const normalized = normalizeGrade(grade)
  if (normalized === 'W') return 'withdrawn'
  if (['I', 'IP', 'NS'].includes(normalized)) return 'incomplete'
  if (['EN', 'TR', 'EX'].includes(normalized)) return 'transfer'
  if (normalized === 'AU') return 'audit'
  return 'completed'
}

export function reconcileRepeats(attempts: CourseAttempt[]): CourseAttempt[] {
  const result = attempts.map((attempt) => ({ ...attempt }))
  const groups = new Map<string, CourseAttempt[]>()

  result.forEach((attempt) => {
    if (attempt.gradePoints === null) return
    const group = groups.get(attempt.fullCode) ?? []
    group.push(attempt)
    groups.set(attempt.fullCode, group)
  })

  groups.forEach((group) => {
    if (group.length < 2) return
    const best = [...group].sort((a, b) => (b.gradePoints ?? -1) - (a.gradePoints ?? -1))[0]
    group.forEach((attempt) => {
      attempt.includedInGpa = attempt.id === best.id
      if (attempt.id !== best.id && !attempt.warning) {
        attempt.warning = 'Lower repeated attempt excluded from CGPA under UDST policy.'
        attempt.validation = 'warning'
      }
    })
  })

  return result
}

export function calculateStats(attempts: CourseAttempt[]): TranscriptStats {
  const included = attempts.filter((attempt) => attempt.includedInGpa && attempt.gradePoints !== null)
  const totalCredits = included.reduce((sum, attempt) => sum + attempt.credits, 0)
  const qualityPoints = included.reduce((sum, attempt) => sum + attempt.credits * (attempt.gradePoints ?? 0), 0)
  const earnedCredits = attempts
    .filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) > 0)
    .reduce((sum, attempt) => sum + attempt.credits, 0)

  return {
    cgpa: totalCredits ? qualityPoints / totalCredits : 0,
    totalCredits,
    earnedCredits,
    qualityPoints,
    totalCourses: attempts.length,
    excludedAttempts: attempts.filter((attempt) => !attempt.includedInGpa).length,
  }
}

export function calculateTermStats(attempts: CourseAttempt[]) {
  const seasonOrder: Record<string, number> = { Winter: 1, Spring: 2, Summer: 3, Fall: 4 }
  const groups = new Map<string, CourseAttempt[]>()
  attempts.forEach((attempt) => groups.set(attempt.term, [...(groups.get(attempt.term) ?? []), attempt]))

  return [...groups.entries()]
    .map(([term, termAttempts]) => ({ term, ...calculateStats(termAttempts) }))
    .sort((a, b) => {
      const [aSeason, aYear = '0'] = a.term.split(' ')
      const [bSeason, bYear = '0'] = b.term.split(' ')
      return Number(aYear) * 10 + (seasonOrder[aSeason] ?? 0) - (Number(bYear) * 10 + (seasonOrder[bSeason] ?? 0))
    })
}

export function calculatePrefixStats(attempts: CourseAttempt[]) {
  const included = attempts.filter((attempt) => attempt.includedInGpa && attempt.gradePoints !== null)
  const overall = calculateStats(included).cgpa
  const groups = new Map<string, CourseAttempt[]>()
  included.forEach((attempt) => groups.set(attempt.code, [...(groups.get(attempt.code) ?? []), attempt]))

  return [...groups.entries()]
    .map(([prefix, prefixAttempts]) => {
      const stats = calculateStats(prefixAttempts)
      return {
        prefix,
        gpa: stats.cgpa,
        credits: stats.totalCredits,
        courses: prefixAttempts.length,
        delta: stats.cgpa - overall,
        sufficient: stats.totalCredits >= 6,
      }
    })
    .sort((a, b) => b.credits - a.credits || b.gpa - a.gpa)
}

export function solveTargetCgpa(stats: TranscriptStats, target: number, futureCredits: number) {
  if (!Number.isFinite(target) || !Number.isFinite(futureCredits) || futureCredits <= 0) {
    return { requiredGpa: 0, feasibility: 'invalid' as const }
  }
  const requiredGpa = (target * (stats.totalCredits + futureCredits) - stats.qualityPoints) / futureCredits
  const feasibility = requiredGpa > 4
    ? 'impossible'
    : requiredGpa > 3.5
      ? 'stretch'
      : requiredGpa < 0
        ? 'already-reached'
        : 'achievable'
  return { requiredGpa, feasibility }
}
