'use client'
import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    // Show "taking longer than usual" message after 3s
    const t = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-violet-50 gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
        {slow && (
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">Connecting to Supabase…</p>
            <p className="text-xs text-gray-400">
              If this takes too long, check that your dev server is running in the terminal.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-violet-600 underline mt-1"
            >
              Click to reload
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
