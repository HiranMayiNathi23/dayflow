'use client'
import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Dayflow Error]', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '24px', background: '#f5f3ff',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '40px',
            maxWidth: '420px', width: '100%', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1f2937', fontWeight: 700 }}>
              App crashed
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
              Something went wrong. The error message is shown below.
            </p>
            <pre style={{
              margin: '0 0 24px', fontSize: '12px', color: '#dc2626',
              background: '#fef2f2', padding: '12px', borderRadius: '10px',
              textAlign: 'left', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              maxHeight: '120px', overflowY: 'auto'
            }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#7c3aed', color: 'white', border: 'none',
                borderRadius: '12px', padding: '12px 32px', fontSize: '15px',
                fontWeight: 600, cursor: 'pointer', width: '100%'
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
