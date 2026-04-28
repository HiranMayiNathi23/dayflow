'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-md w-full text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-lg font-serif font-semibold text-gray-800">Something went wrong</h2>
        <p className="text-sm text-gray-500 font-mono bg-gray-50 p-3 rounded-lg text-left break-all">
          {error.message}
        </p>
        <button
          onClick={reset}
          className="bg-violet-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
