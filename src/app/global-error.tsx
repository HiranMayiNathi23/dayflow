'use client'
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f3ff' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1f2937' }}>Something went wrong</h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280' }}>
              The app crashed. Click below to reload.
            </p>
            <button
              onClick={reset}
              style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              Reload app
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
