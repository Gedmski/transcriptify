import { describe, expect, it } from 'vitest'
import { extractPlanRequirements, extractRequiredCredits, flattenCourses } from '../scripts/udst-plan-parser.mjs'
import type { ProgramRequirement } from '../domain/programs'

const fixture = `
<table>
  <tr><th>SEMESTER 1</th></tr>
  <tr><td>CORE1001</td><td>Core Course</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td colspan="7">Elective: Select 1 of 2</td></tr>
  <tr><td>ELEC1001</td><td>Option One</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>ELEC1002</td><td>Option Two</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>Semester 1 Total:</td><td></td><td></td><td></td><td>6</td><td>6</td><td>0</td></tr>
  <tr><th>SEMESTER 2</th></tr>
  <tr><td colspan="7">Program Elective: Select 2 of 3</td></tr>
  <tr><td>ELEC2001</td><td>Option A</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>ELEC2002</td><td>Option B</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>ELEC2003</td><td>Option C</td><td>-</td><td>-</td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>Mathematics &amp; Natural Sciences Elective</td><td></td><td></td><td></td><td>3</td><td>3</td><td>0</td></tr>
  <tr><td>Program Total</td><td></td><td></td><td></td><td>15</td><td>15</td><td>0</td></tr>
</table>`

describe('UDST source-plan parser', () => {
  it('preserves mandatory, grouped, and open elective requirements', () => {
    const requirements = extractPlanRequirements(fixture, 'fixture') as ProgramRequirement[]
    expect(requirements.filter((requirement) => requirement.kind === 'course')).toHaveLength(1)
    const groups = requirements.filter((requirement) => requirement.kind === 'elective-group')
    expect(groups.map((group) => [group.chooseCount, group.options.length])).toEqual([[1, 2], [2, 3]])
    expect(requirements.find((requirement) => requirement.kind === 'open-elective')).toMatchObject({ credits: 3, chooseCount: 1 })
    expect(flattenCourses(requirements)).toHaveLength(6)
  })

  it('extracts the official program total', () => {
    expect(extractRequiredCredits(fixture)).toBe(15)
  })
})
