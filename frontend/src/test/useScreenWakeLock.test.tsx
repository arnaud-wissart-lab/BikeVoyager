import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScreenWakeLock } from '../features/map/useScreenWakeLock'

class FakeWakeLockSentinel extends EventTarget implements WakeLockSentinel {
  onrelease: ((this: WakeLockSentinel, ev: Event) => unknown) | null = null
  released = false
  readonly type = 'screen'

  readonly release = vi.fn(async () => {
    if (this.released) {
      return
    }

    this.released = true
    this.dispatchEvent(new Event('release'))
  })

  emitRelease() {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

const originalWakeLockDescriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'visibilityState',
)

const restoreProperty = (
  target: Navigator | Document,
  property: 'wakeLock' | 'visibilityState',
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
    return
  }

  Reflect.deleteProperty(target, property)
}

const setVisibilityState = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
}

const installWakeLock = (request: WakeLock['request']) => {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request } satisfies WakeLock,
  })
}

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

afterEach(() => {
  cleanup()
  restoreProperty(navigator, 'wakeLock', originalWakeLockDescriptor)
  restoreProperty(document, 'visibilityState', originalVisibilityStateDescriptor)
  vi.restoreAllMocks()
})

describe('useScreenWakeLock', () => {
  it('signale que l’API est indisponible sans lever d’exception', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock')

    const { result } = renderHook(() => useScreenWakeLock(true))

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'unsupported', error: null })
    })
  })

  it('ne demande aucun verrouillage lorsque la navigation est inactive', () => {
    const request = vi.fn<WakeLock['request']>()
    installWakeLock(request)

    const { result } = renderHook(() => useScreenWakeLock(false))

    expect(request).not.toHaveBeenCalled()
    expect(result.current).toEqual({ status: 'idle', error: null })
  })

  it('demande un verrouillage d’écran au démarrage de la navigation', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockResolvedValue(sentinel)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: false } },
    )

    rerender({ enabled: true })

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1)
      expect(request).toHaveBeenCalledWith('screen')
      expect(result.current).toEqual({ status: 'active', error: null })
    })
  })

  it('libère le verrouillage à l’arrêt de la navigation', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockResolvedValue(sentinel)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(result.current.status).toBe('active'))

    rerender({ enabled: false })

    await waitFor(() => {
      expect(sentinel.release).toHaveBeenCalledTimes(1)
      expect(result.current).toEqual({ status: 'idle', error: null })
    })
  })

  it('libère le verrouillage au démontage', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockResolvedValue(sentinel)
    installWakeLock(request)
    const { result, unmount } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(result.current.status).toBe('active'))

    unmount()

    await waitFor(() => expect(sentinel.release).toHaveBeenCalledTimes(1))
  })

  it('retourne une erreur non bloquante lorsque la demande échoue', async () => {
    const request = vi
      .fn<WakeLock['request']>()
      .mockRejectedValue(new DOMException('Autorisation refusée', 'NotAllowedError'))
    installWakeLock(request)

    const { result } = renderHook(() => useScreenWakeLock(true))

    await waitFor(() => {
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Autorisation refusée')
    })
  })

  it('redemande le verrouillage au retour au premier plan après sa libération', async () => {
    const firstSentinel = new FakeWakeLockSentinel()
    const secondSentinel = new FakeWakeLockSentinel()
    const request = vi
      .fn<WakeLock['request']>()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    installWakeLock(request)
    const { result } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(result.current.status).toBe('active'))

    act(() => {
      setVisibilityState('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      firstSentinel.emitRelease()
    })
    expect(request).toHaveBeenCalledTimes(1)

    act(() => {
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('active')
    })
  })

  it('ne demande pas de nouveau verrouillage lorsque la page est masquée', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockResolvedValue(sentinel)
    installWakeLock(request)
    const { result } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(result.current.status).toBe('active'))

    act(() => {
      setVisibilityState('hidden')
      sentinel.emitRelease()
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
  })

  it('libère immédiatement un sentinel acquis après l’arrêt', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const deferred = createDeferred<WakeLockSentinel>()
    const request = vi.fn<WakeLock['request']>().mockReturnValue(deferred.promise)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    rerender({ enabled: false })
    await act(async () => {
      deferred.resolve(sentinel)
      await deferred.promise
    })

    await waitFor(() => {
      expect(sentinel.release).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('idle')
    })
  })

  it('conserve une seule demande simultanée malgré plusieurs rendus', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const deferred = createDeferred<WakeLockSentinel>()
    const request = vi.fn<WakeLock['request']>().mockReturnValue(deferred.promise)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: true } },
    )

    rerender({ enabled: true })
    rerender({ enabled: true })
    rerender({ enabled: true })
    expect(request).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve(sentinel)
      await deferred.promise
    })
    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('nettoie le sentinel lorsque son événement release est émis', async () => {
    const sentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockResolvedValue(sentinel)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(result.current.status).toBe('active'))

    act(() => {
      setVisibilityState('hidden')
      sentinel.emitRelease()
    })
    rerender({ enabled: false })

    expect(result.current.status).toBe('idle')
    expect(sentinel.release).not.toHaveBeenCalled()
  })

  it('limite la reprise automatique après un événement release visible', async () => {
    const firstSentinel = new FakeWakeLockSentinel()
    const secondSentinel = new FakeWakeLockSentinel()
    const request = vi
      .fn<WakeLock['request']>()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    installWakeLock(request)
    const { result } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(result.current.status).toBe('active'))

    act(() => firstSentinel.emitRelease())
    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('active')
    })

    act(() => secondSentinel.emitRelease())

    expect(result.current.status).toBe('idle')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('rejoue la demande après un retour visible pendant une demande qui échoue', async () => {
    const firstRequest = createDeferred<WakeLockSentinel>()
    const secondSentinel = new FakeWakeLockSentinel()
    const request = vi
      .fn<WakeLock['request']>()
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce(secondSentinel)
    installWakeLock(request)
    const { result } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    act(() => {
      setVisibilityState('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      firstRequest.reject(new DOMException('Autorisation refusée', 'NotAllowedError'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('active')
    })
  })

  it('rejoue une seule fois la demande quand le sentinel reçu est déjà libéré', async () => {
    const releasedSentinel = new FakeWakeLockSentinel()
    releasedSentinel.released = true
    const activeSentinel = new FakeWakeLockSentinel()
    const request = vi
      .fn<WakeLock['request']>()
      .mockResolvedValueOnce(releasedSentinel)
      .mockResolvedValueOnce(activeSentinel)
    installWakeLock(request)

    const { result } = renderHook(() => useScreenWakeLock(true))

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2)
      expect(result.current.status).toBe('active')
    })
    expect(releasedSentinel.release).not.toHaveBeenCalled()
  })

  it('ne duplique pas la demande si la première réussit après un retour visible', async () => {
    const firstRequest = createDeferred<WakeLockSentinel>()
    const activeSentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockReturnValue(firstRequest.promise)
    installWakeLock(request)
    const { result } = renderHook(() => useScreenWakeLock(true))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    act(() => {
      setVisibilityState('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      firstRequest.resolve(activeSentinel)
      await firstRequest.promise
    })

    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('annule la reprise en attente si la navigation s’arrête pendant la demande', async () => {
    const firstRequest = createDeferred<WakeLockSentinel>()
    const lateSentinel = new FakeWakeLockSentinel()
    const request = vi.fn<WakeLock['request']>().mockReturnValue(firstRequest.promise)
    installWakeLock(request)
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenWakeLock(enabled),
      { initialProps: { enabled: true } },
    )
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))

    act(() => {
      setVisibilityState('hidden')
      document.dispatchEvent(new Event('visibilitychange'))
      setVisibilityState('visible')
      document.dispatchEvent(new Event('visibilitychange'))
    })
    rerender({ enabled: false })
    await act(async () => {
      firstRequest.resolve(lateSentinel)
      await firstRequest.promise
    })

    await waitFor(() => {
      expect(lateSentinel.release).toHaveBeenCalledTimes(1)
      expect(result.current.status).toBe('idle')
    })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
