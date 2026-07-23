import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { AppPreferences } from '../features/data/dataPortability'
import {
  loadProfileSettings,
  loadProfileCatalog,
  loadStoredRoute,
  createNavigationDeviationState,
  type DetourPoint,
  type LoopRequestPayload,
  type NavigationDeviationState,
  type NavigationProgress,
  type NavigationRecalculationStatus,
  type PlannerDraft,
  type PlaceCandidate,
  type PoiItem,
  type ProfileSettings,
  type ProfileCatalog,
  type RouteAlternativeCandidate,
  type RouteAlternativeOption,
  type RouteComparisonSummary,
  type RouteRequestPayload,
  type TripResult,
  type TripType,
  type ValhallaStatus,
  type Mode,
} from '../features/routing/domain'
import type { RouteErrorKey } from './store.types'

type UseMapSliceParams = {
  initialPlannerDraft: PlannerDraft
  initialAppPreferences: AppPreferences
}

export const useMapSlice = ({ initialPlannerDraft, initialAppPreferences }: UseMapSliceParams) => {
  const [routeResult, setRouteResultState] = useState<TripResult | null>(() => loadStoredRoute())
  const [hasResult, setHasResult] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [mode, setMode] = useState<Mode | null>(() => initialPlannerDraft.mode)
  const [tripType, setTripType] = useState<TripType | null>(() => initialPlannerDraft.tripType)
  const [onewayStartValue, setOnewayStartValue] = useState(
    () => initialPlannerDraft.onewayStartValue,
  )
  const [onewayStartPlace, setOnewayStartPlace] = useState<PlaceCandidate | null>(
    () => initialPlannerDraft.onewayStartPlace,
  )
  const [loopStartValue, setLoopStartValue] = useState(() => initialPlannerDraft.loopStartValue)
  const [loopStartPlace, setLoopStartPlace] = useState<PlaceCandidate | null>(
    () => initialPlannerDraft.loopStartPlace,
  )
  const [endValue, setEndValue] = useState(() => initialPlannerDraft.endValue)
  const [endPlace, setEndPlace] = useState<PlaceCandidate | null>(
    () => initialPlannerDraft.endPlace,
  )
  const [targetDistanceKm, setTargetDistanceKm] = useState<number | ''>(
    () => initialPlannerDraft.targetDistanceKm,
  )
  const [routeErrorKey, setRouteErrorKey] = useState<RouteErrorKey | null>(null)
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [valhallaStatus, setValhallaStatus] = useState<ValhallaStatus | null>(null)
  const [isValhallaStatusLoading, setIsValhallaStatusLoading] = useState(false)
  const [valhallaStatusError, setValhallaStatusError] = useState(false)
  const [isNavigationActive, setIsNavigationActiveState] = useState(false)
  const [isNavigationSetupOpen, setIsNavigationSetupOpen] = useState(false)
  const [navigationMode, setNavigationModeState] = useState(
    () => initialAppPreferences.navigationMode,
  )
  const [navigationCameraMode, setNavigationCameraMode] = useState(
    () => initialAppPreferences.navigationCameraMode,
  )
  const [automaticNavigationRecalculationEnabled, setAutomaticNavigationRecalculationEnabled] =
    useState(() => initialAppPreferences.automaticNavigationRecalculationEnabled)
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(
    () => initialAppPreferences.voiceGuidanceEnabled,
  )
  const [navigationProgress, setNavigationProgress] = useState<NavigationProgress | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [navigationDeviationState, setNavigationDeviationState] =
    useState<NavigationDeviationState>(() => createNavigationDeviationState())
  const [navigationRecalculationStatus, setNavigationRecalculationStatus] =
    useState<NavigationRecalculationStatus>('idle')
  const [navigationSessionKey, setNavigationSessionKey] = useState(0)
  const [poiAlertEnabled, setPoiAlertEnabled] = useState(
    () => initialAppPreferences.poiAlertEnabled,
  )
  const [poiAlertDistanceMeters, setPoiAlertDistanceMeters] = useState(
    () => initialAppPreferences.poiAlertDistanceMeters,
  )
  const [poiAlertCategories, setPoiAlertCategories] = useState(
    () => initialAppPreferences.poiAlertCategories,
  )
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(false)
  const [activePoiAlertId, setActivePoiAlertId] = useState<string | null>(null)
  const [poiCategories, setPoiCategories] = useState(() => initialAppPreferences.poiCategories)
  const [poiAdvancedFilterSettings, setPoiAdvancedFilterSettings] = useState(
    () => initialAppPreferences.poiAdvancedFilterSettings,
  )
  const [poiCorridorMeters, setPoiCorridorMeters] = useState(
    () => initialAppPreferences.poiCorridorMeters,
  )
  const [poiItems, setPoiItems] = useState<PoiItem[]>([])
  const [isPoiLoading, setIsPoiLoading] = useState(false)
  const [poiError, setPoiError] = useState(false)
  const [poiErrorMessage, setPoiErrorMessage] = useState<string | null>(null)
  const [poiRefreshKey, setPoiRefreshKey] = useState(0)
  const [hasPoiFetchCompleted, setHasPoiFetchCompleted] = useState(false)
  const [detourPoints, setDetourPoints] = useState<DetourPoint[]>([])
  const [isCustomDetourPanelOpen, setIsCustomDetourPanelOpen] = useState(false)
  const [customDetourValue, setCustomDetourValue] = useState('')
  const [customDetourPlace, setCustomDetourPlace] = useState<PlaceCandidate | null>(null)
  const [customDetourLat, setCustomDetourLat] = useState<number | ''>('')
  const [customDetourLon, setCustomDetourLon] = useState<number | ''>('')
  const [routeAlternativeIndex, setRouteAlternativeIndex] = useState(0)
  const [loopAlternativeIndex, setLoopAlternativeIndex] = useState(0)
  const [pendingAlternativeRoute, setPendingAlternativeRoute] =
    useState<RouteAlternativeCandidate | null>(null)
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternativeOption[]>([])
  const [routeComparison, setRouteComparison] = useState<RouteComparisonSummary | null>(null)
  const [isAlternativeComparisonOpen, setIsAlternativeComparisonOpen] = useState(false)
  const [isAlternativeLoading, setIsAlternativeLoading] = useState(false)
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() =>
    loadProfileSettings(),
  )
  const [profileCatalog, setProfileCatalog] = useState<ProfileCatalog>(() =>
    loadProfileCatalog(profileSettings),
  )

  const alertSeenPoiIdsRef = useRef(new Set<string>())
  const simulationDistanceRef = useRef(0)
  const navigationRecalculationInFlightRef = useRef(false)
  const navigationRecalculationGenerationRef = useRef(0)
  const navigationRecalculationRequestIdRef = useRef<number | null>(null)
  const navigationIsActiveRef = useRef(isNavigationActive)
  const navigationModeRef = useRef(navigationMode)
  const navigationRouteResultRef = useRef(routeResult)
  const valhallaAutoUpdateRequestedRef = useRef(false)
  const lastRouteRequestRef = useRef<
    | {
        type: 'route'
        payload: RouteRequestPayload
      }
    | {
        type: 'loop'
        payload: LoopRequestPayload
      }
    | null
  >(null)

  const invalidateNavigationRecalculation = useCallback(() => {
    navigationRecalculationGenerationRef.current += 1
    navigationRecalculationRequestIdRef.current = null
    navigationRecalculationInFlightRef.current = false
    setNavigationRecalculationStatus('idle')
  }, [])

  const setRouteResult = useCallback<Dispatch<SetStateAction<TripResult | null>>>(
    (value) => {
      invalidateNavigationRecalculation()
      const next = typeof value === 'function' ? value(navigationRouteResultRef.current) : value
      if (next !== navigationRouteResultRef.current) {
        setNavigationSessionKey((current) => current + 1)
      }
      navigationRouteResultRef.current = next
      setRouteResultState(next)
    },
    [invalidateNavigationRecalculation],
  )

  const setRouteResultFromNavigationRecalculation = useCallback((value: TripResult) => {
    navigationRouteResultRef.current = value
    setNavigationSessionKey((current) => current + 1)
    setRouteResultState(value)
  }, [])

  const setIsNavigationActive = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      const next = typeof value === 'function' ? value(navigationIsActiveRef.current) : value
      if (next !== navigationIsActiveRef.current) {
        invalidateNavigationRecalculation()
        if (next) {
          setNavigationSessionKey((current) => current + 1)
        }
      }
      navigationIsActiveRef.current = next
      setIsNavigationActiveState(next)
    },
    [invalidateNavigationRecalculation],
  )

  const setNavigationMode = useCallback<Dispatch<SetStateAction<typeof navigationMode>>>(
    (value) => {
      const next = typeof value === 'function' ? value(navigationModeRef.current) : value
      if (next !== navigationModeRef.current) {
        invalidateNavigationRecalculation()
      }
      navigationModeRef.current = next
      setNavigationModeState(next)
    },
    [invalidateNavigationRecalculation],
  )

  useEffect(
    () => () => {
      navigationRecalculationGenerationRef.current += 1
      navigationRecalculationRequestIdRef.current = null
      navigationRecalculationInFlightRef.current = false
    },
    [],
  )

  return {
    routeResult,
    setRouteResult,
    setRouteResultFromNavigationRecalculation,
    hasResult,
    setHasResult,
    isDirty,
    setIsDirty,
    mode,
    setMode,
    tripType,
    setTripType,
    onewayStartValue,
    setOnewayStartValue,
    onewayStartPlace,
    setOnewayStartPlace,
    loopStartValue,
    setLoopStartValue,
    loopStartPlace,
    setLoopStartPlace,
    endValue,
    setEndValue,
    endPlace,
    setEndPlace,
    targetDistanceKm,
    setTargetDistanceKm,
    routeErrorKey,
    setRouteErrorKey,
    routeErrorMessage,
    setRouteErrorMessage,
    isRouteLoading,
    setIsRouteLoading,
    isExporting,
    setIsExporting,
    exportError,
    setExportError,
    valhallaStatus,
    setValhallaStatus,
    isValhallaStatusLoading,
    setIsValhallaStatusLoading,
    valhallaStatusError,
    setValhallaStatusError,
    isNavigationActive,
    setIsNavigationActive,
    isNavigationSetupOpen,
    setIsNavigationSetupOpen,
    navigationMode,
    setNavigationMode,
    navigationCameraMode,
    setNavigationCameraMode,
    automaticNavigationRecalculationEnabled,
    setAutomaticNavigationRecalculationEnabled,
    voiceGuidanceEnabled,
    setVoiceGuidanceEnabled,
    navigationProgress,
    setNavigationProgress,
    navigationError,
    setNavigationError,
    navigationDeviationState,
    setNavigationDeviationState,
    navigationRecalculationStatus,
    setNavigationRecalculationStatus,
    navigationSessionKey,
    poiAlertEnabled,
    setPoiAlertEnabled,
    poiAlertDistanceMeters,
    setPoiAlertDistanceMeters,
    poiAlertCategories,
    setPoiAlertCategories,
    systemNotificationsEnabled,
    setSystemNotificationsEnabled,
    activePoiAlertId,
    setActivePoiAlertId,
    poiCategories,
    setPoiCategories,
    poiAdvancedFilterSettings,
    setPoiAdvancedFilterSettings,
    poiCorridorMeters,
    setPoiCorridorMeters,
    poiItems,
    setPoiItems,
    isPoiLoading,
    setIsPoiLoading,
    poiError,
    setPoiError,
    poiErrorMessage,
    setPoiErrorMessage,
    poiRefreshKey,
    setPoiRefreshKey,
    hasPoiFetchCompleted,
    setHasPoiFetchCompleted,
    detourPoints,
    setDetourPoints,
    isCustomDetourPanelOpen,
    setIsCustomDetourPanelOpen,
    customDetourValue,
    setCustomDetourValue,
    customDetourPlace,
    setCustomDetourPlace,
    customDetourLat,
    setCustomDetourLat,
    customDetourLon,
    setCustomDetourLon,
    routeAlternativeIndex,
    setRouteAlternativeIndex,
    loopAlternativeIndex,
    setLoopAlternativeIndex,
    pendingAlternativeRoute,
    setPendingAlternativeRoute,
    routeAlternatives,
    setRouteAlternatives,
    routeComparison,
    setRouteComparison,
    isAlternativeComparisonOpen,
    setIsAlternativeComparisonOpen,
    isAlternativeLoading,
    setIsAlternativeLoading,
    profileSettings,
    setProfileSettings,
    profileCatalog,
    setProfileCatalog,
    alertSeenPoiIdsRef,
    simulationDistanceRef,
    navigationRecalculationInFlightRef,
    navigationRecalculationGenerationRef,
    navigationRecalculationRequestIdRef,
    navigationIsActiveRef,
    navigationModeRef,
    navigationRouteResultRef,
    invalidateNavigationRecalculation,
    valhallaAutoUpdateRequestedRef,
    lastRouteRequestRef,
  }
}
