import { useEffect, useState } from 'react'
import { getTrendingTopics } from '../api/client'
import type { TopicFrequency } from '../types'

const QUICK_TOPICS = [
  'AI & Machine Learning',
  'Remote Work',
  'Leadership',
  'Marketing',
  'Tech Layoffs',
  'Startup Funding',
  'Personal Branding',
  'Career Growth',
  'SaaS',
  'Product Management',
]

interface Props {
  onSearch: (query: string) => void
}

export default function TrendingTopics({ onSearch }: Props) {
  const [dbTopics, setDbTopics] = useState<TopicFrequency[]>([])

  useEffect(() => {
    getTrendingTopics(10).then(setDbTopics).catch(() => {})
  }, [])

  return (
    <div className="text-center py-12">
      <p className="text-gray-400 text-lg mb-2">Search LinkedIn posts by topic</p>
      <p className="text-gray-500 text-sm mb-6">
        Enter a keyword above or click a topic below to get started
      </p>

      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Quick search</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => onSearch(topic)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm text-gray-300 transition-colors"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {dbTopics.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Trending in your data</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {dbTopics.map((t) => (
              <button
                key={t.topic}
                onClick={() => onSearch(t.topic)}
                className="px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/50 rounded-full text-sm text-blue-300 transition-colors"
              >
                {t.topic}
                <span className="ml-1 text-blue-500 text-xs">({t.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
