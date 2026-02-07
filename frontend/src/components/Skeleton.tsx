export function PostCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700" />
          <div>
            <div className="h-4 w-32 bg-gray-700 rounded mb-1" />
            <div className="h-3 w-48 bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-3 w-16 bg-gray-700 rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-700 rounded" />
        <div className="h-3 w-3/4 bg-gray-700 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-20 bg-gray-700 rounded" />
        <div className="h-3 w-20 bg-gray-700 rounded" />
        <div className="h-3 w-20 bg-gray-700 rounded" />
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 animate-pulse">
      <div className="h-3 w-24 bg-gray-700 rounded mb-2" />
      <div className="h-8 w-16 bg-gray-700 rounded" />
    </div>
  )
}
