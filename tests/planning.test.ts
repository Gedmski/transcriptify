import { describe, expect, it } from 'vitest'
import dataset from '../data/udst-programs.json'
import type { ProgramDataset, ProgramPlan } from '../domain/programs'
import { programProgress } from '../domain/programs'
import {
  buildAcademicTimeline,
  buildAcademicTermOptions,
  buildAcademicYearOptions,
  calculatePlanProjection,
  createAcademicPlan,
  normalizeAcademicTerm,
  remainingProgramCredits,
} from '../domain/planning'
import {
  type CourseAttempt,
  calculateStats,
  migrateTranscriptDocument,
} from '../domain/transcript'

const programs = (dataset as ProgramDataset).programs
const dsai = programs.find((program) => program.id.includes('data-science-and-artificial-intelligence'))!

function attempt(code: string, term = 'Fall 2022', grade = 'B+', credits = 3): CourseAttempt {
  const [prefix = '', number = ''] = code.match(/^([A-Z]+)(\d.*)$/)?.slice(1) ?? []
  const gradePoints = grade === 'IP' ? null : grade === 'A' ? 4 : grade === 'B+' ? 3.5 : 3
  return {
    id: `${code}-${term}-${grade}`,
    term,
    code: prefix,
    number,
    fullCode: code,
    title: code,
    credits,
    grade,
    gradePoints,
    points: gradePoints === null ? 0 : gradePoints * credits,
    includedInGpa: gradePoints !== null,
    status: grade === 'IP' ? 'incomplete' : 'completed',
    validation: 'verified',
    original: { term, fullCode: code, title: code, credits, grade, points: gradePoints === null ? 0 : gradePoints * credits },
  }
}

describe('elective-aware program progress', () => {
  it('satisfies the 2022 EFFL group with one completed option', () => {
    const plan = dsai.plans.find((item) => item.version === '2022-2023')!
    const progress = programProgress(plan, [attempt('EFFL1001')])
    const group = progress.requirements.find((requirement) => requirement.label.includes('Effective'))!
    expect(group.status).toBe('completed')
    expect(group.completedOptions.map((course) => course.code)).toEqual(['EFFL1001'])
    expect(progress.readyNext.flatMap((requirement) => requirement.readyOptions).map((course) => course.code)).not.toContain('EFFL1002')
  })

  it('consumes distinct courses across repeated GARC groups', () => {
    const plan = dsai.plans.find((item) => item.version === '2026-2027')!
    const one = programProgress(plan, [attempt('GARC1001')])
    const groupsOne = one.requirements.filter((requirement) => requirement.readyOptions.some((course) => course.code.startsWith('GARC')) || requirement.completedOptions.some((course) => course.code.startsWith('GARC')))
    expect(groupsOne.filter((group) => group.status === 'completed')).toHaveLength(1)
    const two = programProgress(plan, [attempt('GARC1001'), attempt('GARC2001', 'Winter 2023')])
    const groupsTwo = two.requirements.filter((requirement) => requirement.completedOptions.some((course) => course.code.startsWith('GARC')))
    expect(groupsTwo).toHaveLength(2)
  })

  it('keeps a select-two group incomplete until two options are complete', () => {
    const plan = dsai.plans.find((item) => item.version === '2026-2027')!
    const one = programProgress(plan, [attempt('DSAI4201')])
    const groupOne = one.requirements.find((requirement) => requirement.label === 'Elective' && requirement.chooseCount === 2)!
    expect(groupOne.remainingCount).toBe(1)
    const two = programProgress(plan, [attempt('DSAI4201'), attempt('DSAI4202', 'Winter 2023')])
    const groupTwo = two.requirements.find((requirement) => requirement.label === 'Elective' && requirement.chooseCount === 2)!
    expect(groupTwo.status).toBe('completed')
    expect(groupTwo.completedOptions).toHaveLength(2)
  })
})

describe('planning, timeline, and projection', () => {
  const miniPlan: ProgramPlan = {
    id: 'mini-2022',
    version: '2022-2023',
    sourceUrl: 'https://www.udst.edu.qa/',
    requiredCredits: 6,
    totalListedCredits: 6,
    courses: [
      { code: 'TEST1001', title: 'First', prerequisite: null, corequisite: null, credits: 3, semester: 'SEMESTER 1' },
      { code: 'TEST1002', title: 'Second', prerequisite: 'TEST1001', corequisite: null, credits: 3, semester: 'SEMESTER 2' },
    ],
    requirements: [
      { kind: 'course', id: 'first', semester: 'SEMESTER 1', semesterIndex: 1, course: { code: 'TEST1001', title: 'First', prerequisite: null, corequisite: null, credits: 3, semester: 'SEMESTER 1' } },
      { kind: 'course', id: 'second', semester: 'SEMESTER 2', semesterIndex: 2, course: { code: 'TEST1002', title: 'Second', prerequisite: 'TEST1001', corequisite: null, credits: 3, semester: 'SEMESTER 2' } },
    ],
  }

  it('maps semester one to the first transcript term and marks the current gap as watch', () => {
    const attempts = [attempt('TEST1001', 'Fall 2022')]
    const academicPlan = createAcademicPlan('mini', miniPlan, attempts)
    const timeline = buildAcademicTimeline(miniPlan, attempts, academicPlan)
    expect(academicPlan.startTerm).toBe('Fall 2022')
    expect(timeline.currentTerm).toBe('Winter 2023')
    expect(timeline.rows.find((row) => row.code === 'TEST1002')?.expectedTerm).toBe('Winter 2023')
    expect(timeline.status).toBe('Watch')
  })

  it('labels a course taken after its expected term as late', () => {
    const attempts = [attempt('TEST1001', 'Fall 2022'), attempt('TEST1002', 'Spring 2023')]
    const academicPlan = createAcademicPlan('mini', miniPlan, attempts)
    const timeline = buildAcademicTimeline(miniPlan, attempts, academicPlan)
    expect(timeline.rows.find((row) => row.code === 'TEST1002')?.status).toBe('late')
  })

  it('projects cumulative GPA only from explicit expected grades', () => {
    const attempts = [attempt('TEST1001', 'Fall 2022', 'B+')]
    const academicPlan = createAcademicPlan('mini', miniPlan, attempts)
    const second = academicPlan.entries.find((entry) => entry.requirementId === 'second')!
    second.expectedGrade = 'A'
    const projection = calculatePlanProjection(calculateStats(attempts), miniPlan, attempts, academicPlan)
    expect(projection.gradedCourses).toBe(1)
    expect(projection.projectedCgpa).toBe(3.75)
  })

  it('preserves an intentionally cleared future term instead of auto-seeding it again', () => {
    const attempts = [attempt('TEST1001', 'Fall 2022')]
    const academicPlan = createAcademicPlan('mini', miniPlan, attempts)
    academicPlan.entries.find((entry) => entry.requirementId === 'second')!.plannedTerm = ''
    const regenerated = createAcademicPlan('mini', miniPlan, attempts, academicPlan)
    expect(regenerated.entries.find((entry) => entry.requirementId === 'second')?.plannedTerm).toBe('')
  })

  it('derives future credits from the official program balance', () => {
    expect(remainingProgramCredits(126, 47)).toBe(79)
    expect(remainingProgramCredits(126, 130)).toBe(0)
  })

  it('normalizes and validates typed academic terms', () => {
    expect(normalizeAcademicTerm('  fall   2026 ')).toBe('Fall 2026')
    expect(normalizeAcademicTerm('Autumn 2026')).toBeNull()
    expect(normalizeAcademicTerm('Fall 26')).toBeNull()
  })

  it('builds chronological term suggestions around the known plan range', () => {
    const options = buildAcademicTermOptions(['Fall 2025', 'Spring 2027'], 0)
    expect(options).toContain('Summer 2026')
    expect(options.indexOf('Fall 2025')).toBeLessThan(options.indexOf('Winter 2026'))
    expect(options.indexOf('Winter 2027')).toBeLessThan(options.indexOf('Spring 2027'))
  })

  it('limits the native year selector to the relevant academic range', () => {
    expect(buildAcademicYearOptions(['Fall 2024', 'Spring 2028'], 1)).toEqual(['2023', '2024', '2025', '2026', '2027', '2028', '2029'])
  })
})

describe('transcript migration', () => {
  it('migrates a v2 document without losing attempts', () => {
    const legacy = {
      schemaVersion: 2,
      institutionId: 'udst',
      adapterVersion: 'udst-2026.1',
      importedAt: new Date().toISOString(),
      verificationStatus: 'verified',
      attempts: [attempt('TEST1001')],
      warnings: [],
    }
    const migrated = migrateTranscriptDocument(legacy)
    expect(migrated?.schemaVersion).toBe(3)
    expect(migrated?.attempts).toHaveLength(1)
    expect(migrated?.academicPlans).toEqual({})
  })
})
