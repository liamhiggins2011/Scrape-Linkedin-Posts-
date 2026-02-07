import { useEffect, useState } from 'react'
import {
  getCollections, createCollection, deleteCollection,
  getBookmarks, exportPosts,
} from '../api/client'
import type { Collection, Bookmark } from '../types'
import PostCard from '../components/PostCard'
import { useToast } from '../components/Toast'

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

export default function CollectionsPage() {
  const toast = useToast()
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])

  const loadCollections = () => {
    getCollections().then(setCollections).catch(() => toast.error('Failed to load collections'))
  }

  useEffect(() => {
    loadCollections()
  }, [])

  useEffect(() => {
    if (selectedId !== null) {
      getBookmarks(selectedId).then(setBookmarks).catch(() => {})
    }
  }, [selectedId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createCollection({ name: newName.trim(), description: newDesc.trim() || undefined, color: newColor })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      loadCollections()
      toast.success('Collection created')
    } catch {
      toast.error('Failed to create collection')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteCollection(id)
      if (selectedId === id) {
        setSelectedId(null)
        setBookmarks([])
      }
      loadCollections()
      toast.success('Collection deleted')
    } catch {
      toast.error('Failed to delete collection')
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await exportPosts(format, undefined, selectedId ?? undefined)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  const selectedCollection = collections.find((c) => c.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Collections</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
        >
          {showCreate ? 'Cancel' : 'New Collection'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Collection name"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Color:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-white' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors w-full"
          >
            Create
          </button>
        </form>
      )}

      {/* Collection grid */}
      {collections.length === 0 && !showCreate ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No collections yet</p>
          <p className="text-gray-500 text-sm mt-1">Create a collection to organize bookmarked posts</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
              className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
                selectedId === c.id ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <h3 className="font-medium text-white truncate">{c.name}</h3>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                  className="text-gray-500 hover:text-red-400 text-sm shrink-0 ml-2"
                >
                  &times;
                </button>
              </div>
              {c.description && <p className="text-gray-500 text-xs mt-1 truncate">{c.description}</p>}
              <p className="text-gray-400 text-xs mt-2">{c.post_count} post{c.post_count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      {/* Selected collection posts */}
      {selectedCollection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {selectedCollection.name}
              <span className="text-gray-500 text-sm font-normal ml-2">
                ({bookmarks.length} post{bookmarks.length !== 1 ? 's' : ''})
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
              >
                Export JSON
              </button>
            </div>
          </div>
          {bookmarks.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No bookmarked posts in this collection</p>
          ) : (
            <div className="space-y-4">
              {bookmarks.map((b) => (
                <PostCard key={b.id} post={b.post} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
