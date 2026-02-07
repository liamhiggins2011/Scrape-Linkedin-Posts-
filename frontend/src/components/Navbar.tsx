import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAuthStatus } from '../api/client'

export default function Navbar() {
  const [authConfigured, setAuthConfigured] = useState(true)

  useEffect(() => {
    getAuthStatus().then((s) => setAuthConfigured(s.configured)).catch(() => {})
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
    }`

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-white">LinkedIn Intelligence</span>
        <div className="flex gap-1 flex-wrap">
          <NavLink to="/" className={linkClass}>Search</NavLink>
          <NavLink to="/analytics" className={linkClass}>Analytics</NavLink>
          <NavLink to="/collections" className={linkClass}>Collections</NavLink>
          <NavLink to="/monitor" className={linkClass}>Monitor</NavLink>
          <NavLink to="/scrape" className={linkClass}>Scrape</NavLink>
          <NavLink to="/settings" className={linkClass}>
            <span className="relative">
              Settings
              {!authConfigured && (
                <span className="absolute -top-1 -right-3 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </span>
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
