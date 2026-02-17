import { useRef, useState } from 'react'
import type { AppPreferences } from '../features/data/dataPortability'
import {
  loadProfileSettings,
  loadStoredRoute,
  type DetourPoint,
  type LoopRequestPayload,
  type NavigationProgress,
  type PlannerDraft,
  type PlaceCandidate,
  type PoiItem,
  type ProfileSettings,
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
  const [routeResult, setRouteResult] = useState<TripResult | null>(() => loadStoredRoute())
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
  const [isNavigationActive, setIsNavigationActive] = useState(false)
  const [isNavigationSetupOpen, setIsNavigationSetupOpen] = useState(false)
  const [navigationMode, setNavigationMode] = useState(() => initialAppPreferences.navigationMode)
  const [navigationCameraMode, setNavigationCameraMode] = useState(
    () => initialAppPreferences.navigationCameraMode,
  )
  const [navigationProgress, setNavigationProgress] = useState<NavigationProgress | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
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
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() =>
    loadProfileSettings(),
  )

  const alertSeenPoiIdsRef = useRef(new Set<string>())
  const simulationDistanceRef = useRef(0)
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

  return {
    routeResult,
    setRouteResult,
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
    navigationProgress,
    setNavigationProgress,
    navigationError,
    setNavigationError,
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
    profileSettings,
    setProfileSettings,
    alertSeenPoiIdsRef,
    simulationDistanceRef,
    valhallaAutoUpdateRequestedRef,
    lastRouteRequestRef,
  }
}
