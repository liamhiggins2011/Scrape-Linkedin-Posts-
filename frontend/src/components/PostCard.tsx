import { useState } from 'react'
import type { Post, Collection } from '../types'
import { bookmarkPost, removeBookmark, getCollections } from '../api/client'
import { useToast } from './Toast'

interface Props {
  post: Post
  onClick?: () => void
  onBookmarkChange?: () => void
}

export default function PostCard({ post, onClick, onBookmarkChange }: Props) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked)
  const [showCollections, setShowCollections] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const content = post.content || ''
  const isLong = content.length > 200

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

  const hashtags = post.hashtags ? post.hashtags.split(',').filter(Boolean).slice(0, 5) : []

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
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

  const handleShowCollections = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showCollections) {
      try {
        const cols = await getCollections()
        setCollections(cols)
      } catch { /* empty */ }
    }
    setShowCollections(!showCollections)
  }

  const handleAddToCollection = async (collectionId: number) => {
    try {
      await bookmarkPost(post.id, collectionId)
      setBookmarked(true)
      setShowCollections(false)
      toast.success('Added to collection')
      onBookmarkChange?.()
    } catch {
      toast.error('Failed to add to collection')
    }
  }

  return (
    <div
      className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{post.author_name || 'Unknown'}</p>
            <p className="text-sm text-gray-400 truncate">{post.author_jobtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {post.sentiment_label && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sentimentColor}`}>
              {post.sentiment_label}
            </span>
          )}
          <span className="text-xs text-gray-500">{post.post_time}</span>
          <button
            onClick={handleBookmark}
            className={`text-lg leading-none transition-colors ${
              bookmarked ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'
            }`}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {bookmarked ? '\u2605' : '\u2606'}
          </button>
        </div>
      </div>

      <p className="text-gray-200 text-sm whitespace-pre-line mb-3">
        {expanded || !isLong ? content : content.slice(0, 200) + '...'}
        {isLong && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="ml-1 text-blue-400 hover:underline text-xs"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </p>

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {hashtags.map((h) => (
            <span key={h} className="px-2 py-0.5 bg-blue-900/30 border border-blue-800/50 rounded text-xs text-blue-300">
              #{h}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>{post.reactions} reactions</span>
        <span>{post.comments} comments</span>
        {post.impressions > 0 && <span>{post.impressions} impressions</span>}

        {/* Engagement bar */}
        {post.engagement_score != null && (
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-700 rounded-full">
              <div
                className="h-1.5 bg-blue-500 rounded-full"
                style={{ width: `${Math.min(post.engagement_score, 100)}%` }}
              />
            </div>
            <span className="text-blue-400">{post.engagement_score}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={handleShowCollections}
              className="text-gray-500 hover:text-gray-300 text-xs"
              title="Add to collection"
            >
              +
            </button>
            {showCollections && collections.length > 0 && (
              <div className="absolute right-0 bottom-6 bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={(e) => { e.stopPropagation(); handleAddToCollection(c.id) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {post.post_url && (
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-400 hover:underline"
            >
              View on LinkedIn
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
