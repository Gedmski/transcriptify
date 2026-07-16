import {
  CourseAttempt,
  GRADE_POINTS,
  TranscriptDocument,
  gradeStatus,
  normalizeGrade,
  reconcileRepeats,
} from './transcript'

const TERM_PATTERN = /(Fall|Winter|Spring|Summer)\s+(20\d{2})/gi
const COURSE_PATTERN = /([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\s+((?:(?![A-Z]{2,8}\s*[- ]?\s*\d{3,4}).)+?)\s+(\d+(?:\.\d{1,2})?)\s+(\d+(?:\.\d{1,2})?)\s+(A|B\+?|C\+?|D\+?|F|AF|W|I|IP|AU|EN|EX|P|S|U|TR|NS)\s+(\d+(?:\.\d{1,2})?)/gi

const stableId = (value: string, index: number) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`

export function parseUdSTTranscript(rawText: string): TranscriptDocument {
  const terms: { term: string; index: number }[] = []
  let termMatch: RegExpExecArray | null
  while ((termMatch = TERM_PATTERN.exec(rawText)) !== null) {
    terms.push({ term: `${termMatch[1]} ${termMatch[2]}`, index: termMatch.index })
  }

  const attempts: CourseAttempt[] = []
  const warnings: string[] = []
  let courseMatch: RegExpExecArray | null

  while ((courseMatch = COURSE_PATTERN.exec(rawText)) !== null) {
    const code = courseMatch[1].toUpperCase()
    const number = courseMatch[2].toUpperCase()
    const fullCode = `${code}${number}`
    const attemptedCredits = Number(courseMatch[4])
    const earnedCredits = Number(courseMatch[5])
    const grade = normalizeGrade(courseMatch[6])
    const reportedPoints = Number(courseMatch[7])
    const gradePoints = GRADE_POINTS[grade] ?? null
    const expectedPoints = gradePoints === null ? 0 : attemptedCredits * gradePoints
    const term = [...terms].reverse().find((candidate) => candidate.index < courseMatch!.index)?.term ?? 'Unknown term'
    const issues: string[] = []

    if (term === 'Unknown term') issues.push('Term could not be identified.')
    if (attemptedCredits < 0 || attemptedCredits > 12) issues.push('Credit value is outside the supported range.')
    if (!(grade in GRADE_POINTS)) issues.push('Grade is not in the current UDST rule set.')
    if (gradePoints !== null && Math.abs(expectedPoints - reportedPoints) > 0.06) {
      issues.push(`Quality points should be ${expectedPoints.toFixed(2)} for this grade and credit value.`)
    }

    attempts.push({
      id: stableId(`${term}-${fullCode}`, attempts.length),
      term,
      code,
      number,
      fullCode,
      title: courseMatch[3].trim(),
      credits: attemptedCredits || earnedCredits,
      grade,
      gradePoints,
      points: reportedPoints,
      includedInGpa: gradePoints !== null,
      status: gradeStatus(grade),
      validation: issues.length ? 'warning' : 'verified',
      warning: issues.join(' '),
      original: {
        term,
        fullCode,
        title: courseMatch[3].trim(),
        credits: attemptedCredits || earnedCredits,
        grade,
        points: reportedPoints,
      },
    })
  }

  if (!attempts.length) warnings.push('No supported course rows were found in this PDF.')
  if (attempts.some((attempt) => attempt.term === 'Unknown term')) warnings.push('One or more course rows are missing a term.')

  const reconciled = reconcileRepeats(attempts)
  if (reconciled.some((attempt) => attempt.warning?.includes('repeated'))) {
    warnings.push('Repeated courses were detected; only the highest attempt is included in CGPA.')
  }

  return {
    schemaVersion: 3,
    institutionId: 'udst',
    adapterVersion: 'udst-2026.1',
    importedAt: new Date().toISOString(),
    verificationStatus: warnings.length || reconciled.some((attempt) => attempt.validation !== 'verified') ? 'warnings' : 'unreviewed',
    attempts: reconciled,
    warnings,
  }
}
