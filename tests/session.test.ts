import { describe, it, expect, beforeEach } from 'vitest'
import { eraseThisPhone, logOut } from '../src/lib/session'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('logOut', () => {
  it('forgets who is using the phone and locks it, but keeps all the data', () => {
    localStorage.setItem('lp.me', 'a')
    localStorage.setItem('lp.data.bills', '[{"id":"1"}]')
    localStorage.setItem('lp.pin', '{"v":1}')
    sessionStorage.setItem('lp.unlocked', '1')
    logOut()
    expect(localStorage.getItem('lp.me')).toBeNull()
    expect(sessionStorage.getItem('lp.unlocked')).toBeNull()
    expect(localStorage.getItem('lp.data.bills')).toBe('[{"id":"1"}]')
    expect(localStorage.getItem('lp.pin')).toBe('{"v":1}')
  })
  it('notes that this phone is logged out, so the start screen can say so', () => {
    logOut()
    expect(localStorage.getItem('lp.loggedout')).toBe('1')
  })
})

describe('eraseThisPhone', () => {
  it('removes everything the planner saved, and nothing else', () => {
    localStorage.setItem('lp.me', 'a')
    localStorage.setItem('lp.data.bills', '[]')
    localStorage.setItem('lp.snapshot', 'g.x')
    localStorage.setItem('lp.pin', '{}')
    localStorage.setItem('lp.skipPreload', '1')
    localStorage.setItem('other.app', 'keep me')
    sessionStorage.setItem('lp.unlocked', '1')
    sessionStorage.setItem('other.session', 'keep me too')
    eraseThisPhone()
    expect(Object.keys(localStorage)).toEqual(['other.app'])
    expect(Object.keys(sessionStorage)).toEqual(['other.session'])
  })
})
