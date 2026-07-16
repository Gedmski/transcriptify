'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CircleHelp, Route, Sparkles, Target } from 'lucide-react'
import {
  type AcademicPlan,
  type CourseAttempt,
  type PlanEntry,
  type TranscriptStats,
  calculatePrefixStats,
} from '@/domain/transcript'
import {
  type ProgramPlan,
  type UdSTProgram,
  getPlanRequirements,
  programProgress,
} from '@/domain/programs'
import {
  type AcademicTimelineRow,
  buildAcademicTimeline,
  buildTermEvaluations,
  calculatePlanProjection,
  deriveFamilyInsights,
} from '@/domain/planning'
import { TermPicker } from './term-combobox'

type EntryPatch = Partial<Pick<PlanEntry, 'courseCode' | 'plannedTerm' | 'expectedGrade'>>

const gradeChoices = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'AF']

function polarPoint(index: number, count: number, radius: number, center = 190) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / count
  return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`
}

export function CourseFamilyRadar({ attempts, overallGpa }: { attempts: CourseAttempt[]; overallGpa: number }) {
  const families = useMemo(() => calculatePrefixStats(attempts), [attempts])
  const defaultPrefixes = families.slice(0, 8).map((family) => family.prefix)
  const [selectedPrefixes, setSelectedPrefixes] = useState(defaultPrefixes)
  const visible = families.filter((family) => selectedPrefixes.includes(family.prefix)).slice(0, 8)
  const count = visible.length
  const chartRadius = 132
  const gridLevels = [1, 2, 3, 4]

  const togglePrefix = (prefix: string) => {
    setSelectedPrefixes((current) => {
      if (current.includes(prefix)) return current.length > 3 ? current.filter((item) => item !== prefix) : current
      if (current.length < 8) return [...current, prefix]
      return [...current.slice(0, 7), prefix]
    })
  }

  if (count < 3) return <div className="empty-state"><CircleHelp size={28} /><h3>More families needed for a radar</h3><p>At least three GPA-bearing course prefixes are required.</p></div>

  const familyPolygon = visible.map((family, index) => polarPoint(index, count, chartRadius * family.gpa / 4)).join(' ')
  const referencePolygon = visible.map((_, index) => polarPoint(index, count, chartRadius * overallGpa / 4)).join(' ')
  const label = visible.map((family) => `${family.prefix} ${family.gpa.toFixed(2)}`).join(', ')

  return <div className="radar-layout">
    <div className="radar-canvas">
      <svg viewBox="0 0 380 380" role="img" aria-label={`Course-family GPA radar. ${label}. Overall CGPA reference ${overallGpa.toFixed(2)}.`}>
        {gridLevels.map((level) => <polygon className="radar-grid-line" key={level} points={visible.map((_, index) => polarPoint(index, count, chartRadius * level / 4)).join(' ')} />)}
        {visible.map((family, index) => <g key={family.prefix}>
          <line className="radar-spoke" x1="190" y1="190" x2={polarPoint(index, count, chartRadius).split(',')[0]} y2={polarPoint(index, count, chartRadius).split(',')[1]} />
          <text className="radar-label" x={polarPoint(index, count, 162).split(',')[0]} y={polarPoint(index, count, 162).split(',')[1]}>{family.prefix}</text>
        </g>)}
        <polygon className="radar-reference" points={referencePolygon} />
        <polygon className="radar-value" points={familyPolygon} />
        {visible.map((family, index) => <circle className="radar-dot" key={family.prefix} cx={polarPoint(index, count, chartRadius * family.gpa / 4).split(',')[0]} cy={polarPoint(index, count, chartRadius * family.gpa / 4).split(',')[1]} r="4" />)}
      </svg>
      <div className="radar-legend"><span><i className="family-key" /> Family GPA</span><span><i className="cgpa-key" /> Overall CGPA</span></div>
    </div>
    <div className="radar-notes"><p className="eyebrow">Choose up to eight spokes</p><div className="radar-prefixes">{families.map((family) => <button aria-pressed={selectedPrefixes.includes(family.prefix)} className={selectedPrefixes.includes(family.prefix) ? 'active' : ''} key={family.prefix} onClick={() => togglePrefix(family.prefix)}><strong>{family.prefix}</strong><span>{family.gpa.toFixed(2)}</span><small>{family.credits.toFixed(0)} CR</small></button>)}</div></div>
    <table className="sr-only"><caption>Course-family radar data</caption><tbody>{visible.map((family) => <tr key={family.prefix}><th>{family.prefix}</th><td>{family.gpa.toFixed(2)}</td><td>{family.credits.toFixed(1)} credits</td></tr>)}</tbody></table>
  </div>
}

function TimelineCell({ row, term }: { row: AcademicTimelineRow; term: string }) {
  const expected = row.expectedTerm === term
  const actual = row.actualTerm === term
  const planned = row.plannedTerm === term && !actual
  if (!expected && !actual && !planned) return <td aria-label={`${term}: no placement`} />
  return <td className="timeline-cell" aria-label={`${term}: ${expected ? 'officially expected' : ''} ${actual ? row.status : ''} ${planned ? 'planned' : ''}`}>
    {expected && <i className="expected-mark" title="Official study plan" />}
    {actual && <b className={`timeline-mark ${row.status}`}>{row.status === 'in-progress' ? 'IP' : <Check size={12} />}</b>}
    {planned && <b className={`timeline-mark planned ${row.status === 'overdue' ? 'delayed' : ''}`}><ChevronRight size={12} /></b>}
  </td>
}

export function AcademicTimeline({ timeline }: { timeline: ReturnType<typeof buildAcademicTimeline> }) {
  return <section className="panel timeline-panel">
    <div className="panel-heading timeline-heading"><div><p className="eyebrow">Official vs actual vs planned</p><h2>Academic semester rail</h2></div><div className={`track-status track-${timeline.status.toLowerCase().replace(' ', '-')}`}><Route size={18} /><span><small>Schedule signal</small><strong>{timeline.status}</strong></span></div></div>
    <div className="timeline-scorecard"><span><b>{timeline.counts.early}</b> early</span><span><b>{timeline.counts.onTime}</b> on time</span><span><b>{timeline.counts.late}</b> late</span><span><b>{timeline.counts.overdue}</b> overdue</span><span><b>{timeline.counts.unmatched}</b> unmatched</span></div>
    <div className="timeline-legend"><span><i className="legend-expected" /> Official</span><span><i className="legend-completed" /> Completed</span><span><i className="legend-ip" /> In progress</span><span><i className="legend-planned" /> Planned</span><span><i className="legend-overdue" /> Overdue</span></div>
    <div className="timeline-scroll" tabIndex={0} role="region" aria-label="Scrollable academic Gantt timeline">
      <table className="timeline-table">
        <thead><tr><th className="timeline-course-column">Requirement</th>{timeline.terms.map((term) => { const summary = timeline.summaries.find((item) => item.term === term); return <th key={term}><strong>{term}</strong><small>{summary?.expectedCredits ?? 0} expected<br />{(summary?.completedCredits ?? 0) + (summary?.plannedCredits ?? 0)} actual/planned</small></th> })}</tr></thead>
        <tbody>{timeline.rows.map((row) => <tr className={`timeline-row status-${row.status}`} key={row.id}><th className="timeline-course-column"><span>{row.code || (row.kind === 'elective' ? 'ELECTIVE' : 'EXTRA')}</span><strong>{row.title}</strong><small>{row.credits} CR · {row.semester}</small></th>{timeline.terms.map((term) => <TimelineCell key={term} row={row} term={term} />)}</tr>)}</tbody>
      </table>
    </div>
    <p className="timeline-caveat"><AlertTriangle size={15} /> “Behind” means a published requirement from a prior mapped semester is still unmatched. It does not account for approved substitutions or adviser exceptions.</p>
  </section>
}

export function CourseGradePlanner({ stats, plan, attempts, academicPlan, targetCgpa, onEntryChange }: {
  stats: TranscriptStats
  plan: ProgramPlan
  attempts: CourseAttempt[]
  academicPlan: AcademicPlan
  targetCgpa: number
  onEntryChange: (entryId: string, patch: EntryPatch) => void
}) {
  const requirements = getPlanRequirements(plan)
  const completedCodes = new Set(attempts.filter((attempt) => attempt.status === 'completed' && (attempt.gradePoints ?? 0) >= 1).map((attempt) => attempt.fullCode))
  const visibleEntries = academicPlan.entries.filter((entry) => !entry.courseCode || !completedCodes.has(entry.courseCode))
  const projection = calculatePlanProjection(stats, plan, attempts, academicPlan)
  const knownTerms = [academicPlan.startTerm, ...attempts.map((attempt) => attempt.term), ...academicPlan.entries.map((entry) => entry.plannedTerm)]
  const applyPreset = (grade: string) => visibleEntries.forEach((entry) => {
    if (!entry.expectedGrade && entry.courseCode && entry.plannedTerm) onEntryChange(entry.id, { expectedGrade: grade })
  })

  return <section className="panel course-predictor">
    <div className="panel-heading"><div><p className="eyebrow">Course-level forecast</p><h2>Build the GPA one course at a time</h2></div><div className="prediction-total"><span>Projected CGPA</span><strong>{projection.projectedCgpa.toFixed(2)}</strong><small>{(projection.projectedCgpa - targetCgpa).toFixed(2)} vs target</small></div></div>
    <div className="preset-row"><span>Fill blank grades:</span><button onClick={() => applyPreset('C+')}>C+ cautious</button><button onClick={() => applyPreset('B')}>B expected</button><button onClick={() => applyPreset('B+')}>B+ stretch</button></div>
    <div className="prediction-table-wrap"><table className="prediction-table"><thead><tr><th>Requirement</th><th>Course choice</th><th>Planned term</th><th>Expected grade</th></tr></thead><tbody>{visibleEntries.map((entry) => {
      const requirement = requirements.find((item) => item.id === entry.requirementId)
      if (!requirement) return null
      const fixedCourse = requirement.kind === 'course' ? requirement.course : undefined
      const options = requirement.kind === 'elective-group' ? requirement.options : []
      const label = requirement.kind === 'course' ? fixedCourse!.title : requirement.label
      return <tr key={entry.id}><td><strong>{fixedCourse?.code ?? `Choice ${entry.slot + 1}`}</strong><span>{label}</span></td><td>{fixedCourse ? <span>{fixedCourse.code}</span> : requirement.kind === 'elective-group' ? <select aria-label={`${label} course choice`} value={entry.courseCode ?? ''} onChange={(event) => onEntryChange(entry.id, { courseCode: event.target.value || undefined })}><option value="">Choose an option</option>{options.map((option) => <option key={option.code} value={option.code}>{option.code} · {option.title}</option>)}</select> : <input aria-label={`${label} mapped course`} value={entry.courseCode ?? ''} placeholder="Approved course code" onChange={(event) => onEntryChange(entry.id, { courseCode: event.target.value.toUpperCase() || undefined })} />}</td><td><TermPicker ariaLabel={`${label} planned term`} value={entry.plannedTerm ?? ''} knownTerms={knownTerms} onChange={(value) => onEntryChange(entry.id, { plannedTerm: value })} /></td><td><select aria-label={`${label} expected grade`} value={entry.expectedGrade ?? ''} disabled={!entry.courseCode || !entry.plannedTerm} onChange={(event) => onEntryChange(entry.id, { expectedGrade: event.target.value || undefined })}><option value="">Not predicted</option>{gradeChoices.map((grade) => <option key={grade}>{grade}</option>)}</select></td></tr>
    })}</tbody></table></div>
    <div className="projection-terms">{projection.terms.map((term) => <article key={term.term}><span>{term.term}</span><strong>{term.gpa.toFixed(2)}</strong><small>{term.credits} credits · CGPA {term.cumulativeGpa.toFixed(2)}</small></article>)}</div>
    <p className="disclaimer">{projection.gradedCourses} predicted course{projection.gradedCourses === 1 ? '' : 's'} included; {projection.ungradedCourses} still blank. Predictions are planning assumptions, not recorded grades.</p>
  </section>
}

export function DetailedAcademicReport({ stats, attempts, program, plan, progress, timeline, projection }: {
  stats: TranscriptStats
  attempts: CourseAttempt[]
  program?: UdSTProgram
  plan?: ProgramPlan
  progress: ReturnType<typeof programProgress> | null
  timeline?: ReturnType<typeof buildAcademicTimeline>
  projection?: ReturnType<typeof calculatePlanProjection>
}) {
  const terms = buildTermEvaluations(attempts, timeline)
  const insights = deriveFamilyInsights(attempts)
  const repeats = attempts.filter((attempt) => !attempt.includedInGpa).length
  const unresolved = attempts.filter((attempt) => ['IP', 'I', 'NS'].includes(attempt.grade)).length
  return <section className="report-paper detailed-report">
    <header><div><p>TRANSCRIPTIFY · UNOFFICIAL ACADEMIC REPORT</p><h2>{program?.name.replace(/\s*\([^)]*\)\s*$/, '') ?? 'UDST academic performance'}</h2></div><span>{plan ? `${plan.version} study plan` : 'No plan selected'}<br />Generated {new Date().toLocaleDateString('en-QA', { dateStyle: 'medium' })}</span></header>
    <div className="report-summary"><div><span>Verified CGPA</span><strong>{stats.cgpa.toFixed(2)}</strong></div><div><span>GPA credits</span><strong>{stats.totalCredits.toFixed(1)}</strong></div><div><span>Schedule</span><strong className="report-word">{timeline?.status ?? '—'}</strong></div><div><span>Plan complete</span><strong>{progress ? `${progress.percent}%` : '—'}</strong></div></div>
    <div className="report-section-grid"><section><h3>Academic standing</h3><p>Your calculated CGPA is <strong>{stats.cgpa.toFixed(2)}</strong>, which {stats.cgpa >= 2 ? 'is at or above' : 'is below'} UDST’s published 2.00 clear-standing threshold. {repeats} lower repeat attempt{repeats === 1 ? ' is' : 's are'} excluded.</p></section><section><h3>Schedule adherence</h3><p>{timeline ? `${timeline.counts.onTime} requirements were completed on time, ${timeline.counts.early} early, ${timeline.counts.late} late, and ${timeline.counts.overdue} remain overdue. ${timeline.counts.unmatched} transcript course(s) are not matched to the selected plan.` : 'Select a program and study-plan version to evaluate schedule alignment.'}</p></section><section><h3>Program requirements</h3><p>{progress ? `${progress.completedCredits.toFixed(1)} of ${progress.requiredCredits.toFixed(1)} credits currently match mandatory courses or fulfilled elective slots. ${progress.readyNext.length} requirement group(s) are ready next.` : 'Program requirements have not been matched.'}</p></section><section><h3>Projection</h3><p>{projection?.gradedCourses ? `${projection.gradedCourses} course predictions produce a projected CGPA of ${projection.projectedCgpa.toFixed(2)} across ${projection.projectedCredits.toFixed(1)} GPA credits.` : 'No expected grades have been entered. Use Plan to build a course-level forecast.'}</p></section></div>
    <section className="report-detail-section"><div className="report-section-heading"><div><p className="eyebrow">Term-by-term</p><h3>Progress and evaluation</h3></div><span>{unresolved} unresolved attempt{unresolved === 1 ? '' : 's'}</span></div><div className="report-table-wrap"><table className="report-term-table"><thead><tr><th>Term</th><th>Term GPA</th><th>Cumulative</th><th>GPA credits</th><th>Plan expected</th><th>Evaluation</th></tr></thead><tbody>{terms.map((term) => <tr key={term.term}><th>{term.term}</th><td>{term.cgpa.toFixed(2)}</td><td>{term.cumulativeGpa.toFixed(2)}</td><td>{term.totalCredits.toFixed(1)}</td><td>{term.expectedCredits ? term.expectedCredits.toFixed(1) : '—'}</td><td><span className={`momentum momentum-${term.momentum}`}>{term.momentum}</span>{term.expectedCredits ? <small>{term.planVariance >= 0 ? '+' : ''}{term.planVariance.toFixed(1)} earned-credit variance</small> : null}</td></tr>)}</tbody></table></div></section>
    <div className="report-strength-grid"><section><h3><Sparkles size={17} /> Demonstrated strengths</h3>{insights.strengths.length ? insights.strengths.map((family) => <p key={family.prefix}><strong>{family.prefix}</strong> · {family.gpa.toFixed(2)} GPA across {family.credits.toFixed(1)} credits</p>) : <p>No family has enough evidence and a ≥0.20 positive difference yet.</p>}</section><section><h3><Target size={17} /> Focus areas</h3>{insights.focusAreas.length ? insights.focusAreas.map((family) => <p key={family.prefix}><strong>{family.prefix}</strong> · {family.gpa.toFixed(2)} GPA across {family.credits.toFixed(1)} credits</p>) : <p>No established course family meets the focus-area threshold.</p>}</section></div>
    <footer>Deterministic planning analysis from verified transcript rows and the selected UDST public study plan. Family labels require at least 6 GPA credits. Schedule mappings and student-declared substitutions remain unofficial; confirm registration and graduation requirements with an academic adviser.</footer>
  </section>
}
