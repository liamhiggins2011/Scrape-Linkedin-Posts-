import { useState, useEffect, useRef } from 'react'
import ScrapeForm from '../components/ScrapeForm'
import ScrapeStatus from '../components/ScrapeStatus'
import { startScrape, getScrapeStatus, getScrapeHistory } from '../api/client'
import { useToast } from '../components/Toast'
import type { ScrapeJob } from '../types'

export default function ScrapePage() {
  const toast = useToast()
  const [activeJob, setActiveJob] = useState<ScrapeJob | null>(null)
  const [history, setHistory] = useState<ScrapeJob[]>([])
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    getScrapeHistory().then(setHistory).catch(() => {})
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleStart = async (profileUrl: string, maxPosts: number) => {
    try {
      const job = await startScrape(profileUrl, maxPosts)
      setActiveJob(job)
      toast.info('Scrape job started')
      pollJob(job.job_id)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const pollJob = (jobId: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(async () => {
      try {
        const job = await getScrapeStatus(jobId)
        setActiveJob(job)
        if (job.status !== 'running') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          getScrapeHistory().then(setHistory).catch(() => {})
          if (job.status === 'completed') {
            toast.success(`Scrape completed: ${job.posts_found} posts found`)
          } else if (job.status === 'failed') {
            toast.error(job.error || 'Scrape failed')
          }
        }
      } catch {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
      }
    }, 2000)
  }

  const isRunning = activeJob?.status === 'running'

  return (
    <div className="space-y-6">
      <ScrapeForm onSubmit={handleStart} disabled={isRunning} />

      {activeJob && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Current Job</h3>
          <ScrapeStatus job={activeJob} />
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">History</h3>
          <div className="space-y-2">
            {history.map((job) => (
              <ScrapeStatus key={job.job_id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
