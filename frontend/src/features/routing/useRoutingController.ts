import { useCallback, useEffect, useState } from 'react'
import {
  fetchApiHealth,
  fetchValhallaStatus,
  readApiMessage,
  startValhallaUpdate,
  submitDeveloperFeedback,
  exportRouteAsGpx,
} from './api'
import {
  type ApiHealthStatus,
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
  resolveAlternativeUnavailableLabel,
  resolveRouteErrorDisplayMessage,
  submitDeveloperFeedbackAction,
} from './routing.helpers'
import { createRoutingControllerActions } from './useRoutingController.actions'
import { useRoutingFeatureSlice } from './useRoutingFeatureSlice'
import type { UseRoutingControllerParams } from './useRoutingController.types'
import { useNavigationDeviationPresentation } from './useNavigationDeviationPresentation'
import { useNavigationAutoRecalculation } from '../map/useNavigationAutoRecalculation'

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
    navigationDeviationState,
    navigationRecalculationStatus,
    automaticNavigationRecalculationEnabled,
    isNavigationActive,
    navigationMode,
    navigationSessionKey,
    setNavigationRecalculationStatus,
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
    setPendingAlternativeRoute,
    setRouteComparison,
    setIsAlternativeComparisonOpen,
  } = store
  const [apiHealthStatus, setApiHealthStatus] = useState<ApiHealthStatus | null>(null)
  const [isAlternativeUnavailable, setIsAlternativeUnavailable] = useState(false)

  const activeStartPlace = tripType === 'loop' ? loopStartPlace : onewayStartPlace
  const hasStartSelection = Boolean(activeStartPlace)
  const hasEndSelection = tripType === 'oneway' ? Boolean(endPlace) : true
  const showLocationInputs = Boolean(mode && tripType)
  const { helperItems, helperHasMissing, helperReadyLabel, ctaLabel, isFormReady } =
    useRoutingFeatureSlice({
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
    getNavigationRecalculationPlan,
    handleRecalculateFromCurrentPosition: handleManualRecalculateFromCurrentPosition,
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
  } = createRoutingControllerActions({
    store,
    isFormReady,
    map,
    t,
    onNavigate,
    markDirty,
    isAlternativeUnavailable,
    setIsAlternativeUnavailable,
  })

  const navigationAutoRecalculation = useNavigationAutoRecalculation({
    enabled: automaticNavigationRecalculationEnabled,
    isNavigationActive,
    navigationMode,
    deviationState: navigationDeviationState,
    recalculationStatus: navigationRecalculationStatus,
    routeSessionKey: isNavigationActive && routeResult ? navigationSessionKey : null,
    getRecalculationPlan: getNavigationRecalculationPlan,
    onRecalculate: handleManualRecalculateFromCurrentPosition,
  })

  const {
    navigationOffRouteAlert: baseNavigationOffRouteAlert,
    navigationRecalculationSuccessMessage,
  } = useNavigationDeviationPresentation({
    deviationState: navigationDeviationState,
    recalculationStatus: navigationRecalculationStatus,
    getRecalculationPlan: getNavigationRecalculationPlan,
    setRecalculationStatus: setNavigationRecalculationStatus,
    t,
  })
  const navigationOffRouteAlert = baseNavigationOffRouteAlert
    ? {
        ...baseNavigationOffRouteAlert,
        autoRecalculationStatus: navigationAutoRecalculation.status,
        autoRecalculationRemainingSeconds: navigationAutoRecalculation.remainingSeconds,
      }
    : null
  const navigationAutoRecalculationCancellationMessage =
    navigationAutoRecalculation.status === 'cancelled' &&
    navigationDeviationState.status === 'dismissed'
      ? t('navigationAutoRecalculationCancelled')
      : null

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

  const loadApiHealthStatus = useCallback(async () => {
    try {
      const result = await fetchApiHealth()
      if (!result.ok) {
        return
      }

      setApiHealthStatus(result.data)
    } catch {
      // Ignore les erreurs réseau ponctuelles: le front se basera sur la dernière valeur connue.
    }
  }, [])

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
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)
  }, [routeResult, setIsAlternativeComparisonOpen, setPendingAlternativeRoute, setRouteComparison])

  useEffect(() => {
    if (route !== 'planifier' && route !== 'carte' && route !== 'aide') {
      return
    }

    void loadApiHealthStatus()
  }, [loadApiHealthStatus, route])

  useEffect(() => {
    if (route !== 'planifier' && route !== 'carte' && route !== 'aide') {
      return
    }

    if (apiHealthStatus?.valhalla?.status !== 'BUILDING') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadApiHealthStatus()
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [apiHealthStatus?.valhalla?.status, loadApiHealthStatus, route])

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
    apiHealthStatus?.valhalla?.status === 'BUILDING'
      ? t('routeErrorValhallaBuilding')
      : apiHealthStatus?.valhalla?.status === 'DOWN'
        ? t('routeErrorValhallaDown')
        : null,
  )
  const isValhallaBuildRunning = valhallaStatus?.build?.state === 'running'
  const valhallaUpdateAvailable = valhallaStatus?.update?.update_available === true
  const alternativeRouteLabel = resolveAlternativeRouteLabel(routeResult, t)
  const alternativeUnavailableLabel = resolveAlternativeUnavailableLabel(routeResult, t)

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
    handleRecalculateFromCurrentPosition: navigationAutoRecalculation.recalculateNow,
    cancelAutomaticRecalculationForCurrentEpisode:
      navigationAutoRecalculation.cancelForCurrentEpisode,
    navigationOffRouteAlert,
    navigationRecalculationSuccessMessage,
    navigationAutoRecalculationCancellationMessage,
    addDetourPointAndRecalculate,
    removeDetourPointAndRecalculate,
    recalculateWithDetours,
    handleRecalculateAlternative,
    handleApplyAlternativeRoute,
    handleKeepCurrentRoute,
    handleCloseAlternativeComparison,
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
    alternativeUnavailableLabel,
    isAlternativeUnavailable,
  }
}
