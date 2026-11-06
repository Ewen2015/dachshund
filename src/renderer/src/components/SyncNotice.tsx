import { useEffect, useRef, useState } from 'react'
import type { ScanResult } from '../../../shared/types'
import { relativeTime } from '../lib/format'
import { ChevronRightIcon, CloseIcon, RefreshIcon } from './Icons'

function summary(result: ScanResult): string {
  if (!result.ok) return 'Sync failed · last success preserved'
  // Always report this refresh's delta, including zero, so a scan with no new
  // source changes cannot look like another full import.
  const changed: string[] = [
    `${result.added} ${result.added === 1 ? 'memory' : 'memories'} added`,
    `${result.updated} ${result.updated === 1 ? 'memory' : 'memories'} updated`
  ]
  if (result.failures.length) {
    changed.push(
      `${result.failures.length} ${result.failures.length === 1 ? 'agent' : 'agents'} could not be read`
    )
  }
  return changed.join(' · ')
}

export function SyncNotice({
  result,
  lastSuccessfulSyncAt,
  compact = false,
  onDismiss
}: {
  result: ScanResult
  lastSuccessfulSyncAt: number | null
  compact?: boolean
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [paused, setPaused] = useState(false)
  const dismissRef = useRef(onDismiss)
  const hasDetails = result.changes.length > 0

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    setExpanded(false)
  }, [result.startedAt])

  useEffect(() => {
    if (paused || expanded) return
    const timer = window.setTimeout(() => dismissRef.current(), 3000)
    return () => window.clearTimeout(timer)
  }, [expanded, paused, result.finishedAt, result.startedAt])

  return (
    <section
      className={`sync-notice ${compact ? 'compact' : ''} ${result.ok ? '' : 'error'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
    >
      <div className="sync-notice-main">
        <span className="sync-notice-icon">
          <RefreshIcon size={14} />
        </span>
        <div className="sync-notice-copy">
          <strong>{summary(result)}</strong>
          <span>
            Last success: {lastSuccessfulSyncAt ? relativeTime(lastSuccessfulSyncAt) : 'Not yet'}
            {result.failures[0] ? ` · ${result.failures[0].agentName}: ${result.failures[0].message}` : ''}
          </span>
        </div>
        {hasDetails && !compact && (
          <button
            className={`sync-notice-expand ${expanded ? 'expanded' : ''}`}
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            <ChevronRightIcon size={13} />
            {expanded ? 'Hide details' : `View ${result.changes.length} changes`}
          </button>
        )}
        <button
          className="sync-notice-close"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss sync result"
        >
          <CloseIcon size={12} />
        </button>
      </div>
      {expanded && hasDetails && (
        <div className="sync-notice-list">
          {result.changes.map((change) => (
            <div className="sync-change" key={`${change.change}-${change.memoryId}`}>
              <span className={`sync-change-kind ${change.change}`}>
                {change.change === 'added' ? 'Added' : 'Updated'}
              </span>
              <strong>{change.title}</strong>
              <span>{change.agentName}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
