import { useCallback, useEffect, type CSSProperties } from 'react'
import { fetchValhallaStatus, readApiMessage, startValhallaUpdate, submitDeveloperFeedback, exportRouteAsGpx } from './api'
import {
  buildGpxFileName,
  defaultProfileSettings,
  downloadBlob,
  parseContentDispositionFileName,
  plannerDraftStorageKey,
  routeStorageKey,
} from './domain'
import { createRoutingControllerActions } from './useRoutingController.actions'
import { useRoutingFeatureSlice } from './useRoutingFeatureSlice'
import type { UseRoutingControllerParams } from './useRoutingController.types'

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
    routeErrorKey,
    routeErrorMessage,
    feedbackSubject,
    feedbackMessage,
    isFeedbackSubmitting,
    feedbackContactEmail,
    valhallaStatus,
    isValhallaStatusLoading,
    valhallaAutoUpdateRequestedRef,
    setIsDirty,
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

  const {
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
  } = createRoutingControllerActions({
    store,
    isFormReady,
    map,
    t,
    onNavigate,
    markDirty,
  })

  const handleResetProfiles = () => {
    setProfileSettings(defaultProfileSettings)
  }

  const loadValhallaStatus = useCallback(
    async (options?: { quiet?: boolean }) => {
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
    },
    [setIsValhallaStatusLoading, setValhallaStatus, setValhallaStatusError],
  )

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
  }, [isValhallaStatusLoading, loadValhallaStatus, route, valhallaStatus])

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
  }, [loadValhallaStatus, route, valhallaStatus?.build?.state])

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
  }, [loadValhallaStatus, route, valhallaStatus, valhallaAutoUpdateRequestedRef])

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
