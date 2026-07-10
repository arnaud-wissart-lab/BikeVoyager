import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  formatRouteStepDistance,
  type NavigationDeviationState,
  type NavigationRecalculationPlan,
  type NavigationRecalculationStatus,
} from './domain'

type UseNavigationDeviationPresentationParams = {
  deviationState: NavigationDeviationState
  recalculationStatus: NavigationRecalculationStatus
  getRecalculationPlan: (evaluatedAtMs: number) => NavigationRecalculationPlan
  t: TFunction
}

export const useNavigationDeviationPresentation = ({
  deviationState,
  recalculationStatus,
  getRecalculationPlan,
  t,
}: UseNavigationDeviationPresentationParams) => {
  const [evaluatedAtMs, setEvaluatedAtMs] = useState(() => Date.now())

  useEffect(() => {
    if (deviationState.status !== 'off_route') {
      return
    }

    setEvaluatedAtMs(Date.now())
    const intervalId = window.setInterval(() => {
      setEvaluatedAtMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [deviationState.status])

  const recalculationPlan = getRecalculationPlan(evaluatedAtMs)
  const unavailableMessage = recalculationPlan.available
    ? null
    : recalculationPlan.reason === 'loop'
      ? t('navigationLoopRecalculationUnavailable')
      : recalculationPlan.reason === 'waypoints'
        ? t('navigationWaypointRecalculationUnavailable')
        : recalculationPlan.reason === 'position_inaccurate'
          ? t('navigationGpsPositionInaccurate')
          : recalculationPlan.reason === 'position_stale' ||
              recalculationPlan.reason === 'position_unavailable'
            ? t('navigationGpsPositionStale')
            : t('navigationRecalculationFailed')

  const navigationOffRouteAlert =
    deviationState.status === 'off_route'
      ? {
          distanceLabel:
            formatRouteStepDistance(deviationState.distanceToRouteMeters) ?? t('placeholderValue'),
          showRecalculateAction: recalculationPlan.available || recalculationPlan.reason !== 'loop',
          isRecalculateDisabled: !recalculationPlan.available || recalculationStatus === 'loading',
          isRecalculating: recalculationStatus === 'loading',
          unavailableMessage,
          errorMessage: recalculationStatus === 'error' ? t('navigationRecalculationFailed') : null,
        }
      : null
  const navigationRecalculationSuccessMessage =
    recalculationStatus === 'success' ? t('navigationRouteRecalculated') : null

  return {
    navigationOffRouteAlert,
    navigationRecalculationSuccessMessage,
  }
}
