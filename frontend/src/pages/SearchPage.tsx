import { useState, useRef } from 'react'
import PostCard from '../components/PostCard'
import PostDetailDrawer from '../components/PostDetailDrawer'
import TrendingTopics from '../components/TrendingTopics'
import { PostCardSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { startSearchScrape, getScrapeStatus, searchPosts, exportPosts, createSavedSearch } from '../api/client'
import type { Post, ScrapeJob } from '../types'

export default function SearchPage() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [maxPosts, setMaxPosts] = useState(20)
  const [contentType, setContentType] = useState('posts')
  const [timeRange, setTimeRange] = useState('any')
  const [location, setLocation] = useState('any')
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('relevance')
  const [job, setJob] = useState<ScrapeJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showExport, setShowExport] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const lastQueryRef = useRef('')

  const perPage = 20

  const runSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    setQuery(searchQuery)
    setPosts([])
    setTotal(0)
    setPage(1)
    setLoading(true)
    lastQueryRef.current = searchQuery.trim()

    startSearchScrape(searchQuery.trim(), maxPosts, contentType, timeRange, location)
      .then((newJob) => {
        setJob(newJob)
        pollJob(newJob.job_id)
      })
      .catch((err) => {
        toast.error(err.message)
        setLoading(false)
      })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(query)
  }

  const pollJob = (jobId: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(async () => {
      try {
        const status = await getScrapeStatus(jobId)
        setJob(status)

        if (status.status !== 'running') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          if (status.status === 'completed') {
            loadPosts(lastQueryRef.current, sort, 1)
            toast.success(`Found ${status.posts_found} posts`)
          } else if (status.status === 'failed') {
            toast.error(status.error || 'Search failed')
            setLoading(false)
          }
        }
      } catch {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setLoading(false)
      }
    }, 2000)
  }

  const loadPosts = async (q: string, s: string, p: number) => {
    try {
      const res = await searchPosts({ q, sort: s, page: p, per_page: perPage })
      setPosts(res.posts)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadPosts(lastQueryRef.current, sort, newPage)
  }

  const handleSortChange = (newSort: string) => {
    setSort(newSort)
    setPage(1)
    if (posts.length > 0) {
      loadPosts(lastQueryRef.current, newSort, 1)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await exportPosts(format, lastQueryRef.current || undefined)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
    setShowExport(false)
  }

  const isSearching = job?.status === 'running'
  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search LinkedIn for posts about..."
            disabled={isSearching}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            {isSearching ? 'Searching...' : 'Search LinkedIn'}
          </button>
          {query.trim() && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await createSavedSearch({
                    name: query.trim(),
                    query: query.trim(),
                    content_type: contentType,
                    time_range: timeRange,
                    location,
                    max_posts: maxPosts,
                    schedule_hours: 24,
                  })
                  toast.success('Search saved to Monitor')
                } catch {
                  toast.error('Failed to save search')
                }
              }}
              className="text-sm px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            >
              Save Search
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Type:</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              disabled={isSearching}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="posts">Posts</option>
              <option value="articles">Articles</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              disabled={isSearching}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="any">Any time</option>
              <option value="day">Past 24 hours</option>
              <option value="week">Past week</option>
              <option value="month">Past month</option>
              <option value="year">Past year</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Location:</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isSearching}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              <option value="any">Anywhere</option>
              <optgroup label="United States">
                <option value="us">All US</option>
                <option value="alabama">Alabama</option>
                <option value="alaska">Alaska</option>
                <option value="arizona">Arizona</option>
                <option value="arkansas">Arkansas</option>
                <option value="california">California</option>
                <option value="colorado">Colorado</option>
                <option value="connecticut">Connecticut</option>
                <option value="delaware">Delaware</option>
                <option value="florida">Florida</option>
                <option value="georgia-us">Georgia</option>
                <option value="hawaii">Hawaii</option>
                <option value="idaho">Idaho</option>
                <option value="illinois">Illinois</option>
                <option value="indiana">Indiana</option>
                <option value="iowa">Iowa</option>
                <option value="kansas">Kansas</option>
                <option value="kentucky">Kentucky</option>
                <option value="louisiana">Louisiana</option>
                <option value="maine">Maine</option>
                <option value="maryland">Maryland</option>
                <option value="massachusetts">Massachusetts</option>
                <option value="michigan">Michigan</option>
                <option value="minnesota">Minnesota</option>
                <option value="mississippi">Mississippi</option>
                <option value="missouri">Missouri</option>
                <option value="montana">Montana</option>
                <option value="nebraska">Nebraska</option>
                <option value="nevada">Nevada</option>
                <option value="new-hampshire">New Hampshire</option>
                <option value="new-jersey">New Jersey</option>
                <option value="new-mexico">New Mexico</option>
                <option value="new-york">New York</option>
                <option value="north-carolina">North Carolina</option>
                <option value="north-dakota">North Dakota</option>
                <option value="ohio">Ohio</option>
                <option value="oklahoma">Oklahoma</option>
                <option value="oregon">Oregon</option>
                <option value="pennsylvania">Pennsylvania</option>
                <option value="rhode-island">Rhode Island</option>
                <option value="south-carolina">South Carolina</option>
                <option value="south-dakota">South Dakota</option>
                <option value="tennessee">Tennessee</option>
                <option value="texas">Texas</option>
                <option value="utah">Utah</option>
                <option value="vermont">Vermont</option>
                <option value="virginia">Virginia</option>
                <option value="washington">Washington</option>
                <option value="west-virginia">West Virginia</option>
                <option value="wisconsin">Wisconsin</option>
                <option value="wyoming">Wyoming</option>
              </optgroup>
              <optgroup label="Countries">
                <option value="uk">United Kingdom</option>
                <option value="canada">Canada</option>
                <option value="australia">Australia</option>
                <option value="india">India</option>
                <option value="germany">Germany</option>
                <option value="france">France</option>
                <option value="brazil">Brazil</option>
                <option value="mexico">Mexico</option>
                <option value="spain">Spain</option>
                <option value="italy">Italy</option>
                <option value="netherlands">Netherlands</option>
                <option value="japan">Japan</option>
                <option value="south-korea">South Korea</option>
                <option value="singapore">Singapore</option>
                <option value="ireland">Ireland</option>
                <option value="sweden">Sweden</option>
                <option value="switzerland">Switzerland</option>
                <option value="israel">Israel</option>
                <option value="uae">UAE</option>
                <option value="south-africa">South Africa</option>
                <option value="nigeria">Nigeria</option>
                <option value="philippines">Philippines</option>
                <option value="indonesia">Indonesia</option>
                <option value="poland">Poland</option>
              </optgroup>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">
              Max: {maxPosts}
            </label>
            <input
              type="range"
              min={5}
              max={100}
              value={maxPosts}
              onChange={(e) => setMaxPosts(Number(e.target.value))}
              className="w-32"
              disabled={isSearching}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Sort:</label>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="relevance">Most Relevant</option>
              <option value="date">Newest</option>
              <option value="reactions">Most Reactions</option>
              <option value="comments">Most Comments</option>
            </select>
          </div>
        </div>
      </form>

      {isSearching && (
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 text-center">
          <div className="inline-block w-3 h-3 bg-yellow-400 rounded-full animate-pulse mr-2" />
          <span className="text-yellow-400 font-medium">
            Searching LinkedIn for "{lastQueryRef.current}"...
          </span>
          <p className="text-gray-400 text-sm mt-2">
            {job?.posts_found || 0} posts found so far
          </p>
        </div>
      )}

      {job?.status === 'failed' && (
        <div className="bg-gray-800 rounded-lg p-5 border border-red-700 text-center">
          <p className="text-red-400 font-medium">Search failed</p>
          <p className="text-red-400 text-sm mt-1">{job.error}</p>
        </div>
      )}

      {loading && !isSearching && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      )}

      {!isSearching && !loading && posts.length === 0 && !job ? (
        <TrendingTopics onSearch={runSearch} />
      ) : null}

      {!isSearching && !loading && job?.status === 'completed' && posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No posts found</p>
          <p className="text-gray-500 text-sm mt-1">Try a different search term</p>
        </div>
      ) : null}

      {posts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{total} post{total !== 1 ? 's' : ''} found</p>
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
              >
                Export
              </button>
              {showExport && (
                <div className="absolute right-0 top-8 bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[100px]">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                  >
                    JSON
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                onClick={() => setSelectedPost(post)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button
                onClick={() => handlePageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="text-sm text-blue-400 hover:underline disabled:text-gray-600 disabled:no-underline"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="text-sm text-blue-400 hover:underline disabled:text-gray-600 disabled:no-underline"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <PostDetailDrawer
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onBookmarkChange={() => loadPosts(lastQueryRef.current, sort, page)}
      />
    </div>
  )
}
