/** Copy text; true if it worked. Tries the clipboard, then selecting a hidden box. Never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* blocked: try the fallback below */
  }
  try {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
    box.remove()
    return ok
  } catch {
    return false
  }
}
