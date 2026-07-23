import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { fetchLoop, fetchRoute } from './api'
import {
  areRoutesNearDuplicate,
  assessRouteAlternative,
  buildLoopRequest,
  createRouteComparisonSummary,
  loopAlternativeAttemptLimit,
  maximumAlternativeCount,
  routeOptionVariants,
  type DetourPoint,
  type LoopRequestPayload,
  type RouteKey,
  type RouteAlternativeOption,
  type RouteAlternativeAssessment,
  type RouteRequestPayload,
  type TripResult,
} from './domain'
import { collectRelevantAlternatives } from './actions.alternative'
import { clearRouteErrors, setLoopFailedError, setRouteMissingPlaceError } from './actions.errors'
import {
  buildLoopRequestPayload,
  createLoopRequestAction,
  resolveEbikeAssistForMode,
  resolveLoopDistanceKm,
  resolveLoopStartLocation,
} from './actions.loop'
import {
  buildRouteOptionsVariant,
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
  | 'routeAlternatives'
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
  | 'setRouteAlternatives'
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
  alternativeCatalogGenerationRef: { current: number }
}

export const createRoutingControllerActions = ({
  store,
  isFormReady,
  map,
  t,
  onNavigate,
  markDirty,
  alternativeCatalogGenerationRef,
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
    routeAlternatives,
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
    setRouteAlternatives,
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
    onResultApplied: () => undefined,
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
    onResultApplied: () => undefined,
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

  const buildAlternativeOptions = (
    currentRoute: TripResult,
    alternatives: {
      nextIndex: number
      candidate: TripResult
      assessment: RouteAlternativeAssessment
    }[],
    kind: TripResult['kind'],
  ): RouteAlternativeOption[] =>
    alternatives.flatMap((alternative) => {
      const comparison = createRouteComparisonSummary(
        currentRoute,
        alternative.candidate,
        mode ?? 'bike',
        profileSettings.ebikeAssist,
      )
      if (!comparison) {
        return []
      }

      return [
        {
          id: `${kind}:${alternative.nextIndex}`,
          candidate: {
            route: alternative.candidate,
            routeAlternativeIndex: kind === 'route' ? alternative.nextIndex : null,
            loopAlternativeIndex: kind === 'loop' ? alternative.nextIndex : null,
          },
          comparison,
          assessment: alternative.assessment,
        },
      ]
    })

  const resolveStoredRouteRequest = (
    currentRoute: TripResult,
    resolvedMode: NonNullable<typeof mode>,
  ): RouteRequestPayload => {
    if (lastRouteRequestRef.current?.type === 'route') {
      return lastRouteRequestRef.current.payload
    }

    const [startLongitude, startLatitude] = currentRoute.geometry.coordinates[0]
    const [endLongitude, endLatitude] =
      currentRoute.geometry.coordinates[currentRoute.geometry.coordinates.length - 1]
    return buildRouteRequestPayload({
      from: {
        lat: startLatitude,
        lon: startLongitude,
        label: map.startLabel || t('poiStartFallback'),
      },
      to: {
        lat: endLatitude,
        lon: endLongitude,
        label: map.endLabel || t('poiEndFallback'),
      },
      mode: resolvedMode,
      speedKmh: profileSettings.speeds[resolvedMode],
      ebikeAssist: profileSettings.ebikeAssist,
      variantIndex: routeAlternativeIndex,
      detourPoints,
    })
  }

  const resolveStoredLoopRequest = (
    currentRoute: TripResult,
    resolvedMode: NonNullable<typeof mode>,
  ): LoopRequestPayload => {
    if (lastRouteRequestRef.current?.type === 'loop') {
      return lastRouteRequestRef.current.payload
    }

    const [startLongitude, startLatitude] = currentRoute.geometry.coordinates[0]
    return buildLoopRequestPayload({
      start: {
        lat: startLatitude,
        lon: startLongitude,
        label: map.startLabel || t('poiStartFallback'),
      },
      targetDistanceKm: resolveLoopDistanceKm(targetDistanceKm, currentRoute.distance_m),
      mode: resolvedMode,
      speedKmh: profileSettings.speeds[resolvedMode],
      ebikeAssist: profileSettings.ebikeAssist,
      variation: loopAlternativeIndex,
      detourPoints,
    })
  }

  const handlePreloadAlternativeCatalog = async (currentRoute: TripResult | null) => {
    const generation = alternativeCatalogGenerationRef.current + 1
    alternativeCatalogGenerationRef.current = generation
    setRouteAlternatives([])
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)

    if (!currentRoute || !mode || currentRoute.geometry.coordinates.length < 2) {
      setIsAlternativeLoading(false)
      return
    }

    const resolvedMode = mode
    const assess = (candidate: TripResult) =>
      assessRouteAlternative(currentRoute, candidate, resolvedMode, profileSettings.ebikeAssist)
    setIsAlternativeLoading(true)

    try {
      const alternatives =
        currentRoute.kind === 'loop'
          ? await collectRelevantAlternatives({
              candidateIndexes: Array.from(
                { length: loopAlternativeAttemptLimit },
                (_, index) => loopAlternativeIndex + index + 1,
              ),
              maximumCount: maximumAlternativeCount,
              assess,
              isRelevant: (assessment) => assessment.isRelevant,
              isDuplicate: areRoutesNearDuplicate,
              load: async (variation) => {
                try {
                  const baseRequest = resolveStoredLoopRequest(currentRoute, resolvedMode)
                  const result = await fetchLoop({
                    ...baseRequest,
                    variation,
                  })
                  return result.ok
                    ? { ok: true as const, candidate: result.result }
                    : { ok: false as const }
                } catch {
                  return { ok: false as const }
                }
              },
            })
          : await collectRelevantAlternatives({
              candidateIndexes: Array.from(
                { length: Math.max(0, routeOptionVariants.length - 1) },
                (_, index) => routeAlternativeIndex + index + 1,
              ),
              maximumCount: maximumAlternativeCount,
              assess,
              isRelevant: (assessment) => assessment.isRelevant,
              isDuplicate: areRoutesNearDuplicate,
              load: async (variantIndex) => {
                try {
                  const baseRequest = resolveStoredRouteRequest(currentRoute, resolvedMode)
                  const result = await fetchRoute({
                    ...baseRequest,
                    options: buildRouteOptionsVariant(variantIndex),
                  })
                  return result.ok
                    ? { ok: true as const, candidate: result.result }
                    : { ok: false as const }
                } catch {
                  return { ok: false as const }
                }
              },
            })

      if (alternativeCatalogGenerationRef.current !== generation) {
        return
      }

      const options = buildAlternativeOptions(currentRoute, alternatives, currentRoute.kind)
      const firstOption = options[0] ?? null
      setRouteAlternatives(options)
      setPendingAlternativeRoute(firstOption?.candidate ?? null)
      setRouteComparison(firstOption?.comparison ?? null)
    } catch {
      if (alternativeCatalogGenerationRef.current === generation) {
        setRouteAlternatives([])
        setPendingAlternativeRoute(null)
        setRouteComparison(null)
      }
    } finally {
      if (alternativeCatalogGenerationRef.current === generation) {
        setIsAlternativeLoading(false)
      }
    }
  }

  const handleOpenAlternativeComparison = () => {
    if (routeAlternatives.length === 0 || !pendingAlternativeRoute) {
      return
    }

    setIsAlternativeComparisonOpen(true)
  }

  const handleSelectAlternativeRoute = (alternativeId: string) => {
    const option = routeAlternatives.find((alternative) => alternative.id === alternativeId)
    if (!option) {
      return
    }

    setPendingAlternativeRoute(option.candidate)
    setRouteComparison(option.comparison)
  }

  const handleApplyAlternativeRoute = (alternativeId?: string) => {
    const selectedAlternative =
      routeAlternatives.find((alternative) => alternative.id === alternativeId)?.candidate ??
      pendingAlternativeRoute
    if (!selectedAlternative) {
      return
    }

    setRouteResult(selectedAlternative.route)
    setHasResult(true)
    setIsDirty(false)
    if (selectedAlternative.routeAlternativeIndex !== null) {
      setRouteAlternativeIndex(selectedAlternative.routeAlternativeIndex)
    }
    if (selectedAlternative.loopAlternativeIndex !== null) {
      setLoopAlternativeIndex(selectedAlternative.loopAlternativeIndex)
    }
    setIsAlternativeComparisonOpen(false)
    onNavigate('carte', true)
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
    handlePreloadAlternativeCatalog,
    handleOpenAlternativeComparison,
    handleSelectAlternativeRoute,
    handleApplyAlternativeRoute,
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
