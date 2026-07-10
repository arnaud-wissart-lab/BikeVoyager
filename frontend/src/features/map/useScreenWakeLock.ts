import { useCallback, useEffect, useRef, useState } from 'react'

export type ScreenWakeLockStatus = 'idle' | 'requesting' | 'active' | 'unsupported' | 'error'

export type UseScreenWakeLockResult = {
  status: ScreenWakeLockStatus
  error: string | null
}

type SentinelReleaseListener = {
  sentinel: WakeLockSentinel
  listener: () => void
}

const isDocumentVisible = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible'

const getScreenWakeLock = (): WakeLock | null => {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return null
  }

  const wakeLock = navigator.wakeLock
  return wakeLock && typeof wakeLock.request === 'function' ? wakeLock : null
}

const getWakeLockErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Échec de la demande de verrouillage de l’écran.'
}

const releaseUnexpectedSentinel = async (sentinel: WakeLockSentinel) => {
  if (sentinel.released) {
    return
  }

  try {
    await sentinel.release()
  } catch {
    // La libération reste sans effet sur la navigation.
  }
}

export const useScreenWakeLock = (enabled: boolean): UseScreenWakeLockResult => {
  const [result, setResult] = useState<UseScreenWakeLockResult>({
    status: 'idle',
    error: null,
  })
  const mountedRef = useRef(false)
  const enabledRef = useRef(enabled)
  const generationRef = useRef(0)
  const requestIdRef = useRef(0)
  const requestInFlightRef = useRef<number | null>(null)
  const pendingGenerationRef = useRef<number | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const sentinelReleaseListenerRef = useRef<SentinelReleaseListener | null>(null)
  const releaseRetryUsedRef = useRef(false)
  const requestWakeLockRef = useRef<() => void>(() => undefined)

  enabledRef.current = enabled

  const updateResult = useCallback((status: ScreenWakeLockStatus, error: string | null = null) => {
    if (mountedRef.current) {
      setResult({ status, error })
    }
  }, [])

  const clearSentinel = useCallback((sentinel: WakeLockSentinel) => {
    const releaseListener = sentinelReleaseListenerRef.current
    if (releaseListener?.sentinel === sentinel) {
      sentinel.removeEventListener('release', releaseListener.listener)
      sentinelReleaseListenerRef.current = null
    }

    if (sentinelRef.current === sentinel) {
      sentinelRef.current = null
    }
  }, [])

  const releaseCurrentSentinel = useCallback(async () => {
    const sentinel = sentinelRef.current
    if (!sentinel) {
      return
    }

    clearSentinel(sentinel)
    await releaseUnexpectedSentinel(sentinel)
  }, [clearSentinel])

  const requestWakeLock = useCallback(async () => {
    if (!mountedRef.current || !enabledRef.current || !isDocumentVisible()) {
      return
    }

    const currentSentinel = sentinelRef.current
    if (currentSentinel && !currentSentinel.released) {
      return
    }
    if (currentSentinel) {
      clearSentinel(currentSentinel)
    }

    const generation = generationRef.current
    if (requestInFlightRef.current !== null) {
      pendingGenerationRef.current = generation
      return
    }

    const wakeLock = getScreenWakeLock()
    if (!wakeLock) {
      updateResult('unsupported')
      return
    }

    const requestId = ++requestIdRef.current
    requestInFlightRef.current = requestId
    updateResult('requesting')

    try {
      const sentinel = await wakeLock.request('screen')
      const requestIsCurrent =
        mountedRef.current &&
        enabledRef.current &&
        generationRef.current === generation &&
        isDocumentVisible()

      if (!requestIsCurrent || sentinelRef.current) {
        await releaseUnexpectedSentinel(sentinel)
        return
      }

      const handleRelease = () => {
        if (sentinelRef.current !== sentinel) {
          return
        }

        clearSentinel(sentinel)
        if (!mountedRef.current) {
          return
        }

        updateResult('idle')
        if (enabledRef.current && isDocumentVisible() && !releaseRetryUsedRef.current) {
          releaseRetryUsedRef.current = true
          requestWakeLockRef.current()
        }
      }

      sentinelRef.current = sentinel
      sentinelReleaseListenerRef.current = { sentinel, listener: handleRelease }
      sentinel.addEventListener('release', handleRelease)
      if (sentinel.released) {
        handleRelease()
      } else {
        updateResult('active')
      }
    } catch (error: unknown) {
      if (mountedRef.current && enabledRef.current && generationRef.current === generation) {
        updateResult('error', getWakeLockErrorMessage(error))
      }
    } finally {
      if (requestInFlightRef.current === requestId) {
        requestInFlightRef.current = null
      }

      if (requestInFlightRef.current === null) {
        const pendingGeneration = pendingGenerationRef.current
        pendingGenerationRef.current = null
        if (
          pendingGeneration !== null &&
          pendingGeneration === generationRef.current &&
          mountedRef.current &&
          enabledRef.current &&
          !sentinelRef.current &&
          isDocumentVisible()
        ) {
          requestWakeLockRef.current()
        }
      }
    }
  }, [clearSentinel, updateResult])

  useEffect(() => {
    requestWakeLockRef.current = () => {
      void requestWakeLock()
    }

    return () => {
      requestWakeLockRef.current = () => undefined
    }
  }, [requestWakeLock])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      enabledRef.current = false
      generationRef.current += 1
      pendingGenerationRef.current = null
      void releaseCurrentSentinel()
    }
  }, [releaseCurrentSentinel])

  useEffect(() => {
    generationRef.current += 1
    releaseRetryUsedRef.current = false

    if (!enabled) {
      pendingGenerationRef.current = null
      updateResult('idle')
      void releaseCurrentSentinel()
      return
    }

    requestWakeLockRef.current()
  }, [enabled, releaseCurrentSentinel, updateResult])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      releaseRetryUsedRef.current = false
      const sentinel = sentinelRef.current
      if (sentinel?.released) {
        clearSentinel(sentinel)
      }

      if (enabledRef.current && !sentinelRef.current) {
        requestWakeLockRef.current()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearSentinel])

  return result
}
