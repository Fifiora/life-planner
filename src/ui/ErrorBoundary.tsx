import { Component, type ReactNode } from 'react'
import { removeSharedCopy } from '../data/startup'

interface Props {
  children: ReactNode
  /** What "Remove the shared copy" does (default: forget it and reload). */
  onRemoveCopy?: () => void
}

/** Stops one bad piece of data from leaving a blank screen; always offers a way out. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const hasSharedCopy = localStorage.getItem('lp.snapshot') !== null
    return (
      <div className="app">
        <div className="card">
          <h2>Something went wrong</h2>
          <p className="muted">
            The planner hit data it couldn't show. {hasSharedCopy ? 'If this is a shared copy, removing it will let you start fresh.' : 'Try again, or reload the page.'}
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => this.setState({ failed: false })}>Try again</button>
            {hasSharedCopy && (
              <button type="button" className="btn btn-danger" onClick={this.props.onRemoveCopy ?? removeSharedCopy}>
                Remove the shared copy
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
