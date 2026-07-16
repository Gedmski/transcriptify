'use client'

import { useState } from 'react'
import { buildAcademicYearOptions, normalizeAcademicTerm } from '@/domain/planning'

const TERM_NAMES = ['Fall', 'Winter', 'Spring', 'Summer']

function termParts(value: string) {
  const normalized = normalizeAcademicTerm(value)
  if (!normalized) return { name: '', year: '' }
  const [name, year] = normalized.split(' ')
  return { name, year }
}

export function TermPicker({ value, onChange, knownTerms, ariaLabel, allowEmpty = true }: {
  value: string
  onChange: (value: string) => void
  knownTerms: Array<string | undefined>
  ariaLabel: string
  allowEmpty?: boolean
}) {
  const initial = termParts(value)
  const years = buildAcademicYearOptions([...knownTerms, value])
  const [termName, setTermName] = useState(initial.name)
  const [year, setYear] = useState(initial.year)
  const [lastValue, setLastValue] = useState(value)

  if (value !== lastValue) {
    const next = termParts(value)
    setLastValue(value)
    setTermName(next.name)
    setYear(next.year)
  }

  const changeTermName = (nextName: string) => {
    setTermName(nextName)
    if (!nextName) {
      setYear('')
      if (allowEmpty) onChange('')
      return
    }
    if (year) onChange(`${nextName} ${year}`)
  }

  const changeYear = (nextYear: string) => {
    setYear(nextYear)
    if (!nextYear) {
      if (allowEmpty) onChange('')
      return
    }
    if (termName) onChange(`${termName} ${nextYear}`)
  }

  return <div className="term-picker" role="group" aria-label={ariaLabel}>
    <select aria-label={`${ariaLabel} name`} value={termName} required={!allowEmpty} onChange={(event) => changeTermName(event.target.value)}>
      {allowEmpty && <option value="">No term</option>}
      {TERM_NAMES.map((name) => <option value={name} key={name}>{name}</option>)}
    </select>
    <select aria-label={`${ariaLabel} year`} value={year} required={!allowEmpty} disabled={!termName} onChange={(event) => changeYear(event.target.value)}>
      {allowEmpty && <option value="">Year</option>}
      {years.map((optionYear) => <option value={optionYear} key={optionYear}>{optionYear}</option>)}
    </select>
  </div>
}
