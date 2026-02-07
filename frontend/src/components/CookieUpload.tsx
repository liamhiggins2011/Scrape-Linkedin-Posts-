import { useState, useRef } from 'react'
import { uploadCookies } from '../api/client'

interface Props {
  onUploaded: () => void
  isUploaded: boolean
}

export default function CookieUpload({ onUploaded, isUploaded }: Props) {
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError('')
    try {
      await uploadCookies(file)
      onUploaded()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h2 className="text-lg font-semibold text-white mb-2">LinkedIn Cookies</h2>
      <p className="text-sm text-gray-400 mb-4">
        Upload your LinkedIn cookies file in Netscape format. Use a browser extension like
        "Cookie-Editor" or "EditThisCookie" to export them.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm">Status:</span>
        {isUploaded ? (
          <span className="text-green-400 text-sm font-medium">Cookies uploaded</span>
        ) : (
          <span className="text-red-400 text-sm font-medium">No cookies uploaded</span>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <p className="text-gray-300">Drop your cookies.txt file here, or click to browse</p>
        <input
          ref={fileRef}
          type="file"
          accept=".txt"
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  )
}
