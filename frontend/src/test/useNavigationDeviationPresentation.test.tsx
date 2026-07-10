import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { createNavigationDeviationState } from '../features/routing/domain'
import type { NavigationRecalculationStatus } from '../features/routing/domain'
import {
  navigationRecalculationSuccessDurationMs,
  useNavigationDeviationPresentation,
} from '../features/routing/useNavigationDeviationPresentation'

const t = ((key: string) =>
  key === 'navigationRouteRecalculated' ? 'Itinéraire recalculé' : key) as TFunction

const usePresentationHarness = () => {
  const [status, setStatus] = useState<NavigationRecalculationStatus>('success')
  const presentation = useNavigationDeviationPresentation({
    deviationState: createNavigationDeviationState(),
    recalculationStatus: status,
    getRecalculationPlan: () => ({ available: false, reason: 'inactive' }),
    setRecalculationStatus: setStatus,
    t,
  })

  return { status, setStatus, ...presentation }
}

describe('présentation du recalcul de navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('masque le message de succès après le délai prévu', () => {
    const { result } = renderHook(() => usePresentationHarness())

    expect(result.current.navigationRecalculationSuccessMessage).toBe('Itinéraire recalculé')

    act(() => {
      vi.advanceTimersByTime(navigationRecalculationSuccessDurationMs - 1)
    })
    expect(result.current.status).toBe('success')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.navigationRecalculationSuccessMessage).toBeNull()
  })

  it('ne remplace pas un statut plus récent et nettoie le minuteur au démontage', () => {
    const { result, unmount } = renderHook(() => usePresentationHarness())

    expect(vi.getTimerCount()).toBe(1)
    act(() => {
      result.current.setStatus('error')
    })
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      vi.advanceTimersByTime(navigationRecalculationSuccessDurationMs)
    })
    expect(result.current.status).toBe('error')

    act(() => {
      result.current.setStatus('success')
    })
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
