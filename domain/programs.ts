import type { CourseAttempt } from './transcript'

export interface ProgramCourse {
  code: string
  title: string
  prerequisite: string | null
  corequisite: string | null
  credits: number
  semester: string
}

export interface ProgramPlan {
  id: string
  version: string
  sourceUrl: string
  requiredCredits: number | null
  totalListedCredits: number
  courses: ProgramCourse[]
}

export interface UdSTProgram {
  id: string
  name: string
  duration: string
  sourceUrl: string
  credential: string
  college: string
  planVersion: string
  totalListedCredits: number
  courses: ProgramCourse[]
  plans: ProgramPlan[]
}

export function inferCohortVersion(attempts: CourseAttempt[]) {
  const datedTerms = attempts
    .map((attempt) => {
      const match = attempt.term.match(/(Fall|Winter|Spring|Summer)\s+(20\d{2})/i)
      if (!match) return null
      const season = match[1].toLowerCase()
      const calendarYear = Number(match[2])
      const startYear = season === 'fall' ? calendarYear : calendarYear - 1
      const order = calendarYear * 10 + ({ winter: 1, spring: 2, summer: 3, fall: 4 }[season] ?? 0)
      return { order, version: `${startYear}-${startYear + 1}`, term: attempt.term }
    })
    .filter((value): value is { order: number; version: string; term: string } => Boolean(value))
    .sort((a, b) => a.order - b.order)
  return datedTerms[0] ?? null
}

export function selectProgramPlan(program: UdSTProgram, attempts: CourseAttempt[], requestedVersion?: string) {
  const plans = program.plans?.length ? program.plans : [{
    id: `${program.id}-${program.planVersion}`,
    version: program.planVersion,
    sourceUrl: program.sourceUrl,
    requiredCredits: program.totalListedCredits || null,
    totalListedCredits: program.totalListedCredits,
    courses: program.courses,
  }]
  const requested = requestedVersion && plans.find((plan) => plan.version === requestedVersion)
  const cohort = inferCohortVersion(attempts)
  if (requested) return { plan: requested, cohort, inferred: false }
  if (!cohort) return { plan: plans.at(-1)!, cohort: null, inferred: true }

  const exact = plans.find((plan) => plan.version === cohort.version)
  if (exact) return { plan: exact, cohort, inferred: true }
  const cohortStart = Number(cohort.version.slice(0, 4))
  const nearest = [...plans].sort((a, b) => {
    const aDistance = Math.abs(Number(a.version.slice(0, 4)) - cohortStart)
    const bDistance = Math.abs(Number(b.version.slice(0, 4)) - cohortStart)
    return aDistance - bDistance
  })[0]
  return { plan: nearest, cohort, inferred: true }
}

export interface ProgramDataset {
  updatedAt: string
  policyVersion: string
  programs: UdSTProgram[]
}

const extractCourseCodes = (requirement: string | null) =>
  requirement?.toUpperCase().match(/[A-Z]{2,8}\s*\d{3,4}[A-Z]?/g)?.map((code) => code.replace(/\s+/g, '')) ?? []

function requirementMet(requirement: string | null, completedCodes: Set<string>, earnedCredits: number) {
  if (!requirement) return true
  const creditMinimum = requirement.match(/(?:min(?:imum)?\.?\s*)?(\d+)\s+credits?/i)
  if (creditMinimum && earnedCredits < Number(creditMinimum[1])) return false

  const alternatives = requirement.split(/\s+OR\s+/i)
  const alternativesWithCourses = alternatives
    .map((alternative) => extractCourseCodes(alternative))
    .filter((codes) => codes.length > 0)
  if (!alternativesWithCourses.length) return !creditMinimum || earnedCredits >= Number(creditMinimum[1])
  return alternativesWithCourses.some((codes) => codes.every((code) => completedCodes.has(code)))
}

export function programProgress(program: ProgramPlan, attempts: CourseAttempt[]) {
  const completedCodes = new Set(
    attempts
      .filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1)
      .map((attempt) => attempt.fullCode.replace(/\s+/g, '').toUpperCase()),
  )
  const activeCodes = new Set(attempts.map((attempt) => attempt.fullCode.replace(/\s+/g, '').toUpperCase()))
  const earnedCredits = attempts
    .filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1)
    .reduce((sum, attempt) => sum + attempt.credits, 0)

  const courses = program.courses.map((course) => {
    const prerequisites = extractCourseCodes(course.prerequisite)
    const corequisites = extractCourseCodes(course.corequisite)
    const completed = completedCodes.has(course.code)
    const prerequisitesMet = requirementMet(course.prerequisite, completedCodes, earnedCredits)
    const corequisitesMet = requirementMet(course.corequisite, activeCodes, earnedCredits)
    const status = completed ? 'completed' : prerequisitesMet ? 'ready' : 'locked'
    return { ...course, prerequisites, corequisites, prerequisitesMet, corequisitesMet, status }
  })

  const requiredCodes = new Set(program.courses.map((course) => course.code))
  const completedRequired = [...completedCodes].filter((code) => requiredCodes.has(code)).length
  const completedCredits = courses
    .filter((course) => course.status === 'completed')
    .reduce((sum, course) => sum + course.credits, 0)

  const requiredCredits = program.requiredCredits || program.totalListedCredits

  return {
    courses,
    completedRequired,
    uniqueRequirements: requiredCodes.size,
    requiredCredits,
    completedCredits,
    percent: requiredCredits ? Math.min(100, Math.round((completedCredits / requiredCredits) * 100)) : 0,
    readyNext: courses.filter((course) => course.status === 'ready').slice(0, 8),
    blocked: courses.filter((course) => course.status === 'locked').slice(0, 8),
  }
}
