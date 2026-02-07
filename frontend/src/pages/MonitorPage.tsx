import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import {
  getSavedSearches, createSavedSearch, updateSavedSearch,
  deleteSavedSearch, runSavedSearch, getMonitorResults,
} from '../api/client'
import type { SavedSearch, MonitorResult } from '../types'

const SCHEDULE_OPTIONS = [
  { label: 'Every 6 hours', value: 6 },
  { label: 'Daily', value: 24 },
  { label: 'Every 3 days', value: 72 },
  { label: 'Weekly', value: 168 },
]

export default function MonitorPage() {
  const toast = useToast()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [results, setResults] = useState<MonitorResult[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  // Create form state
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [contentType, setContentType] = useState('posts')
  const [timeRange, setTimeRange] = useState('week')
  const [maxPosts, setMaxPosts] = useState(20)
  const [scheduleHours, setScheduleHours] = useState(24)

  const load = async () => {
    try {
      const [s, r] = await Promise.all([getSavedSearches(), getMonitorResults(20)])
      setSearches(s)
      setResults(r)
    } catch {
      toast.error('Failed to load monitor data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !query.trim()) return
    try {
      await createSavedSearch({
        name: name.trim(),
        query: query.trim(),
        content_type: contentType,
        time_range: timeRange,
        max_posts: maxPosts,
        schedule_hours: scheduleHours,
      })
      toast.success('Saved search created')
      setShowCreate(false)
      setName('')
      setQuery('')
      load()
    } catch {
      toast.error('Failed to create saved search')
    }
  }

  const handleToggle = async (search: SavedSearch) => {
    try {
      await updateSavedSearch(search.id, { enabled: !search.enabled })
      setSearches((prev) =>
        prev.map((s) => (s.id === search.id ? { ...s, enabled: !s.enabled } : s))
      )
    } catch {
      toast.error('Failed to update saved search')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSavedSearch(id)
      setSearches((prev) => prev.filter((s) => s.id !== id))
      toast.success('Saved search deleted')
    } catch {
      toast.error('Failed to delete saved search')
    }
  }

  const handleRun = async (id: number) => {
    try {
      await runSavedSearch(id)
      toast.success('Search running...')
      // Refresh results after a delay
      setTimeout(load, 5000)
    } catch {
      toast.error('Failed to run search')
    }
  }

  const handleScheduleChange = async (search: SavedSearch, hours: number) => {
    try {
      await updateSavedSearch(search.id, { schedule_hours: hours })
      setSearches((prev) =>
        prev.map((s) => (s.id === search.id ? { ...s, schedule_hours: hours } : s))
      )
    } catch {
      toast.error('Failed to update schedule')
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    return d.toLocaleString()
  }

  const searchNameById = (id: number) => {
    const s = searches.find((s) => s.id === id)
    return s?.name || `Search #${id}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitor</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? 'Cancel' : 'New Saved Search'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-800 border border-gray-700 rounded-lg p-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI weekly"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Search Query</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. artificial intelligence"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="posts">Posts</option>
                <option value="articles">Articles</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="any">Any time</option>
                <option value="day">Past 24 hours</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
                <option value="year">Past year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Posts</label>
              <input
                type="number"
                min={5}
                max={100}
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
                className="w-20 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Schedule</label>
              <select
                value={scheduleHours}
                onChange={(e) => setScheduleHours(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={!name.trim() || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create Saved Search
          </button>
        </form>
      )}

      {searches.length === 0 && !showCreate ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No saved searches yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Create one to automatically monitor LinkedIn for new posts
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((search) => (
            <div
              key={search.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white truncate">{search.name}</h3>
                  <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                    {search.query}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>Last run: {formatTime(search.last_run)}</span>
                  <span>{search.content_type}</span>
                  <span>{search.time_range}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={search.schedule_hours}
                  onChange={(e) => handleScheduleChange(search, Number(e.target.value))}
                  className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleToggle(search)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    search.enabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      search.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <button
                  onClick={() => handleRun(search.id)}
                  className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                >
                  Run Now
                </button>
                <button
                  onClick={() => handleDelete(search.id)}
                  className="text-xs px-2 py-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.id}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="text-white font-medium">{searchNameById(r.saved_search_id)}</span>
                  <span className="text-gray-400 ml-2">
                    found {r.new_posts_count} new post{r.new_posts_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatTime(r.run_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
