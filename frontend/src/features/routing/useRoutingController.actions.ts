import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import {
  apiModeByUi,
  buildLoopRequest,
  loopTelemetryEvents,
  routeOptionVariants,
  trackLoopEvent,
  type AssistLevel,
  type DetourPoint,
  type LoopRequestPayload,
  type RouteLocation,
  type RouteRequestPayload,
  type RouteKey,
} from './domain'
import { fetchLoop, fetchRoute, readApiMessage } from './api'
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

  const buildRouteOptionsVariant = (variantIndex: number) =>
    routeOptionVariants[variantIndex % routeOptionVariants.length]
  const resolveEbikeAssistForMode = (nextMode: typeof mode): AssistLevel | undefined =>
    nextMode === 'ebike' ? profileSettings.ebikeAssist : undefined
  const toWaypointPayload = (points: DetourPoint[]) =>
    points.map(({ lat, lon, label }) => ({ lat, lon, label }))

  const requestRoute = async (
    requestBody: RouteRequestPayload,
    nextDetours: DetourPoint[] = [],
  ) => {
    setIsRouteLoading(true)
    lastRouteRequestRef.current = {
      type: 'route',
      payload: requestBody,
    }

    try {
      const result = await fetchRoute(requestBody)
      if (!result.ok) {
        const response = result.response
        if (response.status === 503) {
          const message = await readApiMessage(response)
          if (message) {
            setRouteErrorMessage(message)
            setRouteErrorKey(null)
          } else {
            setRouteErrorMessage(null)
            setRouteErrorKey('routeErrorUnavailable')
          }
          return false
        }

        if (response.status === 504) {
          setRouteErrorMessage(null)
          setRouteErrorKey('routeErrorTimeout')
          return false
        }

        if (response.status === 502) {
          setRouteErrorMessage(null)
          setRouteErrorKey('routeErrorGateway')
          return false
        }

        setRouteErrorMessage(null)
        setRouteErrorKey('routeErrorFailed')
        return false
      }

      setRouteResult(result.result)
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      onNavigate('carte', true)
      return true
    } catch {
      setRouteErrorMessage(null)
      setRouteErrorKey('routeErrorFailed')
      return false
    } finally {
      setIsRouteLoading(false)
    }
  }

  const requestLoop = async (
    requestBody: LoopRequestPayload,
    nextDetours: DetourPoint[] = [],
  ) => {
    setIsRouteLoading(true)
    lastRouteRequestRef.current = {
      type: 'loop',
      payload: requestBody,
    }

    try {
      const result = await fetchLoop(requestBody)
      if (!result.ok) {
        const response = result.response
        if (response.status === 503) {
          const message = await readApiMessage(response)
          if (message) {
            setRouteErrorMessage(message)
            setRouteErrorKey(null)
          } else {
            setRouteErrorMessage(null)
            setRouteErrorKey('routeErrorUnavailable')
          }
          return false
        }

        if (response.status === 504) {
          setRouteErrorMessage(null)
          setRouteErrorKey('routeErrorTimeout')
          return false
        }

        if (response.status === 502) {
          setRouteErrorMessage(null)
          setRouteErrorKey('routeErrorGateway')
          return false
        }

        if (response.status === 422) {
          const message = await readApiMessage(response)
          if (message) {
            setRouteErrorMessage(message)
            setRouteErrorKey(null)
          } else {
            setRouteErrorMessage(null)
            setRouteErrorKey('loopErrorFailed')
          }
          return false
        }

        setRouteErrorMessage(null)
        setRouteErrorKey('loopErrorFailed')
        return false
      }

      setRouteResult(result.result)
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      onNavigate('carte', true)
      return true
    } catch {
      setRouteErrorMessage(null)
      setRouteErrorKey('loopErrorFailed')
      return false
    } finally {
      setIsRouteLoading(false)
    }
  }

  const handleCalculate = async () => {
    if (!isFormReady || !mode || !tripType) {
      return
    }

    setRouteErrorKey(null)
    setRouteErrorMessage(null)

    if (tripType === 'loop') {
      const loopRequest = buildLoopRequest(
        loopStartPlace,
        targetDistanceKm,
        mode,
        profileSettings.speeds[mode],
        resolveEbikeAssistForMode(mode),
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
      setRouteErrorKey('routeErrorMissingPlace')
      return
    }

    const requestBody: RouteRequestPayload = {
      from: {
        lat: onewayStartPlace.lat,
        lon: onewayStartPlace.lon,
        label: onewayStartPlace.label,
      },
      to: {
        lat: endPlace.lat,
        lon: endPlace.lon,
        label: endPlace.label,
      },
      mode: apiModeByUi[mode],
      options: buildRouteOptionsVariant(0),
      speedKmh: profileSettings.speeds[mode],
      ...(mode === 'ebike'
        ? {
            ebikeAssist: profileSettings.ebikeAssist,
          }
        : {}),
    }

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
    setRouteErrorKey(null)
    setRouteErrorMessage(null)

    if (map.mapTripType === 'loop') {
      const startLocation: RouteLocation | null = loopStartPlace
        ? {
            lat: loopStartPlace.lat,
            lon: loopStartPlace.lon,
            label: loopStartPlace.label,
          }
        : map.mapStartCoordinate
          ? {
              lat: map.mapStartCoordinate[1],
              lon: map.mapStartCoordinate[0],
              label: map.startLabel || t('poiStartFallback'),
            }
          : null

      if (!startLocation) {
        setRouteErrorKey('loopErrorFailed')
        return false
      }

      const loopDistance =
        typeof targetDistanceKm === 'number' && targetDistanceKm > 0
          ? targetDistanceKm
          : Math.max(1, Math.round(routeResult.distance_m / 1000))

      const requestBody: LoopRequestPayload = {
        start: startLocation,
        targetDistanceKm: loopDistance,
        mode: apiModeByUi[resolvedMode],
        speedKmh: profileSettings.speeds[resolvedMode],
        ...(resolvedMode === 'ebike'
          ? {
              ebikeAssist: profileSettings.ebikeAssist,
            }
          : {}),
        variation: loopAlternativeIndex,
        ...(nextDetours.length > 0
          ? {
              waypoints: toWaypointPayload(nextDetours),
            }
          : {}),
      }

      return requestLoop(requestBody, nextDetours)
    }

    const fromLocation: RouteLocation | null = onewayStartPlace
      ? {
          lat: onewayStartPlace.lat,
          lon: onewayStartPlace.lon,
          label: onewayStartPlace.label,
        }
      : map.mapStartCoordinate
        ? {
            lat: map.mapStartCoordinate[1],
            lon: map.mapStartCoordinate[0],
            label: map.startLabel || t('poiStartFallback'),
          }
        : null
    const toLocation: RouteLocation | null = endPlace
      ? {
          lat: endPlace.lat,
          lon: endPlace.lon,
          label: endPlace.label,
        }
      : map.mapEndCoordinate
        ? {
            lat: map.mapEndCoordinate[1],
            lon: map.mapEndCoordinate[0],
            label: map.endLabel || t('poiEndFallback'),
          }
        : null

    if (!fromLocation || !toLocation) {
      setRouteErrorKey('routeErrorMissingPlace')
      return false
    }

    const requestBody: RouteRequestPayload = {
      from: fromLocation,
      to: toLocation,
      ...(nextDetours.length > 0
        ? {
            waypoints: toWaypointPayload(nextDetours),
          }
        : {}),
      mode: apiModeByUi[resolvedMode],
      options: buildRouteOptionsVariant(routeAlternativeIndex),
      speedKmh: profileSettings.speeds[resolvedMode],
      ...(resolvedMode === 'ebike'
        ? {
            ebikeAssist: profileSettings.ebikeAssist,
          }
        : {}),
    }

    return requestRoute(requestBody, nextDetours)
  }

  const pointsAreClose = (
    left: { lat: number; lon: number },
    right: { lat: number; lon: number },
  ) => Math.abs(left.lat - right.lat) < 0.00003 && Math.abs(left.lon - right.lon) < 0.00003

  const appendDetourPoint = (point: DetourPoint) => {
    if (detourPoints.some((existing) => existing.id === point.id)) {
      return detourPoints
    }

    if (detourPoints.some((existing) => pointsAreClose(existing, point))) {
      return detourPoints
    }

    return [...detourPoints, point]
  }

  const addDetourPointAndRecalculate = async (point: DetourPoint) => {
    const nextDetours = appendDetourPoint(point)
    if (nextDetours === detourPoints) {
      return {
        status: 'unchanged' as const,
        nextDetours,
      }
    }

    const success = await recalculateWithDetours(nextDetours)
    if (!success) {
      return {
        status: 'failed' as const,
        nextDetours,
      }
    }

    return {
      status: 'success' as const,
      nextDetours,
    }
  }

  const removeDetourPointAndRecalculate = async (detourId: string) => {
    const nextDetours = detourPoints.filter((point) => point.id !== detourId)
    const success = await recalculateWithDetours(nextDetours)
    return {
      success,
      nextDetours,
    }
  }

  const handleRecalculateAlternative = async () => {
    if (!routeResult || isRouteLoading) {
      return
    }

    setRouteErrorKey(null)
    setRouteErrorMessage(null)

    const resolvedMode = mode ?? 'bike'
    if (routeResult.kind === 'loop') {
      const startLocation: RouteLocation | null = loopStartPlace
        ? {
            lat: loopStartPlace.lat,
            lon: loopStartPlace.lon,
            label: loopStartPlace.label,
          }
        : map.mapStartCoordinate
          ? {
              lat: map.mapStartCoordinate[1],
              lon: map.mapStartCoordinate[0],
              label: map.startLabel || t('poiStartFallback'),
            }
          : null

      const loopDistance =
        typeof targetDistanceKm === 'number' && targetDistanceKm > 0
          ? targetDistanceKm
          : Math.max(1, Math.round(routeResult.distance_m / 1000))

      if (!startLocation) {
        setRouteErrorKey('loopErrorFailed')
        return
      }

      const nextVariation = loopAlternativeIndex + 1
      const requestBody: LoopRequestPayload = {
        start: startLocation,
        targetDistanceKm: loopDistance,
        mode: apiModeByUi[resolvedMode],
        speedKmh: profileSettings.speeds[resolvedMode],
        ...(resolvedMode === 'ebike'
          ? {
              ebikeAssist: profileSettings.ebikeAssist,
            }
          : {}),
        variation: nextVariation,
        ...(detourPoints.length > 0
          ? {
              waypoints: toWaypointPayload(detourPoints),
            }
          : {}),
      }

      const success = await requestLoop(requestBody, detourPoints)
      if (success) {
        setLoopAlternativeIndex(nextVariation)
      }
      return
    }

    const fromLocation: RouteLocation | null = onewayStartPlace
      ? {
          lat: onewayStartPlace.lat,
          lon: onewayStartPlace.lon,
          label: onewayStartPlace.label,
        }
      : map.mapStartCoordinate
        ? {
            lat: map.mapStartCoordinate[1],
            lon: map.mapStartCoordinate[0],
            label: map.startLabel || t('poiStartFallback'),
          }
        : null
    const toLocation: RouteLocation | null = endPlace
      ? {
          lat: endPlace.lat,
          lon: endPlace.lon,
          label: endPlace.label,
        }
      : map.mapEndCoordinate
        ? {
            lat: map.mapEndCoordinate[1],
            lon: map.mapEndCoordinate[0],
            label: map.endLabel || t('poiEndFallback'),
          }
        : null

    if (!fromLocation || !toLocation) {
      setRouteErrorKey('routeErrorMissingPlace')
      return
    }

    const nextVariant = routeAlternativeIndex + 1
    const requestBody: RouteRequestPayload = {
      from: fromLocation,
      to: toLocation,
      ...(detourPoints.length > 0
        ? {
            waypoints: toWaypointPayload(detourPoints),
          }
        : {}),
      mode: apiModeByUi[resolvedMode],
      options: buildRouteOptionsVariant(nextVariant),
      speedKmh: profileSettings.speeds[resolvedMode],
      ...(resolvedMode === 'ebike'
        ? {
            ebikeAssist: profileSettings.ebikeAssist,
          }
        : {}),
    }

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
