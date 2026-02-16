import { useEffect, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { useRoutingFeatureSlice } from './useRoutingFeatureSlice'
import {
  apiModeByUi,
  buildLoopRequest,
  buildGpxFileName,
  defaultProfileSettings,
  downloadBlob,
  isMode,
  loopTelemetryEvents,
  parseContentDispositionFileName,
  plannerDraftStorageKey,
  routeOptionVariants,
  routeStorageKey,
  speedRanges,
  trackLoopEvent,
  type AssistLevel,
  type DetourPoint,
  type LoopRequestPayload,
  type PlaceCandidate,
  type RouteLocation,
  type RouteRequestPayload,
  type RouteKey,
  type TripType,
} from './domain'
import {
  exportRouteAsGpx,
  fetchLoop,
  fetchRoute,
  fetchValhallaStatus,
  readApiMessage,
  startValhallaUpdate,
  submitDeveloperFeedback,
} from './api'

type MapContext = {
  mapTripType: TripType | null
  mapStartCoordinate: [number, number] | null
  mapEndCoordinate: [number, number] | null
  startLabel: string
  endLabel: string
  mapHeaderTitle: string
}

type UseRoutingControllerParams = {
  store: AppStore
  route: RouteKey
  t: TFunction
  map: MapContext
  onNavigate: (next: RouteKey, force?: boolean) => void
}

export const useRoutingController = ({
  store,
  route,
  t,
  map,
  onNavigate,
}: UseRoutingControllerParams) => {
  const {
    mode,
    tripType,
    onewayStartValue,
    onewayStartPlace,
    loopStartValue,
    loopStartPlace,
    endValue,
    endPlace,
    targetDistanceKm,
    hasResult,
    isDirty,
    routeResult,
    detourPoints,
    routeAlternativeIndex,
    loopAlternativeIndex,
    profileSettings,
    routeErrorKey,
    routeErrorMessage,
    isRouteLoading,
    feedbackSubject,
    feedbackMessage,
    isFeedbackSubmitting,
    feedbackContactEmail,
    valhallaStatus,
    isValhallaStatusLoading,
    valhallaAutoUpdateRequestedRef,
    setMode,
    setTripType,
    setOnewayStartValue,
    setOnewayStartPlace,
    setLoopStartValue,
    setLoopStartPlace,
    setEndValue,
    setEndPlace,
    setTargetDistanceKm,
    setHasResult,
    setIsDirty,
    setRouteResult,
    setDetourPoints,
    setRouteAlternativeIndex,
    setLoopAlternativeIndex,
    setRouteErrorKey,
    setRouteErrorMessage,
    setIsRouteLoading,
    setIsExporting,
    setExportError,
    setFeedbackSubject,
    setFeedbackMessage,
    setFeedbackContactEmail,
    setIsFeedbackSubmitting,
    setFeedbackSubmitMessage,
    setFeedbackSubmitError,
    setValhallaStatus,
    setIsValhallaStatusLoading,
    setValhallaStatusError,
    setProfileSettings,
    lastRouteRequestRef,
  } = store

  const activeStartPlace = tripType === 'loop' ? loopStartPlace : onewayStartPlace
  const hasStartSelection = Boolean(activeStartPlace)
  const hasEndSelection = tripType === 'oneway' ? Boolean(endPlace) : true
  const showLocationInputs = Boolean(mode && tripType)
  const {
    helperItems,
    helperHasMissing,
    helperReadyLabel,
    ctaLabel,
    isFormReady,
  } = useRoutingFeatureSlice({
    mode,
    tripType,
    hasStartSelection,
    hasEndSelection,
    targetDistanceKm,
    hasResult,
    isDirty,
    t,
  })

  const panelTransitionDuration = 220
  const panelTransitionTiming = 'ease-in-out'
  const panelStackStyle: CSSProperties = {
    position: 'relative',
  }
  const panelBaseStyle: CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: `${panelTransitionDuration}ms`,
    transitionTimingFunction: panelTransitionTiming,
  }
  const getPanelStyle = (isActive: boolean): CSSProperties => ({
    ...panelBaseStyle,
    position: isActive ? 'relative' : 'absolute',
    inset: isActive ? undefined : 0,
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'translateY(0)' : 'translateY(-6px)',
    pointerEvents: isActive ? 'auto' : 'none',
    visibility: isActive ? 'visible' : 'hidden',
  })

  const markDirty = () => {
    if (hasResult) {
      setIsDirty(true)
    }
  }

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

  const handleModeChange = (value: string) => {
    if (!isMode(value)) {
      return
    }

    setMode(value)
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    markDirty()
  }
  const handleTypeChange = (value: string) => {
    setTripType(value as TripType)
    setEndValue('')
    setEndPlace(null)
    setTargetDistanceKm('')
    setDetourPoints([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    markDirty()
  }
  const handleOnewayStartValueChange = (value: string) => {
    setOnewayStartValue(value)
    markDirty()
  }
  const handleOnewayStartPlaceSelect = (place: PlaceCandidate | null) => {
    setOnewayStartPlace(place)
    markDirty()
  }
  const handleLoopStartValueChange = (value: string) => {
    setLoopStartValue(value)
    markDirty()
  }
  const handleLoopStartPlaceSelect = (place: PlaceCandidate | null) => {
    setLoopStartPlace(place)
    markDirty()
  }
  const handleEndValueChange = (value: string) => {
    setEndValue(value)
    markDirty()
  }
  const handleEndPlaceSelect = (place: PlaceCandidate | null) => {
    setEndPlace(place)
    markDirty()
  }
  const handleTargetDistanceChange = (value: number | string) => {
    setTargetDistanceKm(typeof value === 'number' ? value : '')
    markDirty()
  }
  const handleSpeedChange = (
    targetMode: 'walk' | 'bike' | 'ebike',
    value: number | '',
  ) => {
    if (typeof value !== 'number') {
      return
    }

    const range = speedRanges[targetMode]
    setProfileSettings((current) => ({
      ...current,
      speeds: {
        ...current.speeds,
        [targetMode]: Math.max(range.min, Math.min(range.max, value)),
      },
    }))
  }
  const handleResetProfiles = () => {
    setProfileSettings(defaultProfileSettings)
  }

  const loadValhallaStatus = async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true
    if (!quiet) {
      setIsValhallaStatusLoading(true)
      setValhallaStatusError(false)
    }

    try {
      const result = await fetchValhallaStatus()
      if (!result.ok) {
        if (!quiet) {
          setValhallaStatusError(true)
        }
        return
      }

      setValhallaStatus(result.data)
      if (!quiet) {
        setValhallaStatusError(false)
      }
    } catch {
      if (!quiet) {
        setValhallaStatusError(true)
      }
    } finally {
      if (!quiet) {
        setIsValhallaStatusLoading(false)
      }
    }
  }

  const canSubmitFeedback =
    feedbackSubject.trim().length >= 6 &&
    feedbackMessage.trim().length >= 20 &&
    !isFeedbackSubmitting

  const handleSubmitDeveloperFeedback = async () => {
    if (!canSubmitFeedback) {
      return
    }

    setIsFeedbackSubmitting(true)
    setFeedbackSubmitMessage(null)
    setFeedbackSubmitError(null)

    try {
      const response = await submitDeveloperFeedback({
        subject: feedbackSubject,
        message: feedbackMessage,
        contactEmail: feedbackContactEmail,
        page: route,
      })

      if (!response.ok) {
        const message = await readApiMessage(response)
        setFeedbackSubmitError(message ?? t('helpFeedbackSubmitError'))
        return
      }

      setFeedbackSubject('')
      setFeedbackContactEmail('')
      setFeedbackMessage('')
      setFeedbackSubmitMessage(t('helpFeedbackSubmitSuccess'))
    } catch {
      setFeedbackSubmitError(t('helpFeedbackSubmitError'))
    } finally {
      setIsFeedbackSubmitting(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (routeResult) {
      localStorage.setItem(routeStorageKey, JSON.stringify(routeResult))
      return
    }

    localStorage.removeItem(routeStorageKey)
  }, [routeResult])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const hasDraftContent =
      mode !== null ||
      tripType !== null ||
      onewayStartValue.trim().length > 0 ||
      loopStartValue.trim().length > 0 ||
      endValue.trim().length > 0 ||
      typeof targetDistanceKm === 'number'

    if (!hasDraftContent) {
      localStorage.removeItem(plannerDraftStorageKey)
      return
    }

    localStorage.setItem(
      plannerDraftStorageKey,
      JSON.stringify({
        mode,
        tripType,
        onewayStartValue,
        onewayStartPlace,
        loopStartValue,
        loopStartPlace,
        endValue,
        endPlace,
        targetDistanceKm,
      }),
    )
  }, [
    endPlace,
    endValue,
    loopStartPlace,
    loopStartValue,
    mode,
    onewayStartPlace,
    onewayStartValue,
    targetDistanceKm,
    tripType,
  ])

  useEffect(() => {
    setExportError(null)
    setIsExporting(false)
  }, [routeResult, setExportError, setIsExporting])

  useEffect(() => {
    if (route !== 'aide') {
      return
    }

    if (valhallaStatus || isValhallaStatusLoading) {
      return
    }

    void loadValhallaStatus()
  }, [isValhallaStatusLoading, route, valhallaStatus])

  useEffect(() => {
    if (route !== 'aide') {
      return
    }

    if (valhallaStatus?.build?.state !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadValhallaStatus({ quiet: true })
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [route, valhallaStatus?.build?.state])

  useEffect(() => {
    if (route !== 'aide') {
      return
    }

    if (!valhallaStatus) {
      return
    }

    const updateAvailable = valhallaStatus.update?.update_available === true
    const buildRunning = valhallaStatus.build?.state === 'running'

    if (!updateAvailable) {
      valhallaAutoUpdateRequestedRef.current = false
      return
    }

    if (buildRunning || valhallaAutoUpdateRequestedRef.current) {
      return
    }

    valhallaAutoUpdateRequestedRef.current = true
    const triggerAutomaticValhallaUpdate = async () => {
      try {
        await startValhallaUpdate()
      } catch {
        valhallaAutoUpdateRequestedRef.current = false
      } finally {
        await loadValhallaStatus({ quiet: true })
      }
    }

    void triggerAutomaticValhallaUpdate()
  }, [route, valhallaStatus, valhallaAutoUpdateRequestedRef])

  const handleExportGpx = async () => {
    if (!routeResult || routeResult.geometry.coordinates.length < 2) {
      setExportError(t('exportGpxFailed'))
      return
    }

    setIsExporting(true)
    setExportError(null)

    try {
      const response = await exportRouteAsGpx({
        geometry: routeResult.geometry,
        elevation_profile:
          routeResult.elevation_profile.length > 1
            ? routeResult.elevation_profile
            : null,
        name: map.mapHeaderTitle || t('exportGpxDefaultName'),
      })

      if (!response.ok) {
        setExportError(t('exportGpxFailed'))
        return
      }

      const blob = await response.blob()
      const headerFileName = parseContentDispositionFileName(
        response.headers.get('content-disposition'),
      )
      const fallbackName = buildGpxFileName(map.mapHeaderTitle || t('exportGpxDefaultName'))
      downloadBlob(blob, headerFileName ?? fallbackName)
    } catch {
      setExportError(t('exportGpxFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  const routeErrorDisplayMessage =
    routeErrorMessage ?? (routeErrorKey ? t(routeErrorKey) : null)
  const isValhallaBuildRunning = valhallaStatus?.build?.state === 'running'
  const valhallaUpdateAvailable = valhallaStatus?.update?.update_available === true
  const alternativeRouteLabel =
    routeResult?.kind === 'loop' ? t('mapRegenerateLoopVariant') : t('mapRecalculateRouteVariant')

  return {
    showLocationInputs,
    helperItems,
    helperHasMissing,
    helperReadyLabel,
    ctaLabel,
    isFormReady,
    panelTransitionDuration,
    panelTransitionTiming,
    panelStackStyle,
    getPanelStyle,
    handleModeChange,
    handleTypeChange,
    handleOnewayStartValueChange,
    handleOnewayStartPlaceSelect,
    handleLoopStartValueChange,
    handleLoopStartPlaceSelect,
    handleEndValueChange,
    handleEndPlaceSelect,
    handleTargetDistanceChange,
    handleCalculate,
    requestRoute,
    requestLoop,
    addDetourPointAndRecalculate,
    removeDetourPointAndRecalculate,
    recalculateWithDetours,
    handleRecalculateAlternative,
    handleSpeedChange,
    handleResetProfiles,
    routeErrorDisplayMessage,
    handleExportGpx,
    handleSubmitDeveloperFeedback,
    canSubmitFeedback,
    loadValhallaStatus,
    isValhallaBuildRunning,
    valhallaUpdateAvailable,
    alternativeRouteLabel,
  }
}
