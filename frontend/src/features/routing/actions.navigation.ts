import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import {
  clearRouteErrors,
  normalizeRouteResponseError,
  setRouteUnexpectedError,
} from './actions.errors'
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
  | 'routeResult'
  | 'detourPoints'
  | 'isNavigationActive'
  | 'navigationMode'
  | 'navigationProgress'
  | 'navigationRecalculationInFlightRef'
  | 'routeAlternativeIndex'
  | 'lastRouteRequestRef'
  | 'setRouteErrorMessage'
  | 'setRouteErrorKey'
  | 'setRouteResult'
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
      isNavigationActive: store.isNavigationActive,
      navigationMode: store.navigationMode,
      navigationProgress: store.navigationProgress,
      routeResult: store.routeResult,
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

    store.navigationRecalculationInFlightRef.current = true
    store.setNavigationRecalculationStatus('loading')
    clearRouteErrors(store)
    store.lastRouteRequestRef.current = {
      type: 'route',
      payload: plan.payload,
    }

    try {
      const result = await fetchRoute(plan.payload)
      if (!result.ok) {
        await normalizeRouteResponseError(result.response, store)
        store.setNavigationRecalculationStatus('error')
        return false
      }

      store.setRouteResult(result.result)
      store.setHasResult(true)
      store.setIsDirty(false)
      store.setDetourPoints([])
      store.setNavigationProgress(null)
      store.setNavigationDeviationState(createNavigationDeviationState())
      store.setNavigationRecalculationStatus('success')
      return true
    } catch {
      setRouteUnexpectedError(store)
      store.setNavigationRecalculationStatus('error')
      return false
    } finally {
      store.navigationRecalculationInFlightRef.current = false
    }
  }

  return {
    getNavigationRecalculationPlan,
    handleRecalculateFromCurrentPosition,
  }
}
