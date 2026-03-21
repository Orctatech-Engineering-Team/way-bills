import { describe, expect, test } from 'vitest'
import { buildCsv } from './export'

describe('buildCsv', () => {
  test('serializes headers and rows', () => {
    const csv = buildCsv(
      ['Waybill', 'Amount'],
      [
        ['WB-1', 3000],
        ['WB-2', 4500],
      ],
    )

    expect(csv).toBe('Waybill,Amount\nWB-1,3000\nWB-2,4500')
  })

  test('escapes commas, quotes, and empty values', () => {
    const csv = buildCsv(
      ['Name', 'Note', 'Optional'],
      [['Acme, Ltd', 'He said "ok"', null]],
    )

    expect(csv).toBe('Name,Note,Optional\n"Acme, Ltd","He said ""ok""",')
  })
})
