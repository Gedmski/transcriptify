import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = 'https://www.udst.edu.qa'
const OUTPUT = path.resolve(process.cwd(), 'data', 'udst-programs.json')

const decodeHtml = (value) => value
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#039;|&apos;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '\u2013')
  .replace(/&mdash;|&#8212;/gi, '\u2014')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const cleanText = (value = '') => decodeHtml(value
  .replace(/<br\s*\/?>/gi, ' / ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim())

const slugify = (value) => value
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Transcriptify program-plan sync/2.1' },
  })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.text()
}

function extractDirectoryPrograms(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const programs = []
  for (const [, row] of rows) {
    const link = row.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!link) continue
    const name = cleanText(link[2])
    if (!/(Bachelor|Master|Diploma|Certificate|Foundation)/i.test(name)) continue
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanText(match[1]))
    programs.push({
      id: slugify(name),
      name,
      duration: cells.at(-1) || 'See official program page',
      sourceUrl: new URL(link[1], BASE_URL).toString(),
    })
  }
  return programs
}

function inferCredential(name) {
  if (/Master/i.test(name)) return 'graduate'
  if (/Bachelor/i.test(name)) return 'bachelor'
  if (/Advanced Diploma/i.test(name)) return 'advanced-diploma'
  if (/Post-Graduate Diploma/i.test(name)) return 'postgraduate-diploma'
  if (/Diploma/i.test(name)) return 'diploma'
  if (/Certificate/i.test(name)) return 'certificate'
  return 'foundation'
}

function inferCollege(html, sourceUrl) {
  const breadcrumb = cleanText(html.match(/<nav[^>]+breadcrumb[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || '')
  const keywords = cleanText(html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i)?.[1] || '')
  const combined = `${keywords} ${breadcrumb} ${sourceUrl}`.toLowerCase()
  if (combined.includes('business')) return 'College of Business'
  if (combined.includes('college of computing') || combined.includes('information-technology')) return 'College of Computing and Information Technology'
  if (combined.includes('engineering')) return 'College of Engineering and Technology'
  if (combined.includes('health')) return 'College of Health Sciences'
  if (combined.includes('general-education')) return 'College of General Education'
  return 'UDST'
}

function extractPlanVersion(html) {
  const matches = [...cleanText(html).matchAll(/(20\d{2})\s*[-\u2013\u2014]\s*(20\d{2})\s+Study Plan/gi)]
  if (!matches.length) return 'Current published plan'
  const latest = matches.sort((a, b) => Number(b[2]) - Number(a[2]))[0]
  return `${latest[1]}-${latest[2]}`
}

function extractHistoricalPlanLinks(html) {
  const section = html.match(/field--name-field-previous-study-plan[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] || ''
  const matches = [...section.matchAll(/(20\d{2})\s*[-\u2013\u2014]\s*(20\d{2})\s+Study Plan[\s\S]{0,240}?<a[^>]+href="([^"]+)"/gi)]
  const links = matches.map((match) => ({
    version: `${match[1]}-${match[2]}`,
    sourceUrl: new URL(match[3], BASE_URL).toString(),
  }))
  return [...new Map(links.map((link) => [link.version, link])).values()]
}

function extractCourses(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const courses = []
  let semester = 'Program requirement'
  for (const [, row] of rows) {
    const cells = [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
    if (cells.length === 1 && /semester\s+\d+|work term|clinical/i.test(cells[0])) {
      semester = cells[0]
      continue
    }
    if (cells.length < 5) continue
    const code = cells[0].replace(/\s+/g, '').toUpperCase()
    if (!/^[A-Z]{2,8}\d{3,4}[A-Z]?$/.test(code)) continue
    const creditIndex = cells.findIndex((cell, index) => index >= 4 && /^\d+(?:\.\d+)?$/.test(cell))
    const credits = creditIndex >= 0 ? Number(cells[creditIndex]) : 0
    courses.push({
      code,
      title: cells[1],
      prerequisite: cells[2] && cells[2] !== '-' ? cells[2] : null,
      corequisite: cells[3] && cells[3] !== '-' ? cells[3] : null,
      credits,
      semester,
    })
  }
  const unique = new Map()
  for (const course of courses) {
    const key = `${course.code}|${course.title}|${course.prerequisite}|${course.corequisite}`
    if (!unique.has(key)) unique.set(key, course)
  }
  return [...unique.values()]
}

function extractRequiredCredits(html) {
  const text = cleanText(html)
  const match = text.match(/(?:B\.?\s*Sc\.?[^.]{0,24}\s+)?Program Total:?\s+(\d+(?:\.\d+)?)/i)
  return match ? Number(match[1]) : null
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function buildPlan(program, version, sourceUrl, html) {
  const planHtml = html || await fetchHtml(sourceUrl)
  const courses = extractCourses(planHtml)
  const listedCredits = courses.reduce((sum, course) => sum + course.credits, 0)
  const requiredCredits = extractRequiredCredits(planHtml)
  return {
    id: `${program.id}-${version}`,
    version,
    sourceUrl,
    requiredCredits,
    totalListedCredits: listedCredits,
    courses,
  }
}

async function main() {
  const directoryPages = await Promise.all(
    Array.from({ length: 5 }, (_, page) => fetchHtml(`${BASE_URL}/admissions/all-programs${page ? `?page=${page}` : ''}`)),
  )
  const directoryPrograms = directoryPages.flatMap(extractDirectoryPrograms)
  const programs = [...new Map(directoryPrograms.map((program) => [program.sourceUrl, program])).values()]

  const enriched = await mapWithConcurrency(programs, 5, async (program, index) => {
    try {
      const html = await fetchHtml(program.sourceUrl)
      const currentVersion = extractPlanVersion(html)
      const currentPlan = await buildPlan(program, currentVersion, program.sourceUrl, html)
      const historicalPlans = (await mapWithConcurrency(extractHistoricalPlanLinks(html), 3, async (link) => {
        try {
          return await buildPlan(program, link.version, link.sourceUrl)
        } catch (error) {
          process.stderr.write(`\n${program.name} ${link.version}: ${error.message}\n`)
          return null
        }
      })).filter(Boolean)
      const plans = [...new Map([...historicalPlans, currentPlan].map((plan) => [plan.version, plan])).values()]
        .sort((a, b) => Number(a.version.slice(0, 4)) - Number(b.version.slice(0, 4)))
      process.stdout.write(`\rSynced ${index + 1}/${programs.length}`)
      return {
        ...program,
        credential: inferCredential(program.name),
        college: inferCollege(html, program.sourceUrl),
        planVersion: currentVersion,
        totalListedCredits: currentPlan.totalListedCredits,
        courses: currentPlan.courses,
        plans,
      }
    } catch (error) {
      process.stderr.write(`\n${program.name}: ${error.message}\n`)
      return {
        ...program,
        credential: inferCredential(program.name),
        college: 'UDST',
        planVersion: 'Current published plan',
        totalListedCredits: 0,
        courses: [],
        plans: [],
      }
    }
  })

  const output = {
    schemaVersion: 2,
    institution: 'University of Doha for Science and Technology',
    updatedAt: new Date().toISOString(),
    directorySource: `${BASE_URL}/admissions/all-programs`,
    policyVersion: 'UDST public policies accessed 2026-07-16',
    programs: enriched.sort((a, b) => a.name.localeCompare(b.name)),
  }
  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  process.stdout.write(`\nWrote ${enriched.length} programs to ${OUTPUT}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
