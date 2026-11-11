import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { HouseholdProvider, useHousehold } from './data/household'
import { removeSharedCopy, type BootResult } from './data/startup'
import Calendar from './screens/Calendar'
import Finance from './screens/Finance'
import Food from './screens/Food'
import Health from './screens/Health'
import Report from './screens/Report'
import Settings from './screens/Settings'
import Study from './screens/Study'
import Today from './screens/Today'
import Travel from './screens/Travel'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { PinGate } from './ui/PinGate'
import { TabBar } from './ui/TabBar'
import { UnlockPreload } from './ui/UnlockPreload'
import { ToastProvider } from './ui/Toast'

function ViewBanner({ createdAt }: { createdAt?: string }) {
  const when = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className="view-banner" role="note">
      <span>👁 View-only copy{when ? ` · shared ${when}` : ''}</span>
      <button type="button" className="plain-btn" onClick={removeSharedCopy}>
        Remove this copy
      </button>
    </div>
  )
}

function Shell({ boot }: { boot: BootResult }) {
  const { readOnly } = useHousehold()
  return (
    <>
      <main className="app">
        {readOnly && <ViewBanner createdAt={boot.createdAt} />}
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/health" element={<Health />} />
          <Route path="/study" element={<Study />} />
          <Route path="/travel" element={<Travel />} />
          <Route path="/food" element={<Food />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/report" element={<Report />} />
          {!readOnly && <Route path="/settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  )
}

export default function App({ boot }: { boot: BootResult }) {
  const [acknowledged, setAcknowledged] = useState(false)

  if (boot.error && !acknowledged) {
    return (
      <div className="app">
        <div className="card">
          <h2>Couldn't open that link</h2>
          <p className="error">{boot.error}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setAcknowledged(true)}>Continue</button>
          </div>
        </div>
      </div>
    )
  }

  if (boot.mode === 'locked' && boot.preload) return <UnlockPreload preload={boot.preload} />

  return (
    <ToastProvider>
      <div className={boot.mode === 'view' ? 'view-only' : undefined}>
        <ErrorBoundary>
          {boot.mode === 'own' ? (
            <PinGate>
              <HouseholdProvider>
                <Shell boot={boot} />
              </HouseholdProvider>
            </PinGate>
          ) : (
            <HouseholdProvider>
              <Shell boot={boot} />
            </HouseholdProvider>
          )}
        </ErrorBoundary>
      </div>
    </ToastProvider>
  )
}
