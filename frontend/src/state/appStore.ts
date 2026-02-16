import { useRef, useState } from 'react'
import {
  defaultCloudProviderAvailabilityState,
  type CloudAuthState,
  type CloudDiagnostics,
} from '../features/cloud/cloudSync'
import type {
  ImportedApplyMode,
  PendingCloudRestore,
} from '../features/cloud/types'
import { addressBookFilterAll } from '../features/data/addressBookUtils'
import {
  loadAddressBook,
  loadSavedTrips,
  type AddressBookEntry,
  type AppPreferences,
  type CloudProvider,
  type SavedTripRecord,
} from '../features/data/dataPortability'
import {
  loadProfileSettings,
  loadStoredRoute,
  type DetourPoint,
  type LoopRequestPayload,
  type Mode,
  type NavigationCameraMode,
  type NavigationMode,
  type NavigationProgress,
  type PlannerDraft,
  type PlaceCandidate,
  type PoiCategory,
  type PoiItem,
  type ProfileSettings,
  type RouteRequestPayload,
  type TripResult,
  type TripType,
  type ValhallaStatus,
} from '../features/routing/domain'

export type RouteErrorKey =
  | 'routeErrorMissingPlace'
  | 'routeErrorFailed'
  | 'routeErrorUnavailable'
  | 'routeErrorTimeout'
  | 'routeErrorGateway'
  | 'loopErrorFailed'

type UseAppStoreParams = {
  initialPlannerDraft: PlannerDraft
  initialAppPreferences: AppPreferences
}

export const useAppStore = ({
  initialPlannerDraft,
  initialAppPreferences,
}: UseAppStoreParams) => {
  const [routeResult, setRouteResult] = useState<TripResult | null>(() =>
    loadStoredRoute(),
  )
  const [savedTrips, setSavedTrips] = useState<SavedTripRecord[]>(() =>
    loadSavedTrips(),
  )
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>(() =>
    loadAddressBook(),
  )
  const [hasResult, setHasResult] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [dataAccordionValue, setDataAccordionValue] = useState<string | null>(
    'address-book',
  )
  const [addressBookNameValue, setAddressBookNameValue] = useState('')
  const [addressBookPlaceValue, setAddressBookPlaceValue] = useState('')
  const [addressBookTagsValue, setAddressBookTagsValue] = useState('')
  const [addressBookFilterTag, setAddressBookFilterTag] =
    useState(addressBookFilterAll)
  const [addressBookPlaceCandidate, setAddressBookPlaceCandidate] =
    useState<PlaceCandidate | null>(null)
  const [deliveryStartAddressId, setDeliveryStartAddressId] = useState<
    string | null
  >(null)
  const [deliveryStopAddressIds, setDeliveryStopAddressIds] = useState<
    string[]
  >([])
  const [deliveryReturnToStart, setDeliveryReturnToStart] = useState(true)
  const [deliveryOptimizeStops, setDeliveryOptimizeStops] = useState(true)
  const [deliveryDraggedStopId, setDeliveryDraggedStopId] = useState<
    string | null
  >(null)
  const [deliveryMode, setDeliveryMode] = useState<Mode>('bike')
  const [cloudAuthState, setCloudAuthState] = useState<CloudAuthState | null>(
    null,
  )
  const [cloudProviderAvailability, setCloudProviderAvailability] = useState(
    () => ({ ...defaultCloudProviderAvailabilityState }),
  )
  const [isCloudAuthLoading, setIsCloudAuthLoading] = useState(false)
  const [isCloudSyncLoading, setIsCloudSyncLoading] = useState(false)
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null)
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null)
  const [cloudLastSyncAt, setCloudLastSyncAt] = useState<string | null>(null)
  const [pendingCloudRestore, setPendingCloudRestore] =
    useState<PendingCloudRestore | null>(null)
  const [pendingCloudMergeSyncAuthState, setPendingCloudMergeSyncAuthState] =
    useState<CloudAuthState | null>(null)
  const [pendingCloudRestoreMode, setPendingCloudRestoreMode] =
    useState<ImportedApplyMode | null>(null)
  const [shouldRevealCloudPanel, setShouldRevealCloudPanel] = useState(false)
  const [cloudDiagnostics, setCloudDiagnostics] =
    useState<CloudDiagnostics | null>(null)
  const [isCloudDiagnosticsLoading, setIsCloudDiagnosticsLoading] =
    useState(false)
  const [cloudDiagnosticsError, setCloudDiagnosticsError] = useState<
    string | null
  >(null)
  const [feedbackSubject, setFeedbackSubject] = useState('')
  const [feedbackContactEmail, setFeedbackContactEmail] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false)
  const [feedbackSubmitMessage, setFeedbackSubmitMessage] = useState<
    string | null
  >(null)
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(
    null,
  )
  const [mode, setMode] = useState<Mode | null>(() => initialPlannerDraft.mode)
  const [tripType, setTripType] = useState<TripType | null>(
    () => initialPlannerDraft.tripType,
  )
  const [onewayStartValue, setOnewayStartValue] = useState(
    () => initialPlannerDraft.onewayStartValue,
  )
  const [onewayStartPlace, setOnewayStartPlace] = useState<PlaceCandidate | null>(
    () => initialPlannerDraft.onewayStartPlace,
  )
  const [loopStartValue, setLoopStartValue] = useState(
    () => initialPlannerDraft.loopStartValue,
  )
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
  const [valhallaStatus, setValhallaStatus] = useState<ValhallaStatus | null>(
    null,
  )
  const [isValhallaStatusLoading, setIsValhallaStatusLoading] = useState(false)
  const [valhallaStatusError, setValhallaStatusError] = useState(false)
  const [isNavigationActive, setIsNavigationActive] = useState(false)
  const [isNavigationSetupOpen, setIsNavigationSetupOpen] = useState(false)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(
    () => initialAppPreferences.navigationMode,
  )
  const [navigationCameraMode, setNavigationCameraMode] =
    useState<NavigationCameraMode>(
      () => initialAppPreferences.navigationCameraMode,
    )
  const [navigationProgress, setNavigationProgress] =
    useState<NavigationProgress | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [poiAlertEnabled, setPoiAlertEnabled] = useState(
    () => initialAppPreferences.poiAlertEnabled,
  )
  const [poiAlertDistanceMeters, setPoiAlertDistanceMeters] = useState(
    () => initialAppPreferences.poiAlertDistanceMeters,
  )
  const [poiAlertCategories, setPoiAlertCategories] = useState<PoiCategory[]>(
    () => initialAppPreferences.poiAlertCategories,
  )
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] =
    useState(false)
  const [activePoiAlertId, setActivePoiAlertId] = useState<string | null>(null)
  const [poiCategories, setPoiCategories] = useState<PoiCategory[]>(
    () => initialAppPreferences.poiCategories,
  )
  const [poiCorridorMeters, setPoiCorridorMeters] = useState(
    () => initialAppPreferences.poiCorridorMeters,
  )
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>(
    () => initialAppPreferences.cloudProvider,
  )
  const [cloudAutoBackupEnabled, setCloudAutoBackupEnabled] = useState(
    () => initialAppPreferences.cloudAutoBackupEnabled,
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
  const [customDetourPlace, setCustomDetourPlace] = useState<PlaceCandidate | null>(
    null,
  )
  const [customDetourLat, setCustomDetourLat] = useState<number | ''>('')
  const [customDetourLon, setCustomDetourLon] = useState<number | ''>('')
  const [routeAlternativeIndex, setRouteAlternativeIndex] = useState(0)
  const [loopAlternativeIndex, setLoopAlternativeIndex] = useState(0)
  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() =>
    loadProfileSettings(),
  )

  const alertSeenPoiIdsRef = useRef(new Set<string>())
  const simulationDistanceRef = useRef(0)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const cloudOAuthCallbackHandledRef = useRef(false)
  const cloudAutoSyncTimerRef = useRef<number | null>(null)
  const cloudLastAutoSyncPayloadRef = useRef<string | null>(null)
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
    savedTrips,
    setSavedTrips,
    addressBook,
    setAddressBook,
    hasResult,
    setHasResult,
    isDirty,
    setIsDirty,
    dataAccordionValue,
    setDataAccordionValue,
    addressBookNameValue,
    setAddressBookNameValue,
    addressBookPlaceValue,
    setAddressBookPlaceValue,
    addressBookTagsValue,
    setAddressBookTagsValue,
    addressBookFilterTag,
    setAddressBookFilterTag,
    addressBookPlaceCandidate,
    setAddressBookPlaceCandidate,
    deliveryStartAddressId,
    setDeliveryStartAddressId,
    deliveryStopAddressIds,
    setDeliveryStopAddressIds,
    deliveryReturnToStart,
    setDeliveryReturnToStart,
    deliveryOptimizeStops,
    setDeliveryOptimizeStops,
    deliveryDraggedStopId,
    setDeliveryDraggedStopId,
    deliveryMode,
    setDeliveryMode,
    cloudAuthState,
    setCloudAuthState,
    cloudProviderAvailability,
    setCloudProviderAvailability,
    isCloudAuthLoading,
    setIsCloudAuthLoading,
    isCloudSyncLoading,
    setIsCloudSyncLoading,
    cloudSyncMessage,
    setCloudSyncMessage,
    cloudSyncError,
    setCloudSyncError,
    cloudLastSyncAt,
    setCloudLastSyncAt,
    pendingCloudRestore,
    setPendingCloudRestore,
    pendingCloudMergeSyncAuthState,
    setPendingCloudMergeSyncAuthState,
    pendingCloudRestoreMode,
    setPendingCloudRestoreMode,
    shouldRevealCloudPanel,
    setShouldRevealCloudPanel,
    cloudDiagnostics,
    setCloudDiagnostics,
    isCloudDiagnosticsLoading,
    setIsCloudDiagnosticsLoading,
    cloudDiagnosticsError,
    setCloudDiagnosticsError,
    feedbackSubject,
    setFeedbackSubject,
    feedbackContactEmail,
    setFeedbackContactEmail,
    feedbackMessage,
    setFeedbackMessage,
    isFeedbackSubmitting,
    setIsFeedbackSubmitting,
    feedbackSubmitMessage,
    setFeedbackSubmitMessage,
    feedbackSubmitError,
    setFeedbackSubmitError,
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
    cloudProvider,
    setCloudProvider,
    cloudAutoBackupEnabled,
    setCloudAutoBackupEnabled,
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
    importInputRef,
    cloudOAuthCallbackHandledRef,
    cloudAutoSyncTimerRef,
    cloudLastAutoSyncPayloadRef,
    valhallaAutoUpdateRequestedRef,
    lastRouteRequestRef,
  }
}

export type AppStore = ReturnType<typeof useAppStore>
