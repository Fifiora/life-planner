import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { startup } from './data/startup'
import { startTheme } from './lib/theme'
import './index.css'

async function main() {
  startTheme()
  // Ask the browser not to clear this site's saved data when space is tight (ignored if unsupported).
  void navigator.storage?.persist?.()
  const boot = await startup(window.location.hash)
  if (boot.fromLink) {
    // Move the shared data out of the address bar; it is remembered on this phone.
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/')
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App boot={boot} />
      </HashRouter>
    </React.StrictMode>,
  )
}

void main()
