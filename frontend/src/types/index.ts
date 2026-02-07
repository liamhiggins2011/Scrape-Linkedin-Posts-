export interface Post {
  id: number
  post_id: string
  post_url: string | null
  author_name: string | null
  author_profile: string | null
  author_jobtitle: string | null
  post_time: string | null
  content: string | null
  reactions: number
  comments: number
  impressions: number
  date_collected: string | null
  scrape_job_id: string | null
  sentiment: number | null
  sentiment_label: string | null
  topics: string | null
  hashtags: string | null
  engagement_score: number | null
  is_bookmarked: boolean
}

export interface PostsResponse {
  posts: Post[]
  total: number
  page: number
  per_page: number
}

export interface ScrapeJob {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  posts_found: number
  error: string | null
  profile_url: string | null
}

export interface AnalyticsOverview {
  total_posts: number
  total_authors: number
  avg_engagement: number
  posts_today: number
  posts_this_week: number
}

export interface AuthorStats {
  author_name: string
  post_count: number
  avg_engagement: number
}

export interface TopicFrequency {
  topic: string
  count: number
}

export interface EngagementPoint {
  date: string
  avg_engagement: number
  post_count: number
}

export interface SentimentData {
  label: string
  count: number
}

export interface HashtagData {
  hashtag: string
  count: number
}

export interface Collection {
  id: number
  name: string
  description: string | null
  color: string
  created_at: string
  post_count: number
}

export interface Bookmark {
  id: number
  post_id: number
  collection_id: number | null
  created_at: string
  post: Post
}

export interface SavedSearch {
  id: number
  name: string
  query: string
  content_type: string
  time_range: string
  location: string
  max_posts: number
  schedule_hours: number
  enabled: boolean
  last_run: string | null
  created_at: string
}

export interface MonitorResult {
  id: number
  saved_search_id: number
  new_posts_count: number
  run_at: string
  job_id: string | null
}
