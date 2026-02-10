import type {
  PostsResponse, ScrapeJob, AnalyticsOverview, AuthorStats,
  TopicFrequency, EngagementPoint, SentimentData, HashtagData,
  Collection, Bookmark, SavedSearch, MonitorResult,
} from '../types'

const BASE = '/api'

export async function searchPosts(params: {
  q?: string
  author?: string
  sort?: string
  page?: number
  per_page?: number
  job_id?: string
}): Promise<PostsResponse> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.author) sp.set('author', params.author)
  if (params.sort) sp.set('sort', params.sort)
  if (params.page) sp.set('page', String(params.page))
  if (params.per_page) sp.set('per_page', String(params.per_page))
  if (params.job_id) sp.set('job_id', params.job_id)
  const res = await fetch(`${BASE}/posts?${sp}`)
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}

export async function startSearchScrape(
  query: string,
  maxPosts: number,
  contentType: string = 'posts',
  timeRange: string = 'any',
  location: string = 'any',
): Promise<ScrapeJob> {
  const res = await fetch(`${BASE}/scrape/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_posts: maxPosts, content_type: contentType, time_range: timeRange, location }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to start search')
  }
  return res.json()
}

export async function startScrape(profileUrl: string, maxPosts: number): Promise<ScrapeJob> {
  const res = await fetch(`${BASE}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_url: profileUrl, max_posts: maxPosts }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to start scrape')
  }
  return res.json()
}

export async function getScrapeStatus(jobId: string): Promise<ScrapeJob> {
  const res = await fetch(`${BASE}/scrape/${jobId}`)
  if (!res.ok) throw new Error('Failed to get scrape status')
  return res.json()
}

export async function getScrapeHistory(): Promise<ScrapeJob[]> {
  const res = await fetch(`${BASE}/scrape/history`)
  if (!res.ok) throw new Error('Failed to get scrape history')
  return res.json()
}

export async function saveCredentials(email: string, password: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/auth/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to save credentials')
  }
  return res.json()
}

export async function uploadCookies(file: File): Promise<{ status: string; filename: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/auth/cookies/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to upload cookies')
  }
  return res.json()
}

export async function getAuthStatus(): Promise<{ configured: boolean; method: string | null }> {
  const res = await fetch(`${BASE}/auth/status`)
  if (!res.ok) throw new Error('Failed to check auth status')
  return res.json()
}

// Analytics
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const res = await fetch(`${BASE}/analytics/overview`)
  if (!res.ok) throw new Error('Failed to fetch analytics overview')
  return res.json()
}

export async function getTopAuthors(limit = 10): Promise<AuthorStats[]> {
  const res = await fetch(`${BASE}/analytics/top-authors?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch top authors')
  return res.json()
}

export async function getTrendingTopics(limit = 20): Promise<TopicFrequency[]> {
  const res = await fetch(`${BASE}/analytics/trending-topics?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch trending topics')
  return res.json()
}

export async function getEngagementTimeline(days = 30): Promise<EngagementPoint[]> {
  const res = await fetch(`${BASE}/analytics/engagement-timeline?days=${days}`)
  if (!res.ok) throw new Error('Failed to fetch engagement timeline')
  return res.json()
}

export async function getSentimentDistribution(): Promise<SentimentData[]> {
  const res = await fetch(`${BASE}/analytics/sentiment`)
  if (!res.ok) throw new Error('Failed to fetch sentiment data')
  return res.json()
}

export async function getHashtagFrequency(limit = 30): Promise<HashtagData[]> {
  const res = await fetch(`${BASE}/analytics/hashtags?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch hashtag data')
  return res.json()
}

export async function enrichPosts(): Promise<{ enriched: number }> {
  const res = await fetch(`${BASE}/analytics/enrich`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to enrich posts')
  return res.json()
}

// Collections
export async function getCollections(): Promise<Collection[]> {
  const res = await fetch(`${BASE}/collections`)
  if (!res.ok) throw new Error('Failed to fetch collections')
  return res.json()
}

export async function createCollection(data: { name: string; description?: string; color?: string }): Promise<Collection> {
  const res = await fetch(`${BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create collection')
  return res.json()
}

export async function deleteCollection(id: number): Promise<void> {
  const res = await fetch(`${BASE}/collections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete collection')
}

// Bookmarks
export async function bookmarkPost(postId: number, collectionId?: number): Promise<Bookmark> {
  const res = await fetch(`${BASE}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId, collection_id: collectionId ?? null }),
  })
  if (!res.ok) throw new Error('Failed to bookmark post')
  return res.json()
}

export async function removeBookmark(postId: number): Promise<void> {
  const res = await fetch(`${BASE}/bookmarks/${postId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to remove bookmark')
}

export async function getBookmarks(collectionId?: number): Promise<Bookmark[]> {
  const sp = new URLSearchParams()
  if (collectionId !== undefined) sp.set('collection_id', String(collectionId))
  const res = await fetch(`${BASE}/bookmarks?${sp}`)
  if (!res.ok) throw new Error('Failed to fetch bookmarks')
  return res.json()
}

// Monitor / Saved Searches
export async function getSavedSearches(): Promise<SavedSearch[]> {
  const res = await fetch(`${BASE}/monitor/searches`)
  if (!res.ok) throw new Error('Failed to fetch saved searches')
  return res.json()
}

export async function createSavedSearch(data: {
  name: string
  query: string
  content_type?: string
  time_range?: string
  location?: string
  max_posts?: number
  schedule_hours?: number
}): Promise<SavedSearch> {
  const res = await fetch(`${BASE}/monitor/searches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create saved search')
  return res.json()
}

export async function updateSavedSearch(
  id: number,
  data: Partial<SavedSearch>,
): Promise<SavedSearch> {
  const res = await fetch(`${BASE}/monitor/searches/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update saved search')
  return res.json()
}

export async function deleteSavedSearch(id: number): Promise<void> {
  const res = await fetch(`${BASE}/monitor/searches/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete saved search')
}

export async function runSavedSearch(id: number): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/monitor/searches/${id}/run`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to run saved search')
  return res.json()
}

export async function getMonitorResults(limit = 50): Promise<MonitorResult[]> {
  const res = await fetch(`${BASE}/monitor/results?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch monitor results')
  return res.json()
}

export async function getUnreadCount(): Promise<{ unread: number }> {
  const res = await fetch(`${BASE}/monitor/results/unread`)
  if (!res.ok) throw new Error('Failed to fetch unread count')
  return res.json()
}

// Export
export async function exportPosts(format: 'csv' | 'json', query?: string, collectionId?: number): Promise<void> {
  const sp = new URLSearchParams()
  sp.set('format', format)
  if (query) sp.set('q', query)
  if (collectionId !== undefined) sp.set('collection_id', String(collectionId))

  const res = await fetch(`${BASE}/posts/export?${sp}`)
  if (!res.ok) throw new Error('Failed to export posts')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `linkedin_posts.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
