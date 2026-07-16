import type { AcademicPlan, CourseAttempt, PlanEntry } from './transcript'

export interface ProgramCourse {
  code: string
  title: string
  prerequisite: string | null
  corequisite: string | null
  credits: number
  semester: string
}

interface RequirementBase {
  id: string
  semester: string
  semesterIndex: number
}

export interface CourseRequirement extends RequirementBase {
  kind: 'course'
  course: ProgramCourse
}

export interface ElectiveGroupRequirement extends RequirementBase {
  kind: 'elective-group'
  label: string
  chooseCount: number
  options: ProgramCourse[]
}

export interface OpenElectiveRequirement extends RequirementBase {
  kind: 'open-elective'
  label: string
  chooseCount: number
  credits: number
}

export type ProgramRequirement = CourseRequirement | ElectiveGroupRequirement | OpenElectiveRequirement

export interface ProgramPlan {
  id: string
  version: string
  sourceUrl: string
  requiredCredits: number | null
  totalListedCredits: number
  courses: ProgramCourse[]
  requirements?: ProgramRequirement[]
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

export interface ProgramDataset {
  schemaVersion?: number
  updatedAt: string
  policyVersion: string
  programs: UdSTProgram[]
}

export type RequirementStatus = 'completed' | 'in-progress' | 'planned' | 'ready' | 'locked'

export interface EvaluatedRequirement {
  id: string
  kind: ProgramRequirement['kind']
  label: string
  semester: string
  semesterIndex: number
  chooseCount: number
  creditsPerSlot: number
  status: RequirementStatus
  prerequisitesMet: boolean
  completedOptions: ProgramCourse[]
  inProgressOptions: ProgramCourse[]
  selectedOptions: ProgramCourse[]
  readyOptions: ProgramCourse[]
  lockedOptions: ProgramCourse[]
  remainingCount: number
  entries: PlanEntry[]
}

const normalizeCode = (code: string) => code.replace(/\s+/g, '').toUpperCase()

export function semesterNumber(semester: string) {
  return Number(semester.match(/semester\s+(\d+)/i)?.[1] ?? 0)
}

export function getPlanRequirements(program: ProgramPlan): ProgramRequirement[] {
  if (program.requirements?.length) return program.requirements
  return program.courses.map((course, index) => ({
    kind: 'course' as const,
    id: `${program.id}-course-${course.code}-${index}`,
    semester: course.semester,
    semesterIndex: semesterNumber(course.semester) || index + 1,
    course,
  }))
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

export const extractCourseCodes = (requirement: string | null) =>
  requirement?.toUpperCase().match(/[A-Z]{2,8}\s*\d{3,4}[A-Z]?/g)?.map(normalizeCode) ?? []

export function requirementMet(requirement: string | null, completedCodes: Set<string>, earnedCredits: number) {
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

function planEntriesFor(plan: AcademicPlan | undefined, requirementId: string) {
  return plan?.entries.filter((entry) => entry.requirementId === requirementId) ?? []
}

export function evaluateProgramRequirements(program: ProgramPlan, attempts: CourseAttempt[], academicPlan?: AcademicPlan) {
  const passedAttempts = attempts.filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1)
  const completedByCode = new Map(passedAttempts.map((attempt) => [normalizeCode(attempt.fullCode), attempt]))
  const inProgressByCode = new Map(
    attempts.filter((attempt) => attempt.grade === 'IP').map((attempt) => [normalizeCode(attempt.fullCode), attempt]),
  )
  const completedCodes = new Set(completedByCode.keys())
  const activeCodes = new Set([...completedCodes, ...inProgressByCode.keys()])
  const earnedCredits = passedAttempts.reduce((sum, attempt) => sum + attempt.credits, 0)
  const consumedCodes = new Set<string>()
  const matchedAttemptIds = new Set<string>()
  const requirements = getPlanRequirements(program)

  // Mandatory requirements take precedence if a code also appears in an elective list.
  requirements.forEach((requirement) => {
    if (requirement.kind !== 'course') return
    const attempt = completedByCode.get(normalizeCode(requirement.course.code))
    if (attempt) {
      consumedCodes.add(normalizeCode(requirement.course.code))
      matchedAttemptIds.add(attempt.id)
    }
  })

  const evaluated = requirements.map<EvaluatedRequirement>((requirement) => {
    const entries = planEntriesFor(academicPlan, requirement.id)
    if (requirement.kind === 'course') {
      const code = normalizeCode(requirement.course.code)
      const completed = completedByCode.has(code)
      const inProgress = inProgressByCode.has(code)
      if (inProgress) matchedAttemptIds.add(inProgressByCode.get(code)!.id)
      const prerequisitesMet = requirementMet(requirement.course.prerequisite, completedCodes, earnedCredits)
      const corequisitesMet = requirementMet(requirement.course.corequisite, activeCodes, earnedCredits)
      const selected = entries.some((entry) => entry.plannedTerm)
      const status: RequirementStatus = completed
        ? 'completed'
        : inProgress
          ? 'in-progress'
          : selected
            ? 'planned'
            : prerequisitesMet && corequisitesMet
              ? 'ready'
              : 'locked'
      return {
        id: requirement.id,
        kind: requirement.kind,
        label: `${requirement.course.code} · ${requirement.course.title}`,
        semester: requirement.semester,
        semesterIndex: requirement.semesterIndex,
        chooseCount: 1,
        creditsPerSlot: requirement.course.credits,
        status,
        prerequisitesMet: prerequisitesMet && corequisitesMet,
        completedOptions: completed ? [requirement.course] : [],
        inProgressOptions: inProgress ? [requirement.course] : [],
        selectedOptions: selected ? [requirement.course] : [],
        readyOptions: prerequisitesMet && corequisitesMet && !completed && !inProgress ? [requirement.course] : [],
        lockedOptions: prerequisitesMet && corequisitesMet ? [] : [requirement.course],
        remainingCount: completed || inProgress ? 0 : 1,
        entries,
      }
    }

    if (requirement.kind === 'open-elective') {
      const matches = academicPlan?.manualRequirementMatches?.[requirement.id] ?? []
      const completedMatches = matches.filter((code) => completedByCode.has(normalizeCode(code))).slice(0, requirement.chooseCount)
      completedMatches.forEach((code) => {
        const attempt = completedByCode.get(normalizeCode(code))
        if (attempt) matchedAttemptIds.add(attempt.id)
      })
      const plannedMatches = entries.filter((entry) => entry.courseCode && !completedMatches.includes(entry.courseCode))
      const remainingCount = Math.max(0, requirement.chooseCount - completedMatches.length)
      return {
        id: requirement.id,
        kind: requirement.kind,
        label: requirement.label,
        semester: requirement.semester,
        semesterIndex: requirement.semesterIndex,
        chooseCount: requirement.chooseCount,
        creditsPerSlot: requirement.credits / Math.max(1, requirement.chooseCount),
        status: remainingCount === 0 ? 'completed' : plannedMatches.length >= remainingCount ? 'planned' : 'ready',
        prerequisitesMet: true,
        completedOptions: [],
        inProgressOptions: [],
        selectedOptions: [],
        readyOptions: [],
        lockedOptions: [],
        remainingCount,
        entries,
      }
    }

    const availableCompleted = requirement.options.filter((option) => {
      const code = normalizeCode(option.code)
      return completedByCode.has(code) && !consumedCodes.has(code)
    })
    const completedOptions = availableCompleted.slice(0, requirement.chooseCount)
    completedOptions.forEach((option) => {
      const code = normalizeCode(option.code)
      consumedCodes.add(code)
      const attempt = completedByCode.get(code)
      if (attempt) matchedAttemptIds.add(attempt.id)
    })

    const availableInProgress = requirement.options.filter((option) => {
      const code = normalizeCode(option.code)
      return inProgressByCode.has(code) && !consumedCodes.has(code)
    })
    const inProgressOptions = availableInProgress.slice(0, Math.max(0, requirement.chooseCount - completedOptions.length))
    inProgressOptions.forEach((option) => {
      const code = normalizeCode(option.code)
      consumedCodes.add(code)
      matchedAttemptIds.add(inProgressByCode.get(code)!.id)
    })

    const selectedOptions = entries
      .map((entry) => requirement.options.find((option) => normalizeCode(option.code) === normalizeCode(entry.courseCode ?? '')))
      .filter((option): option is ProgramCourse => Boolean(option))
      .filter((option, index, list) => list.findIndex((item) => item.code === option.code) === index)
      .filter((option) => !consumedCodes.has(normalizeCode(option.code)))
      .slice(0, Math.max(0, requirement.chooseCount - completedOptions.length - inProgressOptions.length))

    const readyOptions = requirement.options.filter((option) => {
      const code = normalizeCode(option.code)
      return !consumedCodes.has(code)
        && requirementMet(option.prerequisite, completedCodes, earnedCredits)
        && requirementMet(option.corequisite, activeCodes, earnedCredits)
    })
    const lockedOptions = requirement.options.filter((option) => !readyOptions.includes(option) && !completedOptions.includes(option))
    const satisfiedCount = completedOptions.length + inProgressOptions.length
    const remainingCount = Math.max(0, requirement.chooseCount - satisfiedCount)
    const status: RequirementStatus = completedOptions.length >= requirement.chooseCount
      ? 'completed'
      : satisfiedCount >= requirement.chooseCount
        ? 'in-progress'
        : satisfiedCount + selectedOptions.length >= requirement.chooseCount
          ? 'planned'
          : readyOptions.length
            ? 'ready'
            : 'locked'

    return {
      id: requirement.id,
      kind: requirement.kind,
      label: requirement.label,
      semester: requirement.semester,
      semesterIndex: requirement.semesterIndex,
      chooseCount: requirement.chooseCount,
      creditsPerSlot: requirement.options[0]?.credits ?? 0,
      status,
      prerequisitesMet: readyOptions.length > 0,
      completedOptions,
      inProgressOptions,
      selectedOptions,
      readyOptions,
      lockedOptions,
      remainingCount,
      entries,
    }
  })

  return { requirements: evaluated, matchedAttemptIds: [...matchedAttemptIds] }
}

export function programProgress(program: ProgramPlan, attempts: CourseAttempt[], academicPlan?: AcademicPlan) {
  const evaluation = evaluateProgramRequirements(program, attempts, academicPlan)
  const completedCredits = evaluation.requirements.reduce((sum, requirement) => {
    if (requirement.kind === 'open-elective') {
      const completedCount = requirement.chooseCount - requirement.remainingCount
      return sum + completedCount * requirement.creditsPerSlot
    }
    return sum + requirement.completedOptions.reduce((credits, course) => credits + course.credits, 0)
  }, 0)
  const requiredCredits = program.requiredCredits || evaluation.requirements.reduce(
    (sum, requirement) => sum + requirement.chooseCount * requirement.creditsPerSlot,
    0,
  )
  const completedRequired = evaluation.requirements.filter((requirement) => requirement.status === 'completed').length

  return {
    ...evaluation,
    completedRequired,
    uniqueRequirements: evaluation.requirements.length,
    requiredCredits,
    completedCredits,
    percent: requiredCredits ? Math.min(100, Math.round((completedCredits / requiredCredits) * 100)) : 0,
    readyNext: evaluation.requirements.filter((requirement) => requirement.status === 'ready').slice(0, 8),
    blocked: evaluation.requirements.filter((requirement) => requirement.status === 'locked').slice(0, 8),
  }
}
