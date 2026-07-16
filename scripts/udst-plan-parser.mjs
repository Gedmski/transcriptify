export const decodeHtml = (value) => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '\u2013')
  .replace(/&mdash;|&#8212;/gi, '\u2014')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

export const cleanText = (value = '') => decodeHtml(value
  .replace(/<br\s*\/?>/gi, ' / ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim())

export const slugify = (value) => value
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const courseFromCells = (cells, semester) => {
  const code = (cells[0] || '').replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2,8}\d{3,4}[A-Z]?$/.test(code)) return null
  const creditIndex = cells.findIndex((cell, index) => index >= 4 && /^\d+(?:\.\d+)?$/.test(cell))
  return {
    code,
    title: cells[1] || code,
    prerequisite: cells[2] && cells[2] !== '-' ? cells[2] : null,
    corequisite: cells[3] && cells[3] !== '-' ? cells[3] : null,
    credits: creditIndex >= 0 ? Number(cells[creditIndex]) : 0,
    semester,
  }
}

const electiveSelection = (text) => {
  const match = text.match(/^(.{0,180}?)(?:[:\-\u2013\u2014]\s*)?(?:select|choose)\s+(\d+)\s+of\s+(\d+)/i)
  if (!match || !/(elective|requirement|track|option)/i.test(match[1])) return null
  return {
    label: match[1].replace(/[:\-\u2013\u2014\s]+$/g, '').trim() || 'Program elective',
    chooseCount: Number(match[2]),
    optionCount: Number(match[3]),
  }
}

const numericCredit = (cells) => {
  const credit = cells.find((cell, index) => index >= 3 && /^\d+(?:\.\d+)?$/.test(cell))
  return credit ? Number(credit) : 0
}

export function extractPlanRequirements(html, planId = 'plan') {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const requirements = []
  let semester = 'Program requirement'
  let semesterIndex = 0
  let activeGroup = null
  const occurrence = new Map()

  const nextId = (kind, label) => {
    const stem = `${semesterIndex}-${kind}-${slugify(label) || 'requirement'}`
    const count = occurrence.get(stem) ?? 0
    occurrence.set(stem, count + 1)
    return `${planId}-${stem}-${count + 1}`
  }

  for (const [, row] of rows) {
    const cells = [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((match) => cleanText(match[1]))
    const text = cleanText(row)
    const semesterMatch = text.match(/^(?:semester)\s+(\d+)/i)
    if (semesterMatch) {
      semesterIndex = Number(semesterMatch[1])
      semester = `SEMESTER ${semesterIndex}`
      activeGroup = null
      continue
    }
    if (/^(?:semester|year|program).{0,30}total/i.test(text) || /^course\s+number/i.test(text)) {
      activeGroup = null
      continue
    }

    const selection = electiveSelection(text)
    if (selection) {
      const group = {
        kind: 'elective-group',
        id: nextId('elective', selection.label),
        semester,
        semesterIndex,
        label: selection.label,
        chooseCount: selection.chooseCount,
        options: [],
        expectedOptionCount: selection.optionCount,
      }
      requirements.push(group)
      activeGroup = group
      continue
    }

    const course = courseFromCells(cells, semester)
    if (course) {
      if (activeGroup && activeGroup.options.length < activeGroup.expectedOptionCount) {
        activeGroup.options.push(course)
        if (activeGroup.options.length >= activeGroup.expectedOptionCount) activeGroup = null
      } else {
        requirements.push({
          kind: 'course',
          id: nextId('course', course.code),
          semester,
          semesterIndex,
          course,
        })
      }
      continue
    }

    if (/(elective|requirement)/i.test(text) && !/(total|study plan)/i.test(text)) {
      const credits = numericCredit(cells)
      if (credits > 0) {
        const label = cells.find((cell) => /(elective|requirement)/i.test(cell)) || text
        requirements.push({
          kind: 'open-elective',
          id: nextId('open-elective', label),
          semester,
          semesterIndex,
          label,
          chooseCount: 1,
          credits,
        })
      }
      activeGroup = null
    }
  }

  return requirements.map((requirement) => {
    if (requirement.kind !== 'elective-group') return requirement
    return Object.fromEntries(Object.entries(requirement).filter(([key]) => key !== 'expectedOptionCount'))
  })
}

export function flattenCourses(requirements) {
  const courses = requirements.flatMap((requirement) => {
    if (requirement.kind === 'course') return [requirement.course]
    if (requirement.kind === 'elective-group') return requirement.options
    return []
  })
  const unique = new Map()
  courses.forEach((course) => {
    const key = `${course.code}|${course.title}|${course.prerequisite}|${course.corequisite}`
    if (!unique.has(key)) unique.set(key, course)
  })
  return [...unique.values()]
}

export function extractRequiredCredits(html) {
  const text = cleanText(html)
  const match = text.match(/(?:B\.?\s*Sc\.?[^.]{0,24}\s+)?Program Total:?\s+(\d+(?:\.\d+)?)/i)
  return match ? Number(match[1]) : null
}
