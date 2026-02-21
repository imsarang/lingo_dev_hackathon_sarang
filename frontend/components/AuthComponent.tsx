"use client"
import { signIn, signOut, useSession } from "next-auth/react"
import { useState, useRef, useEffect } from "react"

export const AuthComponent = () => {
  const { data: session, status } = useSession()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDropdown])

  if (status === "loading") {
    return (
      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
    )
  }

  if (session?.user) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-zinc-300 dark:border-zinc-600 hover:border-blue-500 transition-colors"
        >
          <img
            src={session.user.image || "/default-avatar.png"}
            alt={session.user.name || "User"}
            className="w-full h-full object-cover"
          />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-2 z-50">
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {session.user.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {session.user.email}
              </p>
            </div>
            <button
              onClick={() => {
                signOut({ callbackUrl: window.location.href })
                setShowDropdown(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
    </div>
    )
  }

  return (
    <button
      onClick={() => {
        const currentUrl = window.location.origin + window.location.pathname
        signIn("google", { callbackUrl: currentUrl })
      }}
      className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
    >
      Login
    </button>
  )
}
