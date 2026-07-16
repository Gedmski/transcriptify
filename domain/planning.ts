import {
  type ElectiveGroupRequirement,
  type EvaluatedRequirement,
  type OpenElectiveRequirement,
  type ProgramCourse,
  type ProgramPlan,
  evaluateProgramRequirements,
  getPlanRequirements,
} from './programs'
import {
  GRADE_POINTS,
  type AcademicPlan,
  type CourseAttempt,
  type PlanEntry,
  type TranscriptStats,
  calculateCumulativeTermStats,
  calculatePrefixStats,
  calculateStats,
} from './transcript'

const TERM_INDEX: Record<string, number> = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 }
const TERM_PATTERN = /^(Fall|Winter|Spring|Summer)\s+(20\d{2})$/i

export function normalizeAcademicTerm(term: string) {
  const match = term.trim().replace(/\s+/g, ' ').match(TERM_PATTERN)
  if (!match) return null
  const season = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}`
  return `${season} ${match[2]}`
}

export function termOrder(term: string) {
  const normalized = normalizeAcademicTerm(term)
  if (!normalized) return Number.MAX_SAFE_INTEGER
  const [season, year] = normalized.split(' ')
  return Number(year) * 4 + (TERM_INDEX[season] ?? 0)
}

export function buildAcademicTermOptions(knownTerms: Array<string | undefined>, yearPadding = 1) {
  const normalized = [...new Set(knownTerms.map((term) => term ? normalizeAcademicTerm(term) : null).filter(Boolean) as string[])]
  const years = normalized.map((term) => Number(term.split(' ')[1]))
  const currentYear = new Date().getFullYear()
  const firstYear = years.length ? Math.min(...years) - yearPadding : currentYear - 1
  const lastYear = years.length ? Math.max(...years) + yearPadding : currentYear + 4
  const generated: string[] = []
  for (let year = firstYear; year <= lastYear; year += 1) {
    generated.push(`Winter ${year}`, `Spring ${year}`, `Summer ${year}`, `Fall ${year}`)
  }
  return [...new Set([...generated, ...normalized])].sort((a, b) => termOrder(a) - termOrder(b))
}

export function buildAcademicYearOptions(knownTerms: Array<string | undefined>, yearPadding = 1) {
  return [...new Set(buildAcademicTermOptions(knownTerms, yearPadding).map((term) => term.split(' ')[1]))]
    .sort((a, b) => Number(a) - Number(b))
}

export function nextAcademicTerm(term: string) {
  const normalized = normalizeAcademicTerm(term)
  if (!normalized) return term
  const [termSeason, termYear] = normalized.split(' ')
  const season = termSeason.toLowerCase()
  const year = Number(termYear)
  if (season === 'fall') return `Winter ${year + 1}`
  if (season === 'winter') return `Spring ${year}`
  return `Fall ${year}`
}

export function academicTermSequence(startTerm: string, count: number) {
  const terms = [startTerm]
  while (terms.length < count) terms.push(nextAcademicTerm(terms.at(-1)!))
  return terms
}

export function inferProgramStartTerm(attempts: CourseAttempt[]) {
  return [...attempts]
    .filter((attempt) => termOrder(attempt.term) !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => termOrder(a.term) - termOrder(b.term))[0]?.term ?? 'Fall 2026'
}

export function academicPlanKey(programId: string, planVersion: string) {
  return `${programId}::${planVersion}`
}

export function remainingProgramCredits(requiredCredits: number, completedCredits: number) {
  return Math.max(0, Math.round((requiredCredits - completedCredits) * 10) / 10)
}

export function currentAcademicTerm(attempts: CourseAttempt[], startTerm: string) {
  const inProgress = attempts.filter((attempt) => attempt.grade === 'IP').sort((a, b) => termOrder(a.term) - termOrder(b.term))
  if (inProgress.length) return inProgress.at(-1)!.term
  const completed = attempts
    .filter((attempt) => attempt.status === 'completed')
    .sort((a, b) => termOrder(a.term) - termOrder(b.term))
  return completed.length ? nextAcademicTerm(completed.at(-1)!.term) : startTerm
}

function expectedTermFor(startTerm: string, semesterIndex: number) {
  return academicTermSequence(startTerm, Math.max(1, semesterIndex))[Math.max(0, semesterIndex - 1)]
}

function findEntry(existing: AcademicPlan | undefined, requirementId: string, slot: number) {
  return existing?.entries.find((entry) => entry.requirementId === requirementId && entry.slot === slot)
}

export function createAcademicPlan(
  programId: string,
  plan: ProgramPlan,
  attempts: CourseAttempt[],
  existing?: AcademicPlan,
): AcademicPlan {
  const startTerm = existing?.startTerm || inferProgramStartTerm(attempts)
  const currentTerm = currentAcademicTerm(attempts, startTerm)
  const evaluation = evaluateProgramRequirements(plan, attempts, existing)
  const entries: PlanEntry[] = []

  evaluation.requirements.forEach((requirement) => {
    const expectedTerm = expectedTermFor(startTerm, requirement.semesterIndex)
    const known = [...requirement.completedOptions, ...requirement.inProgressOptions, ...requirement.selectedOptions]
    for (let slot = 0; slot < requirement.chooseCount; slot += 1) {
      const prior = findEntry(existing, requirement.id, slot)
      const knownCourse = known[slot] ?? (requirement.kind === 'course' ? requirement.readyOptions[0] ?? requirement.lockedOptions[0] : undefined)
      const isCompleted = Boolean(requirement.completedOptions[slot])
      const isInProgress = Boolean(requirement.inProgressOptions[slot - requirement.completedOptions.length])
      const plannedTerm = isCompleted
        ? undefined
        : isInProgress
          ? attempts.find((attempt) => attempt.fullCode === knownCourse?.code && attempt.grade === 'IP')?.term
          : prior?.plannedTerm ?? (termOrder(expectedTerm) >= termOrder(currentTerm) ? expectedTerm : undefined)
      entries.push({
        id: `${requirement.id}-slot-${slot}`,
        requirementId: requirement.id,
        slot,
        courseCode: knownCourse?.code ?? prior?.courseCode,
        plannedTerm,
        expectedGrade: prior?.expectedGrade,
      })
    }
  })

  return {
    programId,
    planVersion: plan.version,
    startTerm,
    entries,
    manualRequirementMatches: existing?.manualRequirementMatches ?? {},
    updatedAt: new Date().toISOString(),
  }
}

function optionForEntry(requirement: EvaluatedRequirement, entry?: PlanEntry) {
  if (!entry?.courseCode) return undefined
  return [...requirement.completedOptions, ...requirement.inProgressOptions, ...requirement.selectedOptions, ...requirement.readyOptions, ...requirement.lockedOptions]
    .find((course) => course.code === entry.courseCode)
}

export type TimelineStatus = 'early' | 'on-time' | 'late' | 'in-progress' | 'planned' | 'overdue' | 'watch' | 'upcoming' | 'unmatched'

export interface AcademicTimelineRow {
  id: string
  requirementId?: string
  kind: 'course' | 'elective' | 'unmatched'
  code?: string
  title: string
  credits: number
  expectedTerm?: string
  actualTerm?: string
  plannedTerm?: string
  status: TimelineStatus
  semester: string
}

export function buildAcademicTimeline(plan: ProgramPlan, attempts: CourseAttempt[], academicPlan: AcademicPlan) {
  const evaluation = evaluateProgramRequirements(plan, attempts, academicPlan)
  const passedByCode = new Map(
    attempts.filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1)
      .map((attempt) => [attempt.fullCode, attempt]),
  )
  const ipByCode = new Map(attempts.filter((attempt) => attempt.grade === 'IP').map((attempt) => [attempt.fullCode, attempt]))
  const currentTerm = currentAcademicTerm(attempts, academicPlan.startTerm)
  const rows: AcademicTimelineRow[] = []

  evaluation.requirements.forEach((requirement) => {
    const expectedTerm = expectedTermFor(academicPlan.startTerm, requirement.semesterIndex)
    for (let slot = 0; slot < requirement.chooseCount; slot += 1) {
      const entry = academicPlan.entries.find((item) => item.requirementId === requirement.id && item.slot === slot)
      const completedCourse = requirement.completedOptions[slot]
      const progressOffset = slot - requirement.completedOptions.length
      const inProgressCourse = progressOffset >= 0 ? requirement.inProgressOptions[progressOffset] : undefined
      const selectedOffset = progressOffset - requirement.inProgressOptions.length
      const selectedCourse = selectedOffset >= 0 ? requirement.selectedOptions[selectedOffset] : undefined
      const course = completedCourse || inProgressCourse || selectedCourse || optionForEntry(requirement, entry)
      const actual = course ? passedByCode.get(course.code) : undefined
      const ip = course ? ipByCode.get(course.code) : undefined
      let status: TimelineStatus
      if (actual) {
        const delta = termOrder(actual.term) - termOrder(expectedTerm)
        status = delta < 0 ? 'early' : delta > 0 ? 'late' : 'on-time'
      } else if (ip) {
        status = 'in-progress'
      } else if (termOrder(expectedTerm) < termOrder(currentTerm)) {
        status = 'overdue'
      } else if (termOrder(expectedTerm) === termOrder(currentTerm) && !entry?.plannedTerm) {
        status = 'watch'
      } else if (entry?.plannedTerm) {
        status = 'planned'
      } else {
        status = 'upcoming'
      }
      rows.push({
        id: `${requirement.id}-${slot}`,
        requirementId: requirement.id,
        kind: requirement.kind === 'course' ? 'course' : 'elective',
        code: course?.code,
        title: course?.title ?? `${requirement.label} · choice ${slot + 1} of ${requirement.chooseCount}`,
        credits: course?.credits ?? requirement.creditsPerSlot,
        expectedTerm,
        actualTerm: actual?.term ?? ip?.term,
        plannedTerm: entry?.plannedTerm,
        status,
        semester: requirement.semester,
      })
    }
  })

  const usedAttemptIds = new Set(evaluation.matchedAttemptIds)
  const matchedRowCodes = new Set(rows.map((row) => row.code).filter(Boolean))
  attempts.filter((attempt) => !usedAttemptIds.has(attempt.id) && !matchedRowCodes.has(attempt.fullCode)).forEach((attempt) => {
    rows.push({
      id: `unmatched-${attempt.id}`,
      kind: 'unmatched',
      code: attempt.fullCode,
      title: attempt.title,
      credits: attempt.credits,
      actualTerm: attempt.term,
      status: 'unmatched',
      semester: 'Outside matched requirements',
    })
  })

  const terms = [...new Set(rows.flatMap((row) => [row.expectedTerm, row.actualTerm, row.plannedTerm]).filter(Boolean) as string[])]
    .sort((a, b) => termOrder(a) - termOrder(b))
  const summaries = terms.map((term) => ({
    term,
    expectedCredits: rows.filter((row) => row.expectedTerm === term && row.kind !== 'unmatched').reduce((sum, row) => sum + row.credits, 0),
    completedCredits: rows.filter((row) => row.actualTerm === term && ['early', 'on-time', 'late'].includes(row.status)).reduce((sum, row) => sum + row.credits, 0),
    plannedCredits: rows.filter((row) => row.plannedTerm === term && ['planned', 'in-progress'].includes(row.status)).reduce((sum, row) => sum + row.credits, 0),
  }))
  const overdue = rows.filter((row) => row.status === 'overdue').length
  const watch = rows.filter((row) => row.status === 'watch'
    || row.status === 'in-progress'
    || (row.status === 'planned' && row.expectedTerm && termOrder(row.expectedTerm) <= termOrder(currentTerm))).length
  return {
    rows,
    terms,
    summaries,
    currentTerm,
    status: overdue ? 'Behind' as const : watch ? 'Watch' as const : 'On track' as const,
    counts: {
      early: rows.filter((row) => row.status === 'early').length,
      onTime: rows.filter((row) => row.status === 'on-time').length,
      late: rows.filter((row) => row.status === 'late').length,
      overdue,
      unmatched: rows.filter((row) => row.status === 'unmatched').length,
    },
  }
}

function findRequirementCourse(plan: ProgramPlan, entry: PlanEntry): ProgramCourse | undefined {
  const requirement = getPlanRequirements(plan).find((item) => item.id === entry.requirementId)
  if (!requirement) return undefined
  if (requirement.kind === 'course') return requirement.course
  if (requirement.kind === 'elective-group') return requirement.options.find((option) => option.code === entry.courseCode)
  return entry.courseCode ? {
    code: entry.courseCode,
    title: requirement.label,
    prerequisite: null,
    corequisite: null,
    credits: requirement.credits / Math.max(1, requirement.chooseCount),
    semester: requirement.semester,
  } : undefined
}

export function calculatePlanProjection(
  stats: TranscriptStats,
  plan: ProgramPlan,
  attempts: CourseAttempt[],
  academicPlan: AcademicPlan,
) {
  const completedCodes = new Set(
    attempts.filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1).map((attempt) => attempt.fullCode),
  )
  const candidates = academicPlan.entries.map((entry) => ({ entry, course: findRequirementCourse(plan, entry) }))
    .filter(({ entry, course }) => course && !completedCodes.has(course.code) && entry.plannedTerm)
  const graded = candidates.filter(({ entry }) => entry.expectedGrade && GRADE_POINTS[entry.expectedGrade] !== null)
  const groups = new Map<string, typeof graded>()
  graded.forEach((item) => groups.set(item.entry.plannedTerm!, [...(groups.get(item.entry.plannedTerm!) ?? []), item]))
  let cumulativeCredits = stats.totalCredits
  let cumulativePoints = stats.qualityPoints
  const terms = [...groups.entries()].sort(([a], [b]) => termOrder(a) - termOrder(b)).map(([term, items]) => {
    const credits = items.reduce((sum, item) => sum + item.course!.credits, 0)
    const points = items.reduce((sum, item) => sum + item.course!.credits * (GRADE_POINTS[item.entry.expectedGrade!] ?? 0), 0)
    cumulativeCredits += credits
    cumulativePoints += points
    return {
      term,
      credits,
      gpa: credits ? points / credits : 0,
      cumulativeGpa: cumulativeCredits ? cumulativePoints / cumulativeCredits : stats.cgpa,
      courses: items.map((item) => ({ code: item.course!.code, grade: item.entry.expectedGrade!, credits: item.course!.credits })),
    }
  })
  return {
    terms,
    projectedCgpa: cumulativeCredits ? cumulativePoints / cumulativeCredits : stats.cgpa,
    projectedCredits: cumulativeCredits,
    gradedCourses: graded.length,
    ungradedCourses: candidates.length - graded.length,
  }
}

export function deriveFamilyInsights(attempts: CourseAttempt[]) {
  const overall = calculateStats(attempts).cgpa
  const families = calculatePrefixStats(attempts)
  return {
    strengths: families.filter((family) => family.credits >= 6 && family.gpa >= 3 && family.gpa - overall >= 0.2).slice(0, 3),
    focusAreas: [...families].sort((a, b) => a.gpa - b.gpa)
      .filter((family) => family.credits >= 6 && (family.gpa < 2.5 || family.gpa - overall <= -0.2)).slice(0, 3),
    preliminary: families.filter((family) => family.credits < 6),
  }
}

export function buildTermEvaluations(attempts: CourseAttempt[], timeline?: ReturnType<typeof buildAcademicTimeline>) {
  const summaries = new Map(timeline?.summaries.map((summary) => [summary.term, summary]) ?? [])
  return calculateCumulativeTermStats(attempts).map((term) => ({
    ...term,
    expectedCredits: summaries.get(term.term)?.expectedCredits ?? 0,
    planVariance: term.earnedCredits - (summaries.get(term.term)?.expectedCredits ?? 0),
  }))
}

export function electiveRequirementOptions(requirement: ElectiveGroupRequirement | OpenElectiveRequirement) {
  return requirement.kind === 'elective-group' ? requirement.options : []
}
