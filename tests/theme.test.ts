import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, getThemeChoice, setThemeChoice } from '../src/lib/theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('applyTheme', () => {
  it('follows the phone when set to system', () => {
    const root = document.createElement('html')
    expect(applyTheme('system', true, root)).toBe('dark')
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(applyTheme('system', false, root)).toBe('light')
    expect(root.getAttribute('data-theme')).toBe('light')
  })
  it('lets a manual choice win over the phone', () => {
    const root = document.createElement('html')
    expect(applyTheme('dark', false, root)).toBe('dark')
    expect(applyTheme('light', true, root)).toBe('light')
  })
})

describe('theme choice', () => {
  it('defaults to system, also for garbage', () => {
    expect(getThemeChoice()).toBe('system')
    localStorage.setItem('lp.theme', 'neon')
    expect(getThemeChoice()).toBe('system')
  })
  it('stores and applies a choice', () => {
    setThemeChoice('dark')
    expect(localStorage.getItem('lp.theme')).toBe('dark')
    expect(getThemeChoice()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    setThemeChoice('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
