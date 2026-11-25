import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Confetti } from '../src/ui/Confetti'
import Settings from '../src/screens/Settings'
import { renderScreen, seedPlanner } from './seed'

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
  light: { selector: ':root', want: { '--bg': '#f7f4ee', '--card-solid': '#fdfbf7', '--ink': '#1f1b16', '--brand': '#000080' } },
  dark: { selector: 'html[data-theme="dark"]', want: { '--bg': '#161513', '--card-solid': '#1c1a18', '--ink': '#efe9de', '--brand': '#7cc4ff' } },
}
const PAIRS: [string, string][] = [['--ink', '--bg'], ['--ink', '--card-solid'], ['--muted', '--bg'], ['--muted', '--card-solid'], ['--brand-ink', '--brand'], ['--brand', '--bg'], ['--brand', '--card-solid']]

describe.each(Object.entries(PALETTES))('quiet palette (%s)', (_name, { selector, want }) => {
  it('declares the agreed colours', () => {
    const t = tokens(selector)
    for (const [k, v] of Object.entries(want)) expect(t[k], k).toBe(v)
  })
  it.each(PAIRS)('keeps %s readable on %s (WCAG AA, 4.5:1)', (fg, bg) => {
    const t = tokens(selector)
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the look', () => {
  it('has no Anime theme left in the stylesheet', () => {
    expect(css).not.toMatch(/data-style/)
  })
  it('has no glass, glow, orbs or gradient text', () => {
    expect(css).not.toMatch(/backdrop-filter|background-clip: text|\.orbs|\.card::after/)
  })
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
  it('sparkles', async () => {
    const { container } = render(<Confetti fire />)
    await waitFor(() => expect(container.querySelector('.confetti')).not.toBeNull())
    expect(container.querySelector('.confetti')).toHaveClass('spark')
  })
})

describe('There is one look', () => {
  beforeEach(() => seedPlanner())
  it('Settings has no Style choice but keeps Appearance', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByLabelText('Appearance')).toBeInTheDocument()
    expect(screen.queryByLabelText('Style')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Episodes' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Trophies' })).toBeNull()
  })
})

describe('colour themes', () => {
  const ACCENTS = ['teal', 'ocean', 'rose', 'plum', 'forest', 'sunset', 'slate']
  const PAIRS: [string, string][] = [['--brand-ink', '--brand'], ['--brand', '--bg'], ['--brand', '--card-solid']]
  const base = (dark: boolean) => tokens(dark ? 'html[data-theme="dark"]' : ':root')
  describe.each([false, true])('dark=%s', (dark) => {
    it.each(ACCENTS)('%s declares its colours and keeps them readable (AA 4.5:1)', (id) => {
      const t = tokens(dark ? `html[data-theme="dark"][data-accent="${id}"]` : `html[data-accent="${id}"]`)
      expect(t['--brand'], 'brand').toMatch(/^#[0-9a-f]{6}$/)
      expect(t['--brand-ink'], 'brand-ink').toMatch(/^#[0-9a-f]{6}$/)
      const all = { ...base(dark), ...t }
      for (const [fg, bg] of PAIRS) expect(contrast(all[fg], all[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    })
  })
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-accent')
  })
  it('Settings picks a colour, applies it and remembers it', async () => {
    seedPlanner()
    renderScreen(<Settings />)
    const rose = await screen.findByRole('button', { name: 'Rose' })
    expect(screen.getByRole('button', { name: 'Navy' })).toHaveAttribute('aria-pressed', 'true')
    rose.click()
    await waitFor(() => expect(document.documentElement.getAttribute('data-accent')).toBe('rose'))
    expect(localStorage.getItem('lp.accent')).toBe('rose')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rose' })).toHaveAttribute('aria-pressed', 'true'))
    screen.getByRole('button', { name: 'Navy' }).click()
    await waitFor(() => expect(document.documentElement.hasAttribute('data-accent')).toBe(false))
    expect(localStorage.getItem('lp.accent')).toBeNull()
  })
})

describe('background picture', () => {
  beforeEach(() => localStorage.clear())
  it('is off by default, floats flowers or swims fish on request, and can be switched off', async () => {
    const { Ambient } = await import('../src/ui/Ambient')
    const { setAmbient } = await import('../src/lib/ambient')
    const { act } = await import('@testing-library/react')
    const { container } = render(<Ambient />)
    expect(container.querySelector('.ambient')).toBeNull()
    act(() => setAmbient('flowers'))
    await waitFor(() => expect(container.querySelectorAll('.amb-flower').length).toBeGreaterThan(0))
    expect(container.querySelector('.ambient')).toHaveAttribute('aria-hidden', 'true')
    act(() => setAmbient('fish'))
    await waitFor(() => expect(container.querySelectorAll('.amb-fish').length).toBeGreaterThan(0))
    expect(container.querySelector('.amb-flower')).toBeNull()
    act(() => setAmbient('off'))
    await waitFor(() => expect(container.querySelector('.ambient')).toBeNull())
  })
  it('Settings offers the three choices', async () => {
    seedPlanner()
    renderScreen(<Settings />)
    const select = (await screen.findByLabelText('Background')) as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['flowers', 'fish', 'off'])
  })
  it('stands still and never takes a tap', () => {
    expect(css).toMatch(/\.ambient \{[^}]*pointer-events: none/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.amb-flower, \.amb-fish, \.amb-water \{ animation: none/)
  })
})

describe('an organised Today', () => {
  it('Today has a main column with the checklist and a side column with the rest', async () => {
    seedPlanner()
    const Today = (await import('../src/screens/Today')).default
    const { container } = renderScreen(<Today />)
    await screen.findByRole('heading', { name: 'Today' })
    const main = container.querySelector('.today-main')!
    const side = container.querySelector('.today-side')!
    expect(main.querySelector('.hero')).not.toBeNull()
    expect(main.textContent).toContain('Today')
    expect(side.querySelector('.hero')).toBeNull()
  })
})

describe('Finance is organised', () => {
  it('Overview opens with the plan card, ahead of the headline tiles', async () => {
    seedPlanner()
    const Finance = (await import('../src/screens/Finance')).default
    const { container } = renderScreen(<Finance />)
    await screen.findByText(/The plan for/)
    const plan = container.querySelector('.plan-card')
    const kpi = container.querySelector('.kpi-row')
    expect(plan).not.toBeNull()
    expect(plan!.compareDocumentPosition(kpi!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})


// The one solid accent block: its text has to stay readable on every colour theme, in light and dark.
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
describe('text on the accent block', () => {
  it('is readable on every accent theme, light and dark', () => {
    const found = [...css.matchAll(/html(\[data-theme="dark"\])?\[data-accent="(\w+)"\] \{([^}]*)\}/g)]
    expect(found.length).toBeGreaterThanOrEqual(14)
    for (const [, dark, name, body] of found) {
      const brand = body.match(/--brand:\s*(#[0-9a-f]{6})/i)![1]
      const ink = body.match(/--brand-ink:\s*(#[0-9a-f]{6})/i)![1]
      expect(contrast(ink, brand), `${name} ${dark ? 'dark' : 'light'}`).toBeGreaterThanOrEqual(4.5)
    }
    expect(rgb('#000080')).toEqual([0, 0, 128])
  })
})
