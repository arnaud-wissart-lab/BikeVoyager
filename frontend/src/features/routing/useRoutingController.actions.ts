import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import {
  buildLoopRequest,
  loopTelemetryEvents,
  type DetourPoint,
  type RouteKey,
  trackLoopEvent,
} from './domain'
import {
  clearRouteErrors,
  setLoopFailedError,
  setRouteMissingPlaceError,
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
  | 'routeAlternativeIndex'
  | 'loopAlternativeIndex'
  | 'isRouteLoading'
  | 'setIsRouteLoading'
  | 'lastRouteRequestRef'
  | 'setRouteErrorMessage'
  | 'setRouteErrorKey'
  | 'setRouteResult'
  | 'setHasResult'
  | 'setIsDirty'
  | 'setDetourPoints'
  | 'setLoopAlternativeIndex'
  | 'setRouteAlternativeIndex'
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
    isRouteLoading,
    setIsRouteLoading,
    lastRouteRequestRef,
    setRouteErrorMessage,
    setRouteErrorKey,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    setLoopAlternativeIndex,
    setRouteAlternativeIndex,
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
        trackLoopEvent(loopTelemetryEvents.failed, { reason: 'invalid_form' })
        return
      }

      trackLoopEvent(loopTelemetryEvents.requested, {
        targetDistanceKm: loopRequest.targetDistanceKm,
      })

      const success = await requestLoop(loopRequest, [])
      if (success) {
        setLoopAlternativeIndex(0)
        trackLoopEvent(loopTelemetryEvents.succeeded, {
          targetDistanceKm: loopRequest.targetDistanceKm,
        })
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
        targetDistanceKm: resolveLoopDistanceKm(
          targetDistanceKm,
          routeResult.distance_m,
        ),
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
    if (!routeResult || isRouteLoading) {
      return
    }

    clearRouteErrors(errorSetters)

    const resolvedMode = mode ?? 'bike'
    if (routeResult.kind === 'loop') {
      const startLocation = resolveLoopStartLocation({
        loopStartPlace,
        mapStartCoordinate: map.mapStartCoordinate,
        startLabel: map.startLabel,
        getStartFallbackLabel: () => t('poiStartFallback'),
      })

      const loopDistance = resolveLoopDistanceKm(
        targetDistanceKm,
        routeResult.distance_m,
      )

      if (!startLocation) {
        setLoopFailedError(errorSetters)
        return
      }

      const nextVariation = loopAlternativeIndex + 1
      const requestBody = buildLoopRequestPayload({
        start: startLocation,
        targetDistanceKm: loopDistance,
        mode: resolvedMode,
        speedKmh: profileSettings.speeds[resolvedMode],
        ebikeAssist: profileSettings.ebikeAssist,
        variation: nextVariation,
        detourPoints,
      })

      const success = await requestLoop(requestBody, detourPoints)
      if (success) {
        setLoopAlternativeIndex(nextVariation)
      }
      return
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
      return
    }

    const nextVariant = routeAlternativeIndex + 1
    const requestBody = buildRouteRequestPayload({
      from: fromLocation,
      to: toLocation,
      mode: resolvedMode,
      speedKmh: profileSettings.speeds[resolvedMode],
      ebikeAssist: profileSettings.ebikeAssist,
      variantIndex: nextVariant,
      detourPoints,
    })

    const success = await requestRoute(requestBody, detourPoints)
    if (success) {
      setRouteAlternativeIndex(nextVariant)
    }
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
    handleCalculate,
    recalculateWithDetours,
    addDetourPointAndRecalculate,
    removeDetourPointAndRecalculate,
    handleRecalculateAlternative,
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
