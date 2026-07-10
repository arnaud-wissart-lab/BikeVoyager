import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { fetchLoop, fetchRoute } from './api'
import {
  buildLoopRequest,
  createRouteComparisonSummary,
  type DetourPoint,
  type RouteKey,
  type RouteAlternativeCandidate,
} from './domain'
import {
  clearRouteErrors,
  normalizeLoopResponseError,
  normalizeRouteResponseError,
  setLoopFailedError,
  setLoopUnexpectedError,
  setRouteMissingPlaceError,
  setRouteUnexpectedError,
} from './actions.errors'
import {
  buildLoopRequestPayload,
  createLoopRequestAction,
  resolveEbikeAssistForMode,
  resolveLoopDistanceKm,
  resolveLoopStartLocation,
} from './actions.loop'
import {
  buildRouteRequestPayload,
  createRouteRequestAction,
  resolveRouteLocations,
} from './actions.route'
import {
  addDetourPointAndRecalculate as addDetourPointAndRecalculateHelper,
  removeDetourPointAndRecalculate as removeDetourPointAndRecalculateHelper,
  toRouteLocation,
} from './routing.helpers'
import { createRoutingControllerFormActions } from './useRoutingController.formActions'
import type { MapContext } from './useRoutingController.types'
import { createNavigationRecalculationActions } from './actions.navigation'

type RoutingControllerActionsStoreSlice = Pick<
  AppStore,
  | 'mode'
  | 'tripType'
  | 'loopStartPlace'
  | 'targetDistanceKm'
  | 'profileSettings'
  | 'onewayStartPlace'
  | 'endPlace'
  | 'routeResult'
  | 'detourPoints'
  | 'isNavigationActive'
  | 'navigationMode'
  | 'navigationProgress'
  | 'navigationRecalculationInFlightRef'
  | 'navigationRecalculationGenerationRef'
  | 'navigationRecalculationRequestIdRef'
  | 'navigationIsActiveRef'
  | 'navigationModeRef'
  | 'navigationRouteResultRef'
  | 'routeAlternativeIndex'
  | 'loopAlternativeIndex'
  | 'pendingAlternativeRoute'
  | 'isRouteLoading'
  | 'isAlternativeLoading'
  | 'setIsRouteLoading'
  | 'setIsAlternativeLoading'
  | 'lastRouteRequestRef'
  | 'setRouteErrorMessage'
  | 'setRouteErrorKey'
  | 'setRouteResult'
  | 'setRouteResultFromNavigationRecalculation'
  | 'setHasResult'
  | 'setIsDirty'
  | 'setDetourPoints'
  | 'setNavigationProgress'
  | 'setNavigationDeviationState'
  | 'setNavigationRecalculationStatus'
  | 'setLoopAlternativeIndex'
  | 'setRouteAlternativeIndex'
  | 'setPendingAlternativeRoute'
  | 'setRouteComparison'
  | 'setIsAlternativeComparisonOpen'
  | 'setMode'
  | 'setTripType'
  | 'setOnewayStartValue'
  | 'setOnewayStartPlace'
  | 'setLoopStartValue'
  | 'setLoopStartPlace'
  | 'setEndValue'
  | 'setEndPlace'
  | 'setTargetDistanceKm'
  | 'setProfileSettings'
>

type CreateRoutingControllerActionsParams = {
  store: RoutingControllerActionsStoreSlice
  isFormReady: boolean
  map: MapContext
  t: TFunction
  onNavigate: (next: RouteKey, force?: boolean) => void
  markDirty: () => void
}

export const createRoutingControllerActions = ({
  store,
  isFormReady,
  map,
  t,
  onNavigate,
  markDirty,
}: CreateRoutingControllerActionsParams) => {
  const {
    mode,
    tripType,
    loopStartPlace,
    targetDistanceKm,
    profileSettings,
    onewayStartPlace,
    endPlace,
    routeResult,
    detourPoints,
    routeAlternativeIndex,
    loopAlternativeIndex,
    pendingAlternativeRoute,
    isRouteLoading,
    isAlternativeLoading,
    setIsRouteLoading,
    setIsAlternativeLoading,
    lastRouteRequestRef,
    setRouteErrorMessage,
    setRouteErrorKey,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    setLoopAlternativeIndex,
    setRouteAlternativeIndex,
    setPendingAlternativeRoute,
    setRouteComparison,
    setIsAlternativeComparisonOpen,
  } = store

  const errorSetters = {
    setRouteErrorMessage,
    setRouteErrorKey,
  }

  const requestRoute = createRouteRequestAction({
    setIsRouteLoading,
    lastRouteRequestRef,
    setRouteErrorMessage,
    setRouteErrorKey,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    onNavigate,
  })

  const requestLoop = createLoopRequestAction({
    setIsRouteLoading,
    lastRouteRequestRef,
    setRouteErrorMessage,
    setRouteErrorKey,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    onNavigate,
  })

  const { getNavigationRecalculationPlan, handleRecalculateFromCurrentPosition } =
    createNavigationRecalculationActions({ store, map, t })

  const handleCalculate = async () => {
    if (!isFormReady || !mode || !tripType) {
      return
    }

    clearRouteErrors(errorSetters)

    if (tripType === 'loop') {
      const loopRequest = buildLoopRequest(
        loopStartPlace,
        targetDistanceKm,
        mode,
        profileSettings.speeds[mode],
        resolveEbikeAssistForMode(mode, profileSettings.ebikeAssist),
        0,
      )

      if (!loopRequest) {
        return
      }

      const success = await requestLoop(loopRequest, [])
      if (success) {
        setLoopAlternativeIndex(0)
      }

      return
    }

    if (!onewayStartPlace || !endPlace) {
      setRouteMissingPlaceError(errorSetters)
      return
    }

    const requestBody = buildRouteRequestPayload({
      from: toRouteLocation(onewayStartPlace),
      to: toRouteLocation(endPlace),
      mode,
      speedKmh: profileSettings.speeds[mode],
      ebikeAssist: profileSettings.ebikeAssist,
      variantIndex: 0,
      detourPoints: [],
    })

    const success = await requestRoute(requestBody, [])
    if (success) {
      setRouteAlternativeIndex(0)
    }
  }

  const recalculateWithDetours = async (nextDetours: DetourPoint[]) => {
    if (!routeResult || !map.mapTripType) {
      return false
    }

    const resolvedMode = mode ?? 'bike'
    clearRouteErrors(errorSetters)

    if (map.mapTripType === 'loop') {
      const startLocation = resolveLoopStartLocation({
        loopStartPlace,
        mapStartCoordinate: map.mapStartCoordinate,
        startLabel: map.startLabel,
        getStartFallbackLabel: () => t('poiStartFallback'),
      })

      if (!startLocation) {
        setLoopFailedError(errorSetters)
        return false
      }

      const requestBody = buildLoopRequestPayload({
        start: startLocation,
        targetDistanceKm: resolveLoopDistanceKm(targetDistanceKm, routeResult.distance_m),
        mode: resolvedMode,
        speedKmh: profileSettings.speeds[resolvedMode],
        ebikeAssist: profileSettings.ebikeAssist,
        variation: loopAlternativeIndex,
        detourPoints: nextDetours,
      })

      return requestLoop(requestBody, nextDetours)
    }

    const { fromLocation, toLocation } = resolveRouteLocations({
      onewayStartPlace,
      endPlace,
      mapStartCoordinate: map.mapStartCoordinate,
      mapEndCoordinate: map.mapEndCoordinate,
      startLabel: map.startLabel,
      endLabel: map.endLabel,
      getStartFallbackLabel: () => t('poiStartFallback'),
      getEndFallbackLabel: () => t('poiEndFallback'),
    })

    if (!fromLocation || !toLocation) {
      setRouteMissingPlaceError(errorSetters)
      return false
    }

    const requestBody = buildRouteRequestPayload({
      from: fromLocation,
      to: toLocation,
      mode: resolvedMode,
      speedKmh: profileSettings.speeds[resolvedMode],
      ebikeAssist: profileSettings.ebikeAssist,
      variantIndex: routeAlternativeIndex,
      detourPoints: nextDetours,
    })

    return requestRoute(requestBody, nextDetours)
  }

  const addDetourPointAndRecalculate = async (point: DetourPoint) => {
    return addDetourPointAndRecalculateHelper({
      detourPoints,
      point,
      recalculateWithDetours,
    })
  }

  const removeDetourPointAndRecalculate = async (detourId: string) => {
    return removeDetourPointAndRecalculateHelper({
      detourPoints,
      detourId,
      recalculateWithDetours,
    })
  }

  const handleRecalculateAlternative = async () => {
    if (!routeResult || isRouteLoading || isAlternativeLoading) {
      return
    }

    const resolvedMode = mode ?? 'bike'
    if (routeResult.kind === 'loop') {
      const nextVariation =
        (pendingAlternativeRoute?.loopAlternativeIndex ?? loopAlternativeIndex) + 1

      clearRouteErrors(errorSetters)
      setPendingAlternativeRoute(null)
      setRouteComparison(null)
      setIsAlternativeComparisonOpen(true)

      const startLocation = resolveLoopStartLocation({
        loopStartPlace,
        mapStartCoordinate: map.mapStartCoordinate,
        startLabel: map.startLabel,
        getStartFallbackLabel: () => t('poiStartFallback'),
      })

      const loopDistance = resolveLoopDistanceKm(targetDistanceKm, routeResult.distance_m)

      if (!startLocation) {
        setLoopFailedError(errorSetters)
        return
      }

      const requestBody = buildLoopRequestPayload({
        start: startLocation,
        targetDistanceKm: loopDistance,
        mode: resolvedMode,
        speedKmh: profileSettings.speeds[resolvedMode],
        ebikeAssist: profileSettings.ebikeAssist,
        variation: nextVariation,
        detourPoints,
      })

      setIsAlternativeLoading(true)
      lastRouteRequestRef.current = {
        type: 'loop',
        payload: requestBody,
      }

      try {
        const result = await fetchLoop(requestBody)
        if (!result.ok) {
          await normalizeLoopResponseError(result.response, errorSetters)
          return
        }

        const candidate: RouteAlternativeCandidate = {
          route: result.result,
          routeAlternativeIndex: null,
          loopAlternativeIndex: nextVariation,
        }
        setPendingAlternativeRoute(candidate)
        setRouteComparison(
          createRouteComparisonSummary(
            routeResult,
            candidate.route,
            resolvedMode,
            profileSettings.ebikeAssist,
          ),
        )
      } catch {
        setLoopUnexpectedError(errorSetters)
      } finally {
        setIsAlternativeLoading(false)
      }
      return
    }

    const nextVariant =
      (pendingAlternativeRoute?.routeAlternativeIndex ?? routeAlternativeIndex) + 1

    clearRouteErrors(errorSetters)
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(true)

    const { fromLocation, toLocation } = resolveRouteLocations({
      onewayStartPlace,
      endPlace,
      mapStartCoordinate: map.mapStartCoordinate,
      mapEndCoordinate: map.mapEndCoordinate,
      startLabel: map.startLabel,
      endLabel: map.endLabel,
      getStartFallbackLabel: () => t('poiStartFallback'),
      getEndFallbackLabel: () => t('poiEndFallback'),
    })

    if (!fromLocation || !toLocation) {
      setRouteMissingPlaceError(errorSetters)
      return
    }

    const requestBody = buildRouteRequestPayload({
      from: fromLocation,
      to: toLocation,
      mode: resolvedMode,
      speedKmh: profileSettings.speeds[resolvedMode],
      ebikeAssist: profileSettings.ebikeAssist,
      variantIndex: nextVariant,
      detourPoints,
    })

    setIsAlternativeLoading(true)
    lastRouteRequestRef.current = {
      type: 'route',
      payload: requestBody,
    }

    try {
      const result = await fetchRoute(requestBody)
      if (!result.ok) {
        await normalizeRouteResponseError(result.response, errorSetters)
        return
      }

      const candidate: RouteAlternativeCandidate = {
        route: result.result,
        routeAlternativeIndex: nextVariant,
        loopAlternativeIndex: null,
      }
      setPendingAlternativeRoute(candidate)
      setRouteComparison(
        createRouteComparisonSummary(
          routeResult,
          candidate.route,
          resolvedMode,
          profileSettings.ebikeAssist,
        ),
      )
    } catch {
      setRouteUnexpectedError(errorSetters)
    } finally {
      setIsAlternativeLoading(false)
    }
  }

  const handleApplyAlternativeRoute = () => {
    if (!pendingAlternativeRoute) {
      return
    }

    setRouteResult(pendingAlternativeRoute.route)
    setHasResult(true)
    setIsDirty(false)
    if (pendingAlternativeRoute.routeAlternativeIndex !== null) {
      setRouteAlternativeIndex(pendingAlternativeRoute.routeAlternativeIndex)
    }
    if (pendingAlternativeRoute.loopAlternativeIndex !== null) {
      setLoopAlternativeIndex(pendingAlternativeRoute.loopAlternativeIndex)
    }
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)
    onNavigate('carte', true)
  }

  const handleKeepCurrentRoute = () => {
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)
  }

  const handleCloseAlternativeComparison = () => {
    setIsAlternativeComparisonOpen(false)
  }

  const {
    handleModeChange,
    handleTypeChange,
    handleOnewayStartValueChange,
    handleOnewayStartPlaceSelect,
    handleLoopStartValueChange,
    handleLoopStartPlaceSelect,
    handleEndValueChange,
    handleEndPlaceSelect,
    handleTargetDistanceChange,
    handleSpeedChange,
  } = createRoutingControllerFormActions({
    store,
    markDirty,
  })

  return {
    requestRoute,
    requestLoop,
    getNavigationRecalculationPlan,
    handleRecalculateFromCurrentPosition,
    handleCalculate,
    recalculateWithDetours,
    addDetourPointAndRecalculate,
    removeDetourPointAndRecalculate,
    handleRecalculateAlternative,
    handleApplyAlternativeRoute,
    handleKeepCurrentRoute,
    handleCloseAlternativeComparison,
    handleModeChange,
    handleTypeChange,
    handleOnewayStartValueChange,
    handleOnewayStartPlaceSelect,
    handleLoopStartValueChange,
    handleLoopStartPlaceSelect,
    handleEndValueChange,
    handleEndPlaceSelect,
    handleTargetDistanceChange,
    handleSpeedChange,
  }
}
