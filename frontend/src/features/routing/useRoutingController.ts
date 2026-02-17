import { useCallback, useEffect } from 'react'
import { fetchValhallaStatus, readApiMessage, startValhallaUpdate, submitDeveloperFeedback, exportRouteAsGpx } from './api'
import {
  buildGpxFileName,
  defaultProfileSettings,
  downloadBlob,
  parseContentDispositionFileName,
  plannerDraftStorageKey,
  routeStorageKey,
} from './domain'
import {
  computeCanSubmitFeedback,
  createPlannerPanelStyles,
  exportRouteAsGpxAction,
  resolveAlternativeRouteLabel,
  resolveRouteErrorDisplayMessage,
  submitDeveloperFeedbackAction,
} from './routing.helpers'
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

  const { panelTransitionDuration, panelTransitionTiming, panelStackStyle, getPanelStyle } =
    createPlannerPanelStyles()

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

  const canSubmitFeedback = computeCanSubmitFeedback(
    feedbackSubject,
    feedbackMessage,
    isFeedbackSubmitting,
  )

  const handleSubmitDeveloperFeedback = async () => {
    await submitDeveloperFeedbackAction({
      canSubmitFeedback,
      feedbackSubject,
      feedbackMessage,
      feedbackContactEmail,
      route,
      t,
      setIsFeedbackSubmitting,
      setFeedbackSubmitMessage,
      setFeedbackSubmitError,
      setFeedbackSubject,
      setFeedbackContactEmail,
      setFeedbackMessage,
      submitDeveloperFeedback,
      readApiMessage,
    })
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
    await exportRouteAsGpxAction({
      routeResult,
      mapHeaderTitle: map.mapHeaderTitle,
      t,
      setIsExporting,
      setExportError,
      exportRouteAsGpx,
      parseContentDispositionFileName,
      buildGpxFileName,
      downloadBlob,
    })
  }

  const routeErrorDisplayMessage = resolveRouteErrorDisplayMessage(
    routeErrorMessage,
    routeErrorKey,
    t,
  )
  const isValhallaBuildRunning = valhallaStatus?.build?.state === 'running'
  const valhallaUpdateAvailable = valhallaStatus?.update?.update_available === true
  const alternativeRouteLabel = resolveAlternativeRouteLabel(routeResult, t)

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
