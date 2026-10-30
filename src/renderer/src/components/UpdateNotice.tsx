import type { UpdateState } from '../../../shared/types'
import {
  ArrowUpRightIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FolderIcon
} from './Icons'

export function UpdateNotice({
  update,
  compact = false,
  onDownload,
  onOpenDownloaded,
  onDismiss
}: {
  update: UpdateState
  compact?: boolean
  onDownload: () => void
  onOpenDownloaded: () => void
  onDismiss: () => void
}) {
  const version = update.latestVersion ?? 'the latest version'
  const percent =
    update.progress === null ? null : Math.max(0, Math.min(100, Math.round(update.progress * 100)))
  const isDownloading = update.phase === 'downloading'
  const isDownloaded = update.phase === 'downloaded'
  const isInstalling = update.phase === 'installing'
  const isError = update.phase === 'error'
  const canOpenManualInstaller = isError && Boolean(update.downloadedPath)

  let title = `dachshund ${version} is available`
  let detail = `You are on ${update.currentVersion}. Download the new Apple Silicon build.`
  if (isDownloading) {
    title = `Downloading dachshund ${version}`
    detail = percent === null ? 'Starting download...' : `${percent}% of the installer`
  } else if (isDownloaded) {
    title = `dachshund ${version} is downloaded`
    detail = 'Restarting to install. Your memory library will stay in place.'
  } else if (isInstalling) {
    title = `Installing dachshund ${version}`
    detail = 'The app will close, install, and reopen automatically.'
  } else if (isError) {
    title = canOpenManualInstaller
      ? 'Could not install the update automatically'
      : 'Could not download the update'
    detail = update.error ?? 'Try again in a moment.'
  }

  return (
    <section
      className={`update-notice ${compact ? 'compact' : ''} ${isError ? 'error' : ''} ${isInstalling ? 'installing' : ''}`}
      aria-live="polite"
    >
      <div className="update-mark">
        {isDownloaded ? <CheckIcon size={compact ? 13 : 16} /> : <DownloadIcon size={compact ? 13 : 16} />}
      </div>
      <div className="update-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
        {(isDownloading || isDownloaded || isInstalling) && (
          <span
            className="update-progress"
            aria-label={
              isInstalling
                ? 'Installing update'
                : isDownloaded
                  ? 'Download complete'
                  : percent === null
                    ? 'Downloading'
                    : `${percent}% downloaded`
            }
          >
            <span
              className={isInstalling || (isDownloading && percent === null) ? 'indeterminate' : ''}
              style={
                isInstalling || (isDownloading && percent === null)
                  ? undefined
                  : { width: `${isDownloaded ? 100 : percent}%` }
              }
            />
          </span>
        )}
      </div>
      <div className="update-actions">
        {!isDownloading && !isDownloaded && !isInstalling && !canOpenManualInstaller && (
          <button className="update-primary" type="button" onClick={onDownload}>
            {isError ? 'Try again' : 'Download'}
          </button>
        )}
        {canOpenManualInstaller && (
          <button className="update-primary" type="button" onClick={onOpenDownloaded}>
            Open installer
          </button>
        )}
        {update.releaseUrl && (
          <button
            className="update-link"
            type="button"
            onClick={() => void window.dachshund.openExternal(update.releaseUrl as string)}
            title="Release notes"
          >
            {compact ? <ArrowUpRightIcon size={12} /> : 'Release notes'}
          </button>
        )}
        {isDownloaded && update.downloadedPath && !compact && (
          <button
            className="update-link"
            type="button"
            onClick={() => void window.dachshund.reveal(update.downloadedPath as string)}
            title="Show in Finder"
          >
            <FolderIcon size={12} />
            Show in Finder
          </button>
        )}
        {!isDownloading && !isDownloaded && !isInstalling && (
          <button
            className="update-close"
            type="button"
            aria-label="Dismiss update notice"
            title="Later"
            onClick={onDismiss}
          >
            <CloseIcon size={12} />
          </button>
        )}
      </div>
    </section>
  )
}
