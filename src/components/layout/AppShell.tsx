'use client'
import { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      <BottomNav />
      {/* Offset for desktop sidebar, flex-col so children can stretch */}
      <main className="sm:pl-60 flex-1 flex flex-col min-h-[100dvh]">
        {children}
      </main>
    </div>
  )
}
