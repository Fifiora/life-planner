/** Text of a chosen file (works in browsers that lack Blob.text, too). */
export function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** Save text as a file on this phone (a normal browser download). */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const a = document.createElement('a')
  a.download = name
  if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(new Blob([text], { type }))
    a.href = url
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } else {
    // Very old browsers: the text itself is the link.
    a.href = `data:${type};charset=utf-8,${encodeURIComponent(text)}`
    a.click()
  }
}
