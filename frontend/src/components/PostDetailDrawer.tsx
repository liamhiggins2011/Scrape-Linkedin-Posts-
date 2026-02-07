import { useState, useEffect } from 'react'
import type { Post, Collection } from '../types'
import { bookmarkPost, removeBookmark, getCollections } from '../api/client'
import { useToast } from './Toast'

interface Props {
  post: Post | null
  onClose: () => void
  onBookmarkChange?: () => void
}

export default function PostDetailDrawer({ post, onClose, onBookmarkChange }: Props) {
  const toast = useToast()
  const [bookmarked, setBookmarked] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (post) {
      setBookmarked(post.is_bookmarked)
      getCollections().then(setCollections).catch(() => {})
    }
  }, [post])

  if (!post) return null

  const initials = (post.author_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const sentimentColor =
    post.sentiment_label === 'positive'
      ? 'text-green-400 bg-green-900/30'
      : post.sentiment_label === 'negative'
        ? 'text-red-400 bg-red-900/30'
        : 'text-yellow-400 bg-yellow-900/30'

  const hashtags = post.hashtags ? post.hashtags.split(',').filter(Boolean) : []
  let topics: string[] = []
  try {
    topics = post.topics ? JSON.parse(post.topics) : []
  } catch { /* empty */ }

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        await removeBookmark(post.id)
        setBookmarked(false)
        toast.info('Bookmark removed')
      } else {
        await bookmarkPost(post.id)
        setBookmarked(true)
        toast.success('Post bookmarked')
      }
      onBookmarkChange?.()
    } catch {
      toast.error('Failed to update bookmark')
    }
  }

  const handleAddToCollection = async (collectionId: number) => {
    try {
      await bookmarkPost(post.id, collectionId)
      setBookmarked(true)
      toast.success('Added to collection')
      onBookmarkChange?.()
    } catch {
      toast.error('Failed to add to collection')
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(post.content || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto animate-[slideInRight_0.3s_ease-out]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Post Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
              &times;
            </button>
          </div>

          {/* Author card */}
          <div className="flex items-center gap-3 mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{post.author_name || 'Unknown'}</p>
              <p className="text-sm text-gray-400 truncate">{post.author_jobtitle}</p>
              {post.author_profile && (
                <a
                  href={post.author_profile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  View Profile
                </a>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-200 text-sm whitespace-pre-line leading-relaxed">
              {post.content}
            </p>
          </div>

          {/* Engagement metrics */}
          <div className="flex items-center gap-6 mb-6 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{post.reactions}</p>
              <p className="text-gray-500 text-xs">Reactions</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{post.comments}</p>
              <p className="text-gray-500 text-xs">Comments</p>
            </div>
            {post.impressions > 0 && (
              <div className="text-center">
                <p className="text-xl font-bold text-white">{post.impressions}</p>
                <p className="text-gray-500 text-xs">Impressions</p>
              </div>
            )}
            {post.engagement_score != null && (
              <div className="text-center">
                <p className="text-xl font-bold text-blue-400">{post.engagement_score}</p>
                <p className="text-gray-500 text-xs">Engagement</p>
              </div>
            )}
          </div>

          {/* Sentiment */}
          {post.sentiment_label && (
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sentiment</p>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sentimentColor}`}>
                {post.sentiment_label} ({post.sentiment?.toFixed(2)})
              </span>
            </div>
          )}

          {/* Topics */}
          {topics.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <span key={t} className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((h) => (
                  <span key={h} className="px-2 py-1 bg-blue-900/30 border border-blue-800/50 rounded text-xs text-blue-300">
                    #{h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-700">
            <button
              onClick={handleBookmark}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                bookmarked
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600'
              }`}
            >
              {bookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>

            {collections.length > 0 && (
              <select
                onChange={(e) => {
                  const val = e.target.value
                  if (val) handleAddToCollection(Number(val))
                  e.target.value = ''
                }}
                defaultValue=""
                className="w-full py-2 px-3 rounded-lg text-sm bg-gray-800 border border-gray-600 text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="" disabled>Add to collection...</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <div className="flex gap-2">
              {post.post_url && (
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 text-center rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  View on LinkedIn
                </a>
              )}
              <button
                onClick={handleCopy}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Content'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
