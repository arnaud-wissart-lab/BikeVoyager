import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { clearRouteErrors, setRouteUnexpectedError } from './actions.errors'
import { buildRouteOptionsVariant } from './actions.route'
import { fetchRoute } from './api'
import {
  apiModeByUi,
  createNavigationDeviationState,
  createNavigationRecalculationPlan,
} from './domain'
import type { MapContext } from './useRoutingController.types'

type NavigationRecalculationStoreSlice = Pick<
  AppStore,
  | 'mode'
  | 'profileSettings'
  | 'detourPoints'
  | 'navigationProgress'
  | 'navigationRecalculationInFlightRef'
  | 'navigationRecalculationGenerationRef'
  | 'navigationRecalculationRequestIdRef'
  | 'navigationIsActiveRef'
  | 'navigationModeRef'
  | 'navigationRouteResultRef'
  | 'routeAlternativeIndex'
  | 'lastRouteRequestRef'
  | 'setRouteErrorMessage'
  | 'setRouteErrorKey'
  | 'setRouteResultFromNavigationRecalculation'
  | 'setHasResult'
  | 'setIsDirty'
  | 'setDetourPoints'
  | 'setNavigationProgress'
  | 'setNavigationDeviationState'
  | 'setNavigationRecalculationStatus'
>

type CreateNavigationRecalculationActionsParams = {
  store: NavigationRecalculationStoreSlice
  map: MapContext
  t: TFunction
}

export const createNavigationRecalculationActions = ({
  store,
  map,
  t,
}: CreateNavigationRecalculationActionsParams) => {
  const getNavigationRecalculationPlan = (evaluatedAtMs: number) => {
    const resolvedMode = store.mode ?? 'bike'
    const lastRoutePayload =
      store.lastRouteRequestRef.current?.type === 'route'
        ? store.lastRouteRequestRef.current.payload
        : null

    return createNavigationRecalculationPlan({
      isNavigationActive: store.navigationIsActiveRef.current,
      navigationMode: store.navigationModeRef.current,
      navigationProgress: store.navigationProgress,
      routeResult: store.navigationRouteResultRef.current,
      detourPointCount: store.detourPoints.length,
      lastRoutePayload,
      mapEndCoordinate: map.mapEndCoordinate,
      endLabel: map.endLabel,
      currentPositionLabel: t('navigationCurrentGpsPosition'),
      destinationFallbackLabel: t('poiEndFallback'),
      fallbackSettings: {
        mode: apiModeByUi[resolvedMode],
        options: buildRouteOptionsVariant(store.routeAlternativeIndex),
        speedKmh: store.profileSettings.speeds[resolvedMode],
        ...(resolvedMode === 'ebike'
          ? {
              ebikeAssist: store.profileSettings.ebikeAssist,
            }
          : {}),
      },
      evaluatedAtMs,
    })
  }

  const handleRecalculateFromCurrentPosition = async () => {
    if (store.navigationRecalculationInFlightRef.current) {
      return false
    }

    const plan = getNavigationRecalculationPlan(Date.now())
    if (!plan.available) {
      return false
    }

    const routeAtRequestStart = store.navigationRouteResultRef.current
    const requestId = store.navigationRecalculationGenerationRef.current + 1
    store.navigationRecalculationGenerationRef.current = requestId
    store.navigationRecalculationRequestIdRef.current = requestId
    store.navigationRecalculationInFlightRef.current = true
    store.setNavigationRecalculationStatus('loading')
    clearRouteErrors(store)

    const isRequestCurrent = () =>
      store.navigationRecalculationRequestIdRef.current === requestId &&
      store.navigationRecalculationGenerationRef.current === requestId &&
      store.navigationIsActiveRef.current &&
      store.navigationModeRef.current === 'gps' &&
      store.navigationRouteResultRef.current === routeAtRequestStart

    try {
      const result = await fetchRoute(plan.payload)
      if (!isRequestCurrent()) {
        return false
      }

      if (!result.ok) {
        store.setNavigationRecalculationStatus('error')
        return false
      }

      store.lastRouteRequestRef.current = {
        type: 'route',
        payload: plan.payload,
      }
      store.navigationRecalculationRequestIdRef.current = null
      store.navigationRecalculationInFlightRef.current = false
      store.setRouteResultFromNavigationRecalculation(result.result)
      store.setHasResult(true)
      store.setIsDirty(false)
      store.setDetourPoints([])
      store.setNavigationProgress(null)
      store.setNavigationDeviationState(createNavigationDeviationState())
      store.setNavigationRecalculationStatus('success')
      return true
    } catch {
      if (!isRequestCurrent()) {
        return false
      }

      setRouteUnexpectedError(store)
      store.setNavigationRecalculationStatus('error')
      return false
    } finally {
      if (store.navigationRecalculationRequestIdRef.current === requestId) {
        store.navigationRecalculationRequestIdRef.current = null
        store.navigationRecalculationInFlightRef.current = false
      }
    }
  }

  return {
    getNavigationRecalculationPlan,
    handleRecalculateFromCurrentPosition,
  }
}
