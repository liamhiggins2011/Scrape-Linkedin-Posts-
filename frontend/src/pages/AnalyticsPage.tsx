import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import {
  getAnalyticsOverview, getTopAuthors, getTrendingTopics,
  getEngagementTimeline, getSentimentDistribution, getHashtagFrequency,
  enrichPosts,
} from '../api/client'
import type {
  AnalyticsOverview, AuthorStats, TopicFrequency,
  EngagementPoint, SentimentData, HashtagData,
} from '../types'
import { StatCardSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22C55E',
  neutral: '#EAB308',
  negative: '#EF4444',
}

export default function AnalyticsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [authors, setAuthors] = useState<AuthorStats[]>([])
  const [topics, setTopics] = useState<TopicFrequency[]>([])
  const [timeline, setTimeline] = useState<EngagementPoint[]>([])
  const [sentiment, setSentiment] = useState<SentimentData[]>([])
  const [hashtags, setHashtags] = useState<HashtagData[]>([])
  const [enriching, setEnriching] = useState(false)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      getAnalyticsOverview(),
      getTopAuthors(),
      getTrendingTopics(),
      getEngagementTimeline(),
      getSentimentDistribution(),
      getHashtagFrequency(),
    ])
      .then(([o, a, t, tl, s, h]) => {
        setOverview(o)
        setAuthors(a)
        setTopics(t)
        setTimeline(tl)
        setSentiment(s)
        setHashtags(h)
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      const result = await enrichPosts()
      toast.success(`Enriched ${result.enriched} posts`)
      loadAll()
    } catch {
      toast.error('Failed to enrich posts')
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-white transition-colors"
        >
          {enriching ? 'Enriching...' : 'Re-analyze Posts'}
        </button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Posts" value={overview.total_posts} />
          <StatCard label="Total Authors" value={overview.total_authors} />
          <StatCard label="Avg Engagement" value={overview.avg_engagement} suffix="/100" />
          <StatCard label="This Week" value={overview.posts_this_week} />
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Timeline */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Engagement Over Time</h3>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                <Area type="monotone" dataKey="avg_engagement" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Sentiment Distribution</h3>
          {sentiment.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentiment}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  label={({ label, count }) => `${label}: ${count}`}
                  labelLine={{ stroke: '#6B7280' }}
                >
                  {sentiment.map((s) => (
                    <Cell key={s.label} fill={SENTIMENT_COLORS[s.label] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-12">No data yet</p>
          )}
        </div>
      </div>

      {/* Top Hashtags */}
      {hashtags.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Top Hashtags</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, hashtags.slice(0, 15).length * 30)}>
            <BarChart data={hashtags.slice(0, 15)} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis dataKey="hashtag" type="category" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={75} />
              <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Authors */}
      {authors.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Top Authors</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-gray-700">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Author</th>
                  <th className="pb-2 pr-4">Posts</th>
                  <th className="pb-2">Avg Engagement</th>
                </tr>
              </thead>
              <tbody>
                {authors.map((a, i) => (
                  <tr key={a.author_name} className="border-b border-gray-700/50">
                    <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-4 text-white font-medium">{a.author_name}</td>
                    <td className="py-2 pr-4 text-gray-300">{a.post_count}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-700 rounded-full max-w-[120px]">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(a.avg_engagement, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs">{a.avg_engagement}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trending Topics */}
      {topics.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Trending Topics</h3>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const maxCount = topics[0]?.count || 1
              const size = 0.75 + (t.count / maxCount) * 0.5
              return (
                <span
                  key={t.topic}
                  className="px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-full text-gray-300 hover:bg-gray-700 transition-colors cursor-default"
                  style={{ fontSize: `${size}rem` }}
                >
                  {t.topic}
                  <span className="ml-1 text-gray-500 text-xs">({t.count})</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {!loading && overview?.total_posts === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No data yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Search or scrape some LinkedIn posts first to see analytics
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-sm text-gray-500 font-normal">{suffix}</span>}
      </p>
    </div>
  )
}
