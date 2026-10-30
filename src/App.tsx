import { Navigate, Route, Routes } from 'react-router-dom'
import AuthGate from './data/AuthGate'
import Finance from './screens/Finance'
import Food from './screens/Food'
import Health from './screens/Health'
import Settings from './screens/Settings'
import Study from './screens/Study'
import Today from './screens/Today'
import Travel from './screens/Travel'
import { TabBar } from './ui/TabBar'
import { ToastProvider } from './ui/Toast'

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>
        <main className="app">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/health" element={<Health />} />
            <Route path="/study" element={<Study />} />
            <Route path="/travel" element={<Travel />} />
            <Route path="/food" element={<Food />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <TabBar />
      </AuthGate>
    </ToastProvider>
  )
}
