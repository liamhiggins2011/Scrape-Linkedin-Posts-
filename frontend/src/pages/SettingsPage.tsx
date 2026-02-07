import { useState, useEffect } from 'react'
import CookieUpload from '../components/CookieUpload'
import { getAuthStatus, saveCredentials } from '../api/client'

export default function SettingsPage() {
  const [configured, setConfigured] = useState(false)
  const [method, setMethod] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showCookies, setShowCookies] = useState(false)

  const checkStatus = () => {
    getAuthStatus()
      .then((s) => {
        setConfigured(s.configured)
        setMethod(s.method)
      })
      .catch(() => {})
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await saveCredentials(email.trim(), password)
      setMessage('Credentials saved successfully!')
      setPassword('')
      checkStatus()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-300">Login Status:</span>
        {configured ? (
          <span className="text-green-400 text-sm font-medium">
            Configured via {method}
          </span>
        ) : (
          <span className="text-red-400 text-sm font-medium">Not configured</span>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-2">LinkedIn Login</h2>
        <p className="text-sm text-gray-400 mb-4">
          Enter your LinkedIn email and password. These are stored locally on this machine
          and used to log into LinkedIn when scraping.
        </p>

        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your LinkedIn password"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !email.trim() || !password.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors w-full"
          >
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>
        </form>

        {message && (
          <p className={`text-sm mt-3 ${message.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowCookies(!showCookies)}
          className="text-sm text-gray-400 hover:text-gray-300 underline"
        >
          {showCookies ? 'Hide cookie upload' : 'Or use cookie file instead'}
        </button>

        {showCookies && (
          <div className="mt-4">
            <CookieUpload
              isUploaded={method === 'cookies'}
              onUploaded={checkStatus}
            />
          </div>
        )}
      </div>
    </div>
  )
}
