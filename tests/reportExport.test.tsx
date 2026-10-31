import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Report from '../src/screens/Report'
import { renderScreen, seedPlanner } from './seed'

let css = ''
beforeAll(async () => {
  const fs = await import(/* @vite-ignore */ ['node', 'fs'].join(':'))
  css = fs.readFileSync('src/index.css', 'utf8') as string
})

const page = () => renderScreen(<Report today="2026-11-03" />, '/report?month=2026-10')
beforeEach(() => seedPlanner())
afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  vi.restoreAllMocks()
})

describe('export buttons', () => {
  it('has the three buttons', async () => {
    page()
    for (const name of ['Print or save as PDF', 'Copy as text', 'Download as file']) expect(await screen.findByRole('button', { name })).toBeInTheDocument()
  })
  it('prints through the browser', async () => {
    window.print = vi.fn()
    page()
    await userEvent.click(await screen.findByRole('button', { name: 'Print or save as PDF' }))
    expect(window.print).toHaveBeenCalled()
  })
  it('copies the report as Markdown and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    page()
    await userEvent.click(await screen.findByRole('button', { name: 'Copy as text' }))
    expect(writeText.mock.calls[0][0].startsWith('# Life Planner report: October 2026')).toBe(true)
    expect(await screen.findByText('Copied.')).toBeInTheDocument()
  })
  it('says when copying did not work', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('x')) }, configurable: true })
    document.execCommand = vi.fn(() => false)
    page()
    await userEvent.click(await screen.findByRole('button', { name: 'Copy as text' }))
    expect(await screen.findByText('Could not copy. Select the text and copy it yourself.')).toBeInTheDocument()
    Reflect.deleteProperty(document, 'execCommand')
  })
  it('downloads a Markdown file named for the month', async () => {
    const create = vi.fn(() => 'blob:report')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    page()
    await userEvent.click(await screen.findByRole('button', { name: 'Download as file' }))
    expect(names).toEqual(['life-planner-report-2026-10.md'])
    expect(((create.mock.calls[0] as unknown[])[0] as Blob).type).toBe('text/markdown')
  })
})

describe('print styles', () => {
  it('hide the app chrome and keep sections whole on the page', () => {
    const at = css.indexOf('@media print')
    expect(at).toBeGreaterThan(-1)
    let depth = 0
    let i = css.indexOf('{', at)
    const from = i
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++
      if (css[i] === '}' && --depth === 0) break
    }
    const block = css.slice(from, i)
    expect(block).toContain('.tabbar')
    expect(block).toContain('.report-actions')
    expect(block).toContain('break-inside: avoid')
  })
})
