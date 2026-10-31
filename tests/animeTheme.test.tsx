import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import { Confetti } from '../src/ui/Confetti'

let css = ''
beforeAll(async () => {
  // A computed module name keeps the typechecker from needing Node's type definitions.
  const fs = await import(/* @vite-ignore */ ['node', 'fs'].join(':'))
  css = fs.readFileSync('src/index.css', 'utf8') as string
})

/** The custom properties declared inside the first rule whose selector is exactly `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return {}
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().toLowerCase()
  return out
}

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PALETTES = {
  light: { selector: 'html[data-style="anime"]', want: { '--bg': '#fff1e6', '--card-solid': '#ffffff', '--ink': '#2b1a3a', '--muted': '#6b5577', '--brand': '#d6336c', '--brand-ink': '#ffffff', '--brand-2': '#0b7fa8' } },
  dark: { selector: 'html[data-style="anime"][data-theme="dark"]', want: { '--bg': '#0d0b24', '--card-solid': '#1a1540', '--ink': '#f4f0ff', '--muted': '#b3a8d9', '--brand': '#ff6fa8', '--brand-ink': '#1a0b24', '--brand-2': '#3fe0ff' } },
}
const PAIRS: [string, string][] = [['--ink', '--bg'], ['--ink', '--card-solid'], ['--muted', '--bg'], ['--muted', '--card-solid'], ['--brand-ink', '--brand']]

describe.each(Object.entries(PALETTES))('anime palette (%s)', (_name, { selector, want }) => {
  it('declares the agreed colours', () => {
    const t = tokens(selector)
    for (const [k, v] of Object.entries(want)) expect(t[k], k).toBe(v)
  })
  it.each(PAIRS)('keeps %s readable on %s (WCAG AA, 4.5:1)', (fg, bg) => {
    const t = tokens(selector)
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('motion', () => {
  it('switches the sparkle off for people who asked for less motion', () => {
    const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{/g)].map((m) => {
      let depth = 0
      let i = m.index! + m[0].length - 1
      const from = i
      for (; i < css.length; i++) {
        if (css[i] === '{') depth++
        if (css[i] === '}' && --depth === 0) break
      }
      return css.slice(from, i)
    })
    expect(blocks.some((b) => b.includes('.confetti.spark span'))).toBe(true)
  })
})

describe('Confetti', () => {
  beforeEach(() => localStorage.clear())
  it('sparkles in the anime style', async () => {
    const { container } = render(<Confetti fire />)
    await waitFor(() => expect(container.querySelector('.confetti')).not.toBeNull())
    expect(container.querySelector('.confetti')).toHaveClass('spark')
  })
  it('is the plain confetti in Classic', async () => {
    localStorage.setItem('lp.style', 'classic')
    const { container } = render(<Confetti fire />)
    await waitFor(() => expect(container.querySelector('.confetti')).not.toBeNull())
    expect(container.querySelector('.confetti')).not.toHaveClass('spark')
  })
})
