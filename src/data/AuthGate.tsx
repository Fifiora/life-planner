import { useState, type ReactNode } from 'react'
import { loadConfig } from '../lib/githubStore'
import Connect from '../screens/Connect'
import { HouseholdProvider } from './household'

/** Shows the Connect screen until this phone has a saved GitHub connection. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(() => loadConfig() !== null)
  if (!connected) return <Connect onConnected={() => setConnected(true)} />
  return <HouseholdProvider>{children}</HouseholdProvider>
}
