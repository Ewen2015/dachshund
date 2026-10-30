import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../shared/types'

export function useUpdater() {
  const [state, setState] = useState<UpdateState | null>(null)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  useEffect(() => {
    void window.dachshund.getUpdateState().then(setState)
    return window.dachshund.onUpdateChanged(setState)
  }, [])

  const dismissKey =
    state?.latestVersion ??
    (state?.phase === 'error' && state.checkedAt ? `error:${state.checkedAt}` : null)
  const visible =
    Boolean(state) &&
    state?.phase !== 'idle' &&
    state?.phase !== 'checking' &&
    state?.phase !== 'up-to-date' &&
    !(state?.phase === 'error' && !state.latestVersion) &&
    dismissKey !== dismissedKey

  const download = async (): Promise<void> => {
    const next = await window.dachshund.downloadUpdate()
    if (next) setState(next)
  }

  const openDownloaded = async (): Promise<void> => {
    await window.dachshund.openDownloadedUpdate()
  }

  const dismiss = (): void => {
    if (dismissKey) setDismissedKey(dismissKey)
  }

  return {
    state,
    visible,
    download,
    openDownloaded,
    dismiss
  }
}
