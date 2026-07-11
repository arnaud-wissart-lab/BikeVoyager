import type { NavigationDeviationState } from './navigationDeviation'
import type { NavigationMode } from './types'

export const navigationAutoRecalculationDelayMs = 8000

export type NavigationAutoRecalculationStatus = 'idle' | 'countdown' | 'cancelled' | 'triggered'

export type NavigationAutoRecalculationDecision =
  | {
      shouldCountdown: true
      episodeKey: string
    }
  | {
      shouldCountdown: false
      reason:
        'disabled' | 'not_off_route' | 'unavailable' | 'already_attempted' | 'cancelled' | 'loading'
    }

type BuildNavigationDeviationEpisodeKeyParams = {
  deviationState: NavigationDeviationState
  routeSessionKey: string | number | null
}

export const buildNavigationDeviationEpisodeKey = ({
  deviationState,
  routeSessionKey,
}: BuildNavigationDeviationEpisodeKeyParams) => {
  if (
    deviationState.status !== 'off_route' ||
    deviationState.firstOffRouteAtMs === null ||
    routeSessionKey === null
  ) {
    return null
  }

  return `${routeSessionKey}:${deviationState.firstOffRouteAtMs}`
}

type ResolveNavigationAutoRecalculationDecisionParams = {
  enabled: boolean
  isNavigationActive: boolean
  navigationMode: NavigationMode
  deviationState: NavigationDeviationState
  routeSessionKey: string | number | null
  isRecalculationAvailable: boolean
  isRecalculationLoading: boolean
  attemptedEpisodeKey: string | null
  cancelledEpisodeKey: string | null
}

export const resolveNavigationAutoRecalculationDecision = ({
  enabled,
  isNavigationActive,
  navigationMode,
  deviationState,
  routeSessionKey,
  isRecalculationAvailable,
  isRecalculationLoading,
  attemptedEpisodeKey,
  cancelledEpisodeKey,
}: ResolveNavigationAutoRecalculationDecisionParams): NavigationAutoRecalculationDecision => {
  if (!enabled) {
    return { shouldCountdown: false, reason: 'disabled' }
  }

  const episodeKey = buildNavigationDeviationEpisodeKey({ deviationState, routeSessionKey })
  if (!isNavigationActive || navigationMode !== 'gps' || !episodeKey) {
    return { shouldCountdown: false, reason: 'not_off_route' }
  }

  if (isRecalculationLoading) {
    return { shouldCountdown: false, reason: 'loading' }
  }

  if (attemptedEpisodeKey === episodeKey) {
    return { shouldCountdown: false, reason: 'already_attempted' }
  }

  if (cancelledEpisodeKey === episodeKey) {
    return { shouldCountdown: false, reason: 'cancelled' }
  }

  if (!isRecalculationAvailable) {
    return { shouldCountdown: false, reason: 'unavailable' }
  }

  return { shouldCountdown: true, episodeKey }
}

export const clampNavigationAutoRecalculationCountdown = (
  deadlineMs: number,
  evaluatedAtMs: number,
) => {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(evaluatedAtMs)) {
    return 0
  }

  return Math.max(0, Math.ceil((deadlineMs - evaluatedAtMs) / 1000))
}
