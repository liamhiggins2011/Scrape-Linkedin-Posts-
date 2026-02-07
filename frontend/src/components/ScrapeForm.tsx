import { useState } from 'react'

interface Props {
  onSubmit: (profileUrl: string, maxPosts: number) => void
  disabled?: boolean
}

export default function ScrapeForm({ onSubmit, disabled }: Props) {
  const [url, setUrl] = useState('')
  const [maxPosts, setMaxPosts] = useState(20)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onSubmit(url.trim(), maxPosts)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-4">Start a New Scrape</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">LinkedIn Profile URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/username/"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Max Posts: {maxPosts}
          </label>
          <input
            type="range"
            min={5}
            max={100}
            value={maxPosts}
            onChange={(e) => setMaxPosts(Number(e.target.value))}
            className="w-full"
            disabled={disabled}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !url.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors w-full"
        >
          {disabled ? 'Scraping...' : 'Start Scrape'}
        </button>
      </div>
    </form>
  )
}
