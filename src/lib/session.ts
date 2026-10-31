/** Reload the page (a separate function so tests can replace it). */
export const reloadApp = () => window.location.reload()

/** Forget who is using this phone and lock it. All saved data stays. */
export function logOut(local: Storage = localStorage, session: Storage = sessionStorage): void {
  local.removeItem('lp.me')
  session.removeItem('lp.unlocked')
}

/** Remove everything the planner saved on this phone (and nothing else). */
export function eraseThisPhone(local: Storage = localStorage, session: Storage = sessionStorage): void {
  for (const store of [local, session]) {
    for (const key of Object.keys(store)) if (key.startsWith('lp.')) store.removeItem(key)
  }
}
