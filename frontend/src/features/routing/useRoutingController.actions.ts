import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { fetchLoop, fetchRoute } from './api'
import {
  areRoutesEquivalentForComparison,
  buildLoopRequest,
  createRouteComparisonSummary,
  loopAlternativeAttemptLimit,
  routeOptionVariants,
  type DetourPoint,
  type RouteKey,
  type RouteAlternativeCandidate,
  type TripResult,
} from './domain'
import { requestDistinctAlternative } from './actions.alternative'
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
  isAlternativeUnavailable: boolean
  setIsAlternativeUnavailable: (value: boolean) => void
  alternativeRouteHistoryRef: { current: TripResult[] }
}

export const createRoutingControllerActions = ({
  store,
  isFormReady,
  map,
  t,
  onNavigate,
  markDirty,
  isAlternativeUnavailable,
  setIsAlternativeUnavailable,
  alternativeRouteHistoryRef,
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

  const clearAlternativeHistory = () => {
    alternativeRouteHistoryRef.current = []
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
    onResultApplied: () => {
      clearAlternativeHistory()
      setIsAlternativeUnavailable(false)
    },
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
    onResultApplied: () => {
      clearAlternativeHistory()
      setIsAlternativeUnavailable(false)
    },
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
    if (!routeResult || isRouteLoading || isAlternativeLoading || isAlternativeUnavailable) {
      return
    }

    const resolvedMode = mode ?? 'bike'
    const excludedCandidates = [routeResult, ...alternativeRouteHistoryRef.current]
    const areEquivalent = (excluded: TripResult, candidate: TripResult) =>
      areRoutesEquivalentForComparison(
        excluded,
        candidate,
        resolvedMode,
        profileSettings.ebikeAssist,
      )

    if (routeResult.kind === 'loop') {
      const currentAlternativeIndex =
        pendingAlternativeRoute?.loopAlternativeIndex ?? loopAlternativeIndex

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

      setIsAlternativeLoading(true)
      try {
        const alternative = await requestDistinctAlternative({
          excludedCandidates,
          currentIndex: currentAlternativeIndex,
          attemptCount: loopAlternativeAttemptLimit,
          areEquivalent,
          load: async (variation) => {
            const requestBody = buildLoopRequestPayload({
              start: startLocation,
              targetDistanceKm: loopDistance,
              mode: resolvedMode,
              speedKmh: profileSettings.speeds[resolvedMode],
              ebikeAssist: profileSettings.ebikeAssist,
              variation,
              detourPoints,
            })
            lastRouteRequestRef.current = {
              type: 'loop',
              payload: requestBody,
            }

            const result = await fetchLoop(requestBody)
            return result.ok
              ? { ok: true as const, candidate: result.result }
              : { ok: false as const, failure: result.response }
          },
        })

        if (alternative.status === 'failed') {
          await normalizeLoopResponseError(alternative.failure, errorSetters)
          return
        }

        if (alternative.status === 'unavailable') {
          setIsAlternativeUnavailable(true)
          setIsAlternativeComparisonOpen(false)
          return
        }

        const candidate: RouteAlternativeCandidate = {
          route: alternative.candidate,
          routeAlternativeIndex: null,
          loopAlternativeIndex: alternative.nextIndex,
        }
        alternativeRouteHistoryRef.current = [
          ...alternativeRouteHistoryRef.current,
          alternative.candidate,
        ]
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

    const currentAlternativeIndex =
      pendingAlternativeRoute?.routeAlternativeIndex ?? routeAlternativeIndex

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

    setIsAlternativeLoading(true)
    try {
      const alternative = await requestDistinctAlternative({
        excludedCandidates,
        currentIndex: currentAlternativeIndex,
        attemptCount: routeOptionVariants.length,
        areEquivalent,
        load: async (variantIndex) => {
          const requestBody = buildRouteRequestPayload({
            from: fromLocation,
            to: toLocation,
            mode: resolvedMode,
            speedKmh: profileSettings.speeds[resolvedMode],
            ebikeAssist: profileSettings.ebikeAssist,
            variantIndex,
            detourPoints,
          })
          lastRouteRequestRef.current = {
            type: 'route',
            payload: requestBody,
          }

          const result = await fetchRoute(requestBody)
          return result.ok
            ? { ok: true as const, candidate: result.result }
            : { ok: false as const, failure: result.response }
        },
      })

      if (alternative.status === 'failed') {
        await normalizeRouteResponseError(alternative.failure, errorSetters)
        return
      }

      if (alternative.status === 'unavailable') {
        setIsAlternativeUnavailable(true)
        setIsAlternativeComparisonOpen(false)
        return
      }

      const candidate: RouteAlternativeCandidate = {
        route: alternative.candidate,
        routeAlternativeIndex: alternative.nextIndex,
        loopAlternativeIndex: null,
      }
      alternativeRouteHistoryRef.current = [
        ...alternativeRouteHistoryRef.current,
        alternative.candidate,
      ]
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
    clearAlternativeHistory()
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)
    onNavigate('carte', true)
  }

  const handleKeepCurrentRoute = () => {
    clearAlternativeHistory()
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
