import type { ScrapeJob } from '../types'

export default function ScrapeStatus({ job }: { job: ScrapeJob }) {
  const statusColors: Record<string, string> = {
    running: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className={`font-medium capitalize ${statusColors[job.status] || 'text-gray-300'}`}>
          {job.status === 'running' && (
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse" />
          )}
          {job.status}
        </span>
        <span className="text-sm text-gray-400">{job.posts_found} posts found</span>
      </div>
      {job.profile_url && (
        <p className="text-xs text-gray-500 truncate">{job.profile_url}</p>
      )}
      {job.error && <p className="text-sm text-red-400 mt-2">{job.error}</p>}
    </div>
  )
}
