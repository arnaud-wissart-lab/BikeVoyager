import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconHelpCircle,
  IconMap2,
  IconMoon,
  IconRoute,
  IconSun,
  IconUser,
  IconDatabase,
} from '@tabler/icons-react'
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import InstallPrompt from '../../components/InstallPrompt'
import PlannerPage from '../pages/PlannerPage'
import MapPage from '../pages/MapPage'
import ProfilesPage from '../pages/ProfilesPage'
import DataPage from '../pages/DataPage'
import HelpPage from '../pages/HelpPage'
import {
  clearOAuthCallbackQueryParams,
  completeCloudOAuthCallback,
  defaultCloudProviderAvailabilityState,
  disconnectCloudSession,
  fetchCloudDiagnostics,
  fetchCloudProviderAvailability,
  isCloudProviderConfigured,
  loadCloudSession,
  CloudBackupNotFoundError,
  restoreBackupFromCloud,
  startCloudOAuth,
  syncBackupToCloud,
} from '../../features/cloud/cloudSync'
import type {
  CloudAuthState,
  CloudDiagnostics,
} from '../../features/cloud/cloudSync'
import {
  addressBookStorageKey,
  appPreferencesStorageKey,
  buildBackupExport,
  buildTripExport,
  createAddressBookEntry,
  createSavedTripRecord,
  loadAddressBook,
  loadAppPreferences,
  loadSavedTrips,
  parseImportedBikeVoyagerData,
  sortAndLimitAddressBook,
  savedTripsStorageKey,
  sortAndLimitSavedTrips,
  upsertAddressBookEntry,
  upsertSavedTrip,
} from '../../features/data/dataPortability'
import type {
  AddressBookEntry,
  AppPreferences,
  CloudProvider,
  ExportedPreferences,
  ParsedImportedData,
  SavedTripRecord,
  SupportedLanguage,
  ThemeModePreference,
} from '../../features/data/dataPortability'
import {
  isEncryptedBikeVoyagerPayload,
} from '../../features/data/dataEncryption'
import {
  apiModeByUi,
  buildCumulativeDistances,
  buildGpxFileName,
  buildLoopRequest,
  clamp,
  computeRouteBounds,
  defaultProfileSettings,
  downloadBlob,
  expandBounds,
  haversineDistanceMeters,
  isMode,
  isNavigationCameraMode,
  isNavigationMode,
  kmhToMps,
  loadPlannerDraft,
  loadProfileSettings,
  loadStoredRoute,
  loopTelemetryEvents,
  normalizeNumericInput,
  osmTagLabels,
  osmValueLabels,
  parseContentDispositionFileName,
  plannerDraftStorageKey,
  poiAlertDistanceRange,
  poiCorridorRange,
  poiPreferredTagOrder,
  profileStorageKey,
  projectCoordinateOnRoute,
  routeOptionVariants,
  routeStorageKey,
  sampleRouteAtDistance,
  simulationTickMs,
  speedRanges,
  trackLoopEvent,
} from '../../features/routing/domain'
import { apiPaths } from '../../features/routing/apiPaths'
import type {
  AssistLevel,
  DetourPoint,
  LoopRequestPayload,
  LoopResult,
  MapViewMode,
  Mode,
  NavigationCameraMode,
  NavigationMode,
  NavigationProgress,
  PlannerDraft,
  PlaceCandidate,
  PoiCategory,
  PoiItem,
  ProfileSettings,
  RouteElevationPoint,
  RouteKey,
  RouteLocation,
  RouteRequestPayload,
  RouteResult,
  TripResult,
  TripType,
  ValhallaStatus,
} from '../../features/routing/domain'
import {
  addressBookFilterAll,
  formatAddressTagFallbackLabel,
  maxAddressBookTagsPerEntry,
  moveIdByDirection,
  parseAddressTagsInput,
  reorderIdsByDragAndDrop,
} from '../../features/data/addressBookUtils'
import useHashRoute from '../../features/routing/useHashRoute'
import { useMapFeatureSlice } from '../../features/map/useMapFeatureSlice'
import {
  hasPlannerDraftData,
  toCanonicalJson,
} from '../../features/data/importDataUtils'
import { useDataFeatureSlice } from '../../features/data/useDataFeatureSlice'
import { useCloudFeatureSlice } from '../../features/cloud/useCloudFeatureSlice'
import { usePoisFeatureSlice } from '../../features/pois/usePoisFeatureSlice'
import { useRoutingFeatureSlice } from '../../features/routing/useRoutingFeatureSlice'

type PendingCloudRestore = {
  imported: ParsedImportedData
  authState: CloudAuthState
  modifiedAt: string | null
}

type ImportedApplyMode = 'replace' | 'merge'
const cloudDataRouteHash = '#/donnees'
const cloudReconnectToastId = 'cloud-reconnect-required'

export default function AppContainerScreen() {
  const { t, i18n } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDesktop = useMediaQuery('(min-width: 60em)')
  const initialPlannerDraft = useMemo(() => loadPlannerDraft(), [])
  const initialAppPreferences = useMemo(() => loadAppPreferences(), [])

  const [route, navigate] = useHashRoute('planifier')
  const [routeResult, setRouteResult] = useState<TripResult | null>(() =>
    loadStoredRoute(),
  )
  const [savedTrips, setSavedTrips] = useState<SavedTripRecord[]>(() =>
    loadSavedTrips(),
  )
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>(() =>
    loadAddressBook(),
  )
  const hasRoute = Boolean(routeResult)
  const poiEnabled = hasRoute
  const [hasResult, setHasResult] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [dataAccordionValue, setDataAccordionValue] = useState<string | null>(
    'address-book',
  )
  const [addressBookNameValue, setAddressBookNameValue] = useState('')
  const [addressBookPlaceValue, setAddressBookPlaceValue] = useState('')
  const [addressBookTagsValue, setAddressBookTagsValue] = useState('')
  const [addressBookFilterTag, setAddressBookFilterTag] = useState(addressBookFilterAll)
  const [addressBookPlaceCandidate, setAddressBookPlaceCandidate] =
    useState<PlaceCandidate | null>(null)
  const [deliveryStartAddressId, setDeliveryStartAddressId] = useState<string | null>(null)
  const [deliveryStopAddressIds, setDeliveryStopAddressIds] = useState<string[]>([])
  const [deliveryReturnToStart, setDeliveryReturnToStart] = useState(true)
  const [deliveryOptimizeStops, setDeliveryOptimizeStops] = useState(true)
  const [deliveryDraggedStopId, setDeliveryDraggedStopId] = useState<string | null>(null)
  const [deliveryMode, setDeliveryMode] = useState<Mode>('bike')
  const [cloudAuthState, setCloudAuthState] = useState<CloudAuthState | null>(null)
  const [cloudProviderAvailability, setCloudProviderAvailability] =
    useState(() => ({ ...defaultCloudProviderAvailabilityState }))
  const [isCloudAuthLoading, setIsCloudAuthLoading] = useState(false)
  const [isCloudSyncLoading, setIsCloudSyncLoading] = useState(false)
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null)
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null)
  const [cloudLastSyncAt, setCloudLastSyncAt] = useState<string | null>(null)
  const [pendingCloudRestore, setPendingCloudRestore] =
    useState<PendingCloudRestore | null>(null)
  const [pendingCloudMergeSyncAuthState, setPendingCloudMergeSyncAuthState] =
    useState<CloudAuthState | null>(null)
  const [shouldRevealCloudPanel, setShouldRevealCloudPanel] = useState(false)
  const [cloudDiagnostics, setCloudDiagnostics] = useState<CloudDiagnostics | null>(null)
  const [isCloudDiagnosticsLoading, setIsCloudDiagnosticsLoading] = useState(false)
  const [cloudDiagnosticsError, setCloudDiagnosticsError] = useState<string | null>(null)
  const [feedbackSubject, setFeedbackSubject] = useState('')
  const [feedbackContactEmail, setFeedbackContactEmail] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false)
  const [feedbackSubmitMessage, setFeedbackSubmitMessage] = useState<string | null>(null)
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(() => initialPlannerDraft.mode)
  const [tripType, setTripType] = useState<TripType | null>(() => initialPlannerDraft.tripType)
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
  const [routeErrorKey, setRouteErrorKey] = useState<
    | 'routeErrorMissingPlace'
    | 'routeErrorFailed'
    | 'routeErrorUnavailable'
    | 'routeErrorTimeout'
    | 'routeErrorGateway'
    | 'loopErrorFailed'
    | null
  >(null)
  const [routeErrorMessage, setRouteErrorMessage] = useState<string | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [valhallaStatus, setValhallaStatus] = useState<ValhallaStatus | null>(null)
  const [isValhallaStatusLoading, setIsValhallaStatusLoading] = useState(false)
  const [valhallaStatusError, setValhallaStatusError] = useState(false)
  const [isNavigationActive, setIsNavigationActive] = useState(false)
  const [isNavigationSetupOpen, setIsNavigationSetupOpen] = useState(false)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(
    () => initialAppPreferences.navigationMode,
  )
  const [navigationCameraMode, setNavigationCameraMode] =
    useState<NavigationCameraMode>(() => initialAppPreferences.navigationCameraMode)
  const [navigationProgress, setNavigationProgress] =
    useState<NavigationProgress | null>(null)
  const [navigationError, setNavigationError] = useState<string | null>(null)
  const [poiAlertEnabled, setPoiAlertEnabled] = useState(
    () => initialAppPreferences.poiAlertEnabled,
  )
  const [poiAlertDistanceMeters, setPoiAlertDistanceMeters] = useState(
    () => initialAppPreferences.poiAlertDistanceMeters,
  )
  const [poiAlertCategories, setPoiAlertCategories] =
    useState<PoiCategory[]>(() => initialAppPreferences.poiAlertCategories)
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(false)
  const [activePoiAlertId, setActivePoiAlertId] = useState<string | null>(null)
  const [poiCategories, setPoiCategories] =
    useState<PoiCategory[]>(() => initialAppPreferences.poiCategories)
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
  const [customDetourPlace, setCustomDetourPlace] = useState<PlaceCandidate | null>(null)
  const [customDetourLat, setCustomDetourLat] = useState<number | ''>('')
  const [customDetourLon, setCustomDetourLon] = useState<number | ''>('')
  const [routeAlternativeIndex, setRouteAlternativeIndex] = useState(0)
  const [loopAlternativeIndex, setLoopAlternativeIndex] = useState(0)
  const alertSeenPoiIdsRef = useRef(new Set<string>())
  const simulationDistanceRef = useRef(0)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const cloudOAuthCallbackHandledRef = useRef(false)
  const cloudAutoSyncTimerRef = useRef<number | null>(null)
  const cloudLastAutoSyncPayloadRef = useRef<string | null>(null)
  const valhallaAutoUpdateRequestedRef = useRef(false)
  const { hasPoiCategories, visiblePoiItems } = usePoisFeatureSlice({
    poiCategories,
    poiItems,
  })
  const {
    mapViewMode,
    setMapViewMode,
    mapCommand,
    mapCommandSeq,
    triggerMapCommand,
    isSummaryPanelExpanded,
    toggleSummaryPanel: handleToggleSummaryPanel,
    isPoiPanelExpanded,
    togglePoiPanel: handleTogglePoiPanel,
    isMobileMapPanelExpanded,
    setIsMobileMapPanelExpanded,
    toggleMobileMapPanel: handleToggleMobileMapPanel,
    selectedPoiId,
    setSelectedPoiId,
    isPoiModalOpen,
    setIsPoiModalOpen,
    isMobilePoiDetailsExpanded,
    setIsMobilePoiDetailsExpanded,
    toggleMobilePoiDetails: handleToggleMobilePoiDetails,
    selectedPoi,
    activePoiAlert,
    handlePoiSelect,
  } = useMapFeatureSlice({
    initialMapViewMode: initialAppPreferences.mapViewMode,
    isDesktop,
    visiblePoiItems,
    poiItems,
    activePoiAlertId,
  })
  const {
    addressBookById,
    addressBookTagOptions,
    visibleAddressBookEntries,
    visibleAddressBookCount,
  } = useDataFeatureSlice({
    addressBook,
    filterTag: addressBookFilterTag,
  })
  const deliveryStartAddress = deliveryStartAddressId
    ? addressBookById.get(deliveryStartAddressId) ?? null
    : null
  const deliveryStopAddresses = useMemo(
    () =>
      deliveryStopAddressIds
        .map((id) => addressBookById.get(id) ?? null)
        .filter((entry): entry is AddressBookEntry => entry !== null),
    [addressBookById, deliveryStopAddressIds],
  )
  const isPlaceAlreadySavedInAddressBook = useCallback(
    (place: PlaceCandidate | null) => {
      if (!place) {
        return false
      }

      return addressBook.some(
        (entry) =>
          Math.abs(entry.lat - place.lat) < 0.00001 &&
          Math.abs(entry.lon - place.lon) < 0.00001,
      )
    },
    [addressBook],
  )

  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() =>
    loadProfileSettings(),
  )
  const appPreferences = useMemo<AppPreferences>(
    () => ({
      mapViewMode,
      navigationMode,
      navigationCameraMode,
      poiAlertEnabled,
      poiAlertDistanceMeters,
      poiAlertCategories,
      poiCategories,
      poiCorridorMeters,
      cloudProvider,
      cloudAutoBackupEnabled,
    }),
    [
      cloudAutoBackupEnabled,
      cloudProvider,
      mapViewMode,
      navigationCameraMode,
      navigationMode,
      poiAlertCategories,
      poiAlertDistanceMeters,
      poiAlertEnabled,
      poiCategories,
      poiCorridorMeters,
    ],
  )

  const loadCloudDiagnostics = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true
      if (!quiet) {
        setIsCloudDiagnosticsLoading(true)
        setCloudDiagnosticsError(null)
      }

      try {
        const diagnostics = await fetchCloudDiagnostics()
        setCloudDiagnostics(diagnostics)
        if (!quiet) {
          setCloudDiagnosticsError(null)
        }
      } catch (error) {
        if (!quiet) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : t('helpPlatformStatusUnavailable')
          setCloudDiagnosticsError(message)
        }
      } finally {
        if (!quiet) {
          setIsCloudDiagnosticsLoading(false)
        }
      }
    },
    [t],
  )

  useEffect(() => {
    localStorage.setItem(profileStorageKey, JSON.stringify(profileSettings))
  }, [profileSettings])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.setItem(appPreferencesStorageKey, JSON.stringify(appPreferences))
  }, [appPreferences])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (savedTrips.length === 0) {
      localStorage.removeItem(savedTripsStorageKey)
      return
    }

    localStorage.setItem(savedTripsStorageKey, JSON.stringify(savedTrips))
  }, [savedTrips])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (addressBook.length === 0) {
      localStorage.removeItem(addressBookStorageKey)
      return
    }

    localStorage.setItem(addressBookStorageKey, JSON.stringify(addressBook))
  }, [addressBook])

  useEffect(() => {
    const knownIds = new Set(addressBook.map((entry) => entry.id))
    setDeliveryStartAddressId((current) => {
      if (!current || knownIds.has(current)) {
        return current
      }
      return null
    })
    setDeliveryStopAddressIds((current) => current.filter((id) => knownIds.has(id)))
    setDeliveryDraggedStopId((current) => {
      if (!current || knownIds.has(current)) {
        return current
      }

      return null
    })
  }, [addressBook])

  useEffect(() => {
    if (addressBookFilterTag === addressBookFilterAll) {
      return
    }

    if (addressBookTagOptions.includes(addressBookFilterTag)) {
      return
    }

    setAddressBookFilterTag(addressBookFilterAll)
  }, [addressBookFilterTag, addressBookTagOptions])

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

    const draft: PlannerDraft = {
      mode,
      tripType,
      onewayStartValue,
      onewayStartPlace,
      loopStartValue,
      loopStartPlace,
      endValue,
      endPlace,
      targetDistanceKm,
    }

    localStorage.setItem(plannerDraftStorageKey, JSON.stringify(draft))
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
  }, [routeResult])

  useEffect(() => {
    let isCancelled = false

    const loadCloudBootstrap = async () => {
      try {
        const availability = await fetchCloudProviderAvailability()
        if (isCancelled) {
          return
        }

        setCloudProviderAvailability(availability)

        const pageUrl = new URL(window.location.href)
        const hasOAuthQuery =
          pageUrl.searchParams.has('code') || pageUrl.searchParams.has('error')
        if (hasOAuthQuery) {
          return
        }

        const session = await loadCloudSession()
        if (isCancelled) {
          return
        }

        setCloudAuthState(session)
        if (session) {
          setCloudProvider(session.provider)
          return
        }

        const preferredProvider = initialAppPreferences.cloudProvider
        if (
          preferredProvider === 'none' ||
          availability[preferredProvider] !== true
        ) {
          return
        }

        setCloudProvider(preferredProvider)
        setDataAccordionValue('backup-cloud')
        setShouldRevealCloudPanel(true)
        setCloudSyncMessage(null)
        setCloudSyncError(null)
        notifications.show({
          id: cloudReconnectToastId,
          color: 'yellow',
          withCloseButton: true,
          autoClose: false,
          position: isDesktop ? 'top-right' : 'top-center',
          style: {
            marginTop: isDesktop ? '82px' : '66px',
            maxWidth: isDesktop
              ? 'min(420px, calc(100vw - 40px))'
              : 'calc(100vw - 24px)',
          },
          title: t('cloudReconnectPromptTitle'),
          message: (
            <Stack gap={8}>
              <Text size="sm">
                {t('cloudReconnectPromptBody', {
                  provider:
                    preferredProvider === 'google-drive' ? 'Google Drive' : 'OneDrive',
                })}
              </Text>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    notifications.hide(cloudReconnectToastId)
                    setIsCloudAuthLoading(true)
                    setCloudSyncMessage(null)
                    setCloudSyncError(null)
                    void (async () => {
                      try {
                        const authUrl = await startCloudOAuth(preferredProvider, {
                          returnHash: cloudDataRouteHash,
                        })
                        window.location.assign(authUrl)
                      } catch (error) {
                        setIsCloudAuthLoading(false)
                        setCloudSyncMessage(null)
                        setCloudSyncError(
                          t('cloudConnectError', {
                            message:
                              error instanceof Error ? error.message : t('dataImportInvalid'),
                          }),
                        )
                      }
                    })()
                  }}
                >
                  {t('cloudReconnectNow')}
                </Button>
                <Text size="xs" c="dimmed">
                  {t('cloudReconnectShortcut')}
                </Text>
              </Group>
            </Stack>
          ),
        })
      } catch {
        if (isCancelled) {
          return
        }

        setCloudProviderAvailability({ ...defaultCloudProviderAvailabilityState })
      }
    }

    void loadCloudBootstrap()

    return () => {
      isCancelled = true
    }
  }, [initialAppPreferences.cloudProvider, isDesktop, t])

  useEffect(() => {
    if (route !== 'aide') {
      return
    }

    if (cloudDiagnostics || isCloudDiagnosticsLoading) {
      return
    }

    void loadCloudDiagnostics()
  }, [cloudDiagnostics, isCloudDiagnosticsLoading, loadCloudDiagnostics, route])

  useEffect(() => {
    if (!shouldRevealCloudPanel) {
      return
    }

    if (route !== 'donnees' || dataAccordionValue !== 'backup-cloud') {
      return
    }

    const timerId = window.setTimeout(() => {
      document
        .getElementById('data-cloud-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShouldRevealCloudPanel(false)
    }, 120)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [dataAccordionValue, route, shouldRevealCloudPanel])

  useEffect(() => {
    if (!cloudAuthState) {
      cloudLastAutoSyncPayloadRef.current = null
      return
    }

    if (cloudProvider === 'none' || cloudAuthState.provider !== cloudProvider) {
      cloudLastAutoSyncPayloadRef.current = null
    }
  }, [cloudAuthState, cloudProvider])

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
        await fetch(apiPaths.valhallaUpdateStart, {
          method: 'POST',
        })
      } catch {
        valhallaAutoUpdateRequestedRef.current = false
      } finally {
        await loadValhallaStatus({ quiet: true })
      }
    }

    void triggerAutomaticValhallaUpdate()
  }, [route, valhallaStatus])

  useEffect(() => {
    if (route !== 'carte' || !hasRoute) {
      setIsNavigationActive(false)
      setIsNavigationSetupOpen(false)
    }
  }, [hasRoute, route])

  useEffect(() => {
    if (isDesktop || route !== 'carte' || !hasRoute || isNavigationActive) {
      setIsMobileMapPanelExpanded(false)
      return
    }

    if (!isPoiModalOpen) {
      setIsMobileMapPanelExpanded(true)
    }
  }, [
    hasRoute,
    isDesktop,
    isNavigationActive,
    isPoiModalOpen,
    route,
    setIsMobileMapPanelExpanded,
  ])

  useEffect(() => {
    if (!selectedPoiId) {
      setIsPoiModalOpen(false)
      setIsMobilePoiDetailsExpanded(true)
      return
    }

    if (visiblePoiItems.some((poi) => poi.id === selectedPoiId)) {
      return
    }

    setIsPoiModalOpen(false)
    setIsMobilePoiDetailsExpanded(true)
  }, [
    selectedPoiId,
    setIsMobilePoiDetailsExpanded,
    setIsPoiModalOpen,
    visiblePoiItems,
  ])

  useEffect(() => {
    if (!poiEnabled) {
      setPoiItems([])
      setPoiError(false)
      setPoiErrorMessage(null)
      setHasPoiFetchCompleted(false)
      setSelectedPoiId(null)
      setIsPoiModalOpen(false)
      setIsMobilePoiDetailsExpanded(true)
      setDetourPoints([])
      setIsCustomDetourPanelOpen(false)
    }
  }, [
    poiEnabled,
    setIsMobilePoiDetailsExpanded,
    setIsPoiModalOpen,
    setSelectedPoiId,
  ])

  useEffect(() => {
    const shouldLoadPois = poiEnabled && route === 'carte'
    if (!shouldLoadPois) {
      return
    }

    const shouldLoadVisiblePois = poiCategories.length > 0
    const shouldLoadAlertPois =
      isNavigationActive &&
      poiAlertEnabled &&
      poiAlertCategories.length > 0

    const requestedCategories = Array.from(
      new Set([
        ...(shouldLoadVisiblePois ? poiCategories : []),
        ...(shouldLoadAlertPois ? poiAlertCategories : []),
      ]),
    )

    if (requestedCategories.length === 0) {
      setPoiItems([])
      setPoiError(false)
      setPoiErrorMessage(null)
      setHasPoiFetchCompleted(false)
      return
    }

    const controller = new AbortController()

    const loadPois = async () => {
      setPoiItems([])
      setSelectedPoiId(null)
      setIsPoiModalOpen(false)
      setIsMobilePoiDetailsExpanded(true)
      setIsPoiLoading(true)
      setPoiError(false)
      setPoiErrorMessage(null)
      setHasPoiFetchCompleted(false)

      try {
        const geometry = routeResult?.geometry
        if (!geometry || geometry.coordinates.length < 2) {
          setPoiItems([])
          setHasPoiFetchCompleted(true)
          return
        }

        const payload = {
          geometry,
          categories: requestedCategories,
          distance: poiCorridorMeters,
          language: i18n.language,
        }

        const response = await fetch(apiPaths.poiAroundRoute, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!response.ok) {
          let message: string | null = null
          try {
            const contentType = response.headers.get('content-type') ?? ''
            if (contentType.includes('application/json')) {
              const payload = (await response.json()) as { message?: string }
              if (payload && typeof payload.message === 'string' && payload.message.trim()) {
                message = payload.message.trim()
              }
            } else {
              const bodyText = (await response.text()).trim()
              if (bodyText) {
                message = bodyText.slice(0, 220)
              }
            }
          } catch {
            message = null
          }
          setPoiErrorMessage(message)
          setPoiError(true)
          return
        }

        const data = (await response.json()) as PoiItem[]
        setPoiItems(data)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setPoiErrorMessage(null)
        setPoiError(true)
      } finally {
        if (!controller.signal.aborted) {
          setHasPoiFetchCompleted(true)
        }
        setIsPoiLoading(false)
      }
    }

    void loadPois()

    return () => {
      controller.abort()
    }
  }, [
    isNavigationActive,
    poiAlertCategories,
    poiAlertEnabled,
    poiCategories,
    poiCorridorMeters,
    poiEnabled,
    poiRefreshKey,
    route,
    routeResult?.geometry,
    i18n.language,
    setIsMobilePoiDetailsExpanded,
    setIsPoiModalOpen,
    setSelectedPoiId,
  ])

  const language = i18n.language.startsWith('en') ? 'en' : 'fr'
  const isFrench = language === 'fr'
  const isMapRoute = route === 'carte'
  const themeMode = colorScheme
  const isDarkTheme = computedColorScheme === 'dark'
  const nextThemeMode =
    themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'
  const mobileThemeModeLabel =
    themeMode === 'auto'
      ? t('themeAuto')
      : themeMode === 'light'
        ? t('themeLight')
        : t('themeDark')
  const mobileThemeActionLabel = `${t('settingsThemeLabel')}: ${mobileThemeModeLabel}`
  const footerHeight = isDesktop ? 0 : 72
  const showShellHeader = !isNavigationActive || (!isDesktop && isMapRoute)
  const showShellFooter = !isNavigationActive
  const showMobileCompactHeader = !isDesktop && showShellHeader
  const showDesktopMapHeader = isDesktop && isMapRoute && hasRoute
  const headerHeight = isDesktop ? 72 : 56
  const chromeHeaderHeight = showShellHeader ? headerHeight : 0
  const chromeFooterHeight = showShellFooter ? footerHeight : 0
  const contentSize = isDesktop ? '84rem' : 'xl'
  const surfaceColor =
    isDarkTheme ? theme.colors.gray[9] : theme.white
  const borderColor = theme.colors.gray[isDarkTheme ? 8 : 3]
  const shellChromeBackground = isDarkTheme
    ? 'rgba(14, 17, 24, 0.84)'
    : 'rgba(255, 255, 255, 0.86)'
  const shellChromeFilter = 'saturate(1.15) blur(12px)'
  const shellMainBackground = isDarkTheme
    ? 'radial-gradient(1200px 520px at -15% -10%, rgba(35,87,153,0.34) 0%, rgba(13,19,30,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(29,120,89,0.22) 0%, rgba(12,18,28,0) 55%), linear-gradient(180deg, rgba(12,15,21,1) 0%, rgba(10,14,20,1) 100%)'
    : 'radial-gradient(1200px 520px at -15% -10%, rgba(120,186,255,0.3) 0%, rgba(244,248,255,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(125,217,186,0.26) 0%, rgba(245,250,248,0) 55%), linear-gradient(180deg, rgba(247,250,255,1) 0%, rgba(244,247,252,1) 100%)'
  const notificationsSupported = typeof Notification !== 'undefined'
  const notificationsPermission = notificationsSupported
    ? Notification.permission
    : 'default'
  const toastDurationMs = {
    success: 2600,
    error: 5000,
  } as const
  const toastPosition = isDesktop ? 'top-right' : 'top-center'
  const toastTopOffsetPx = showShellHeader ? headerHeight + 10 : 10
  const toastStyle = useMemo(
    () =>
      ({
        marginTop: `${toastTopOffsetPx}px`,
        maxWidth: isDesktop ? 'min(420px, calc(100vw - 40px))' : 'calc(100vw - 24px)',
      }) as const,
    [isDesktop, toastTopOffsetPx],
  )
  const showSuccessToast = useCallback(
    (message: string, options?: { title?: string; durationMs?: number }) => {
      notifications.show({
        color: 'teal',
        position: toastPosition,
        autoClose: options?.durationMs ?? toastDurationMs.success,
        style: toastStyle,
        title: options?.title,
        message,
      })
    },
    [toastPosition, toastStyle, toastDurationMs.success],
  )
  const showErrorToast = useCallback(
    (message: string, options?: { title?: string; durationMs?: number }) => {
      notifications.show({
        color: 'red',
        position: toastPosition,
        autoClose: options?.durationMs ?? toastDurationMs.error,
        style: toastStyle,
        title: options?.title,
        message,
      })
    },
    [toastPosition, toastStyle, toastDurationMs.error],
  )
  const isValhallaBuildRunning = valhallaStatus?.build?.state === 'running'
  const valhallaUpdateAvailable = valhallaStatus?.update?.update_available === true
  const canSubmitFeedback =
    feedbackSubject.trim().length >= 6 &&
    feedbackMessage.trim().length >= 20 &&
    !isFeedbackSubmitting
  const {
    selectedCloudProvider,
    selectedCloudConfigured,
    hasAnyConfiguredCloudProvider,
    cloudProviderControlData,
    connectedCloudMatchesSelection,
    cloudAccountLabel,
    toCloudProviderLabel,
  } = useCloudFeatureSlice({
    cloudProvider,
    cloudProviderAvailability,
    cloudAuthState,
    t,
  })
  const cloudBackupFileName = 'bikevoyager-backup-latest.json'
  const hasPlannerDraftContent =
    mode !== null ||
    tripType !== null ||
    onewayStartValue.trim().length > 0 ||
    loopStartValue.trim().length > 0 ||
    endValue.trim().length > 0 ||
    typeof targetDistanceKm === 'number'
  const hasLocalBackupData =
    hasPlannerDraftContent ||
    routeResult !== null ||
    savedTrips.length > 0 ||
    addressBook.length > 0

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const previousRootBackground = root.style.background
    const previousBodyBackground = document.body.style.background

    root.style.background = shellMainBackground
    document.body.style.background = shellMainBackground

    return () => {
      root.style.background = previousRootBackground
      document.body.style.background = previousBodyBackground
    }
  }, [shellMainBackground])

  useEffect(() => {
    if (cloudProvider === 'none') {
      return
    }

    if (!isCloudProviderConfigured(cloudProvider, cloudProviderAvailability)) {
      setCloudProvider('none')
    }
  }, [cloudProvider, cloudProviderAvailability])

  const navItems = [
    {
      key: 'planifier' as RouteKey,
      label: t('navPlanifier'),
      icon: IconRoute,
      disabled: false,
    },
    {
      key: 'carte' as RouteKey,
      label: t('navCarte'),
      icon: IconMap2,
      disabled: false,
    },
    {
      key: 'profils' as RouteKey,
      label: t('navProfils'),
      icon: IconUser,
      disabled: false,
    },
    {
      key: 'donnees' as RouteKey,
      label: t('navDonnees'),
      icon: IconDatabase,
      disabled: false,
    },
    {
      key: 'aide' as RouteKey,
      label: t('navAide'),
      icon: IconHelpCircle,
      disabled: false,
    },
  ]

  const poiCategoryOptions = useMemo(
    () => [
      { value: 'monuments', label: t('poiCategoryMonuments') },
      { value: 'paysages', label: t('poiCategoryLandscapes') },
      { value: 'commerces', label: t('poiCategoryShops') },
      { value: 'services', label: t('poiCategoryServices') },
    ],
    [t],
  )

  const poiCategoryLabels = useMemo<Record<PoiCategory, string>>(
    () => ({
      monuments: t('poiCategoryMonuments'),
      paysages: t('poiCategoryLandscapes'),
      commerces: t('poiCategoryShops'),
      services: t('poiCategoryServices'),
    }),
    [t],
  )

  const showLocationInputs = Boolean(mode && tripType)
  const panelTransitionDuration = 220
  const panelTransitionTiming = 'ease-in-out'
  const mobilePanelMotionEase = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const mobilePanelFadeEase = 'cubic-bezier(0.16, 1, 0.3, 1)'
  const mobileMapPanelTransition = [
    `max-height 360ms ${mobilePanelMotionEase}`,
    `opacity 260ms ${mobilePanelFadeEase}`,
    `transform 360ms ${mobilePanelMotionEase}`,
    `filter 260ms ${mobilePanelFadeEase}`,
    `padding-top 320ms ${mobilePanelMotionEase}`,
  ].join(', ')
  const mobilePoiPanelTransition = [
    `max-height 340ms ${mobilePanelMotionEase}`,
    `opacity 240ms ${mobilePanelFadeEase}`,
    `transform 340ms ${mobilePanelMotionEase}`,
    `filter 240ms ${mobilePanelFadeEase}`,
  ].join(', ')
  const activeStartPlace = tripType === 'loop' ? loopStartPlace : onewayStartPlace
  const hasStartSelection = Boolean(activeStartPlace)
  const hasEndSelection = tripType === 'oneway' ? Boolean(endPlace) : true
  const panelStackStyle: React.CSSProperties = {
    position: 'relative',
  }
  const panelBaseStyle: React.CSSProperties = {
    transitionProperty: 'opacity, transform',
    transitionDuration: `${panelTransitionDuration}ms`,
    transitionTimingFunction: panelTransitionTiming,
  }
  const getPanelStyle = (isActive: boolean): React.CSSProperties => ({
    ...panelBaseStyle,
    position: isActive ? 'relative' : 'absolute',
    inset: isActive ? undefined : 0,
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'translateY(0)' : 'translateY(-6px)',
    pointerEvents: isActive ? 'auto' : 'none',
    visibility: isActive ? 'visible' : 'hidden',
  })
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

  const markDirty = () => {
    if (hasResult) {
      setIsDirty(true)
    }
  }

  const handleModeChange = (value: string) => {
    setMode(value as Mode)
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
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

  const buildRouteOptionsVariant = (variantIndex: number) =>
    routeOptionVariants[variantIndex % routeOptionVariants.length]
  const resolveEbikeAssistForMode = (nextMode: Mode): AssistLevel | undefined =>
    nextMode === 'ebike' ? profileSettings.ebikeAssist : undefined

  const toAddressBookRouteLocation = (entry: AddressBookEntry): RouteLocation => ({
    lat: entry.lat,
    lon: entry.lon,
    label: entry.label,
  })

  const toAddressBookPlaceCandidate = (entry: AddressBookEntry): PlaceCandidate => ({
    label: entry.label,
    lat: entry.lat,
    lon: entry.lon,
    score: 1,
    source: 'address-book',
  })

  const toAddressBookDetourPoint = (entry: AddressBookEntry): DetourPoint => ({
    id: `address-book:${entry.id}`,
    source: 'custom',
    lat: entry.lat,
    lon: entry.lon,
    label: entry.name,
  })

  const formatAddressTagLabel = (tag: string) => {
    if (tag === 'home') {
      return t('addressBookTagHome')
    }
    if (tag === 'client') {
      return t('addressBookTagClient')
    }
    if (tag === 'work') {
      return t('addressBookTagWork')
    }
    if (tag === 'delivery') {
      return t('addressBookTagDelivery')
    }

    return formatAddressTagFallbackLabel(tag)
  }

  const savePlaceInAddressBook = (
    place: PlaceCandidate,
    customName?: string,
    tags?: string[],
  ) => {
    const prepared = createAddressBookEntry({
      name: customName ?? place.label,
      place,
      tags,
    })
    const resolvedName = prepared.name
    setAddressBook((current) => upsertAddressBookEntry(current, prepared))
    showSuccessToast(
      t('addressBookSavedSuccess', {
        name: resolvedName,
      }),
    )
  }

  const requestRoute = async (
    requestBody: RouteRequestPayload,
    nextDetours: DetourPoint[] = [],
  ) => {
    setIsRouteLoading(true)

    try {
      const response = await fetch(apiPaths.route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        if (response.status === 503) {
          const message = await readApiMessage(response)
          if (message) {
            setRouteErrorMessage(message)
            setRouteErrorKey(null)
          } else {
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

      const data = (await response.json()) as Omit<RouteResult, 'kind'> & {
        elevation_profile?: RouteElevationPoint[]
      }
      setRouteResult({
        ...data,
        kind: 'route',
        elevation_profile: Array.isArray(data.elevation_profile) ? data.elevation_profile : [],
      })
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      handleNavigate('carte', true)
      return true
    } catch {
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

    try {
      const response = await fetch(apiPaths.loop, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        if (response.status === 503) {
          const message = await readApiMessage(response)
          if (message) {
            setRouteErrorMessage(message)
            setRouteErrorKey(null)
          } else {
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

      const data = (await response.json()) as Omit<LoopResult, 'kind'> & {
        elevation_profile?: RouteElevationPoint[]
      }
      setRouteResult({
        ...data,
        kind: 'loop',
        elevation_profile: Array.isArray(data.elevation_profile) ? data.elevation_profile : [],
      })
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      handleNavigate('carte', true)
      return true
    } catch {
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

    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    const success = await requestRoute(requestBody, [])
    if (success) {
      setRouteAlternativeIndex(0)
    }
  }

  const toWaypointPayload = (detours: DetourPoint[]) =>
    detours.map(({ lat, lon, label }) => ({ lat, lon, label }))

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

  const recalculateWithDetours = async (nextDetours: DetourPoint[]) => {
    if (!poiEnabled || !mapTripType) {
      return false
    }

    const resolvedMode = mode ?? 'bike'
    setRouteErrorKey(null)
    setRouteErrorMessage(null)

    if (mapTripType === 'loop') {
      const startLocation: RouteLocation | null = loopStartPlace
        ? {
            lat: loopStartPlace.lat,
            lon: loopStartPlace.lon,
            label: loopStartPlace.label,
          }
        : mapStartCoordinate
          ? {
              lat: mapStartCoordinate[1],
              lon: mapStartCoordinate[0],
              label: startLabel || t('poiStartFallback'),
            }
          : null

      if (!startLocation) {
        setRouteErrorKey('loopErrorFailed')
        return false
      }

      const loopDistance =
        typeof targetDistanceKm === 'number' && targetDistanceKm > 0
          ? targetDistanceKm
          : routeResult
            ? Math.max(1, Math.round(routeResult.distance_m / 1000))
            : 1

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
      : mapStartCoordinate
        ? {
            lat: mapStartCoordinate[1],
            lon: mapStartCoordinate[0],
            label: startLabel || t('poiStartFallback'),
          }
        : null

    const toLocation: RouteLocation | null = endPlace
      ? {
          lat: endPlace.lat,
          lon: endPlace.lon,
          label: endPlace.label,
        }
      : mapEndCoordinate
        ? {
            lat: mapEndCoordinate[1],
            lon: mapEndCoordinate[0],
            label: endLabel || t('poiEndFallback'),
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

  const handleAddPoiWaypoint = async (poi: PoiItem) => {
    if (!poiEnabled || !mapTripType) {
      return
    }

    const nextDetours = appendDetourPoint({
      id: `poi:${poi.id}`,
      source: 'poi',
      poiId: poi.id,
      lat: poi.lat,
      lon: poi.lon,
      label: getPoiDisplayName(poi),
    })

    if (nextDetours === detourPoints) {
      setSelectedPoiId(poi.id)
      setIsPoiModalOpen(true)
      setIsMobilePoiDetailsExpanded(true)
      return
    }

    const success = await recalculateWithDetours(nextDetours)
    if (success) {
      setSelectedPoiId(poi.id)
      setIsPoiModalOpen(true)
      setIsMobilePoiDetailsExpanded(true)
    }
  }

  const handleAddCustomDetourFromAddress = async () => {
    if (!customDetourPlace) {
      return
    }

    const nextDetours = appendDetourPoint({
      id: `custom-address:${customDetourPlace.lat.toFixed(6)}:${customDetourPlace.lon.toFixed(6)}`,
      source: 'custom',
      lat: customDetourPlace.lat,
      lon: customDetourPlace.lon,
      label: customDetourPlace.label,
    })

    if (nextDetours === detourPoints) {
      return
    }

    const success = await recalculateWithDetours(nextDetours)
    if (!success) {
      return
    }

    setCustomDetourValue('')
    setCustomDetourPlace(null)
    setCustomDetourLat('')
    setCustomDetourLon('')
  }

  const handleAddAddressBookDetour = async (entryId: string) => {
    const entry = addressBookById.get(entryId)
    if (!entry) {
      return
    }

    const nextDetours = appendDetourPoint(toAddressBookDetourPoint(entry))
    if (nextDetours === detourPoints) {
      return
    }

    const success = await recalculateWithDetours(nextDetours)
    if (!success) {
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((item) =>
          item.id === entryId ? { ...item, updatedAt: now } : item,
        ),
      ),
    )
  }

  const handleAddCustomDetourFromCoordinates = async () => {
    if (typeof customDetourLat !== 'number' || typeof customDetourLon !== 'number') {
      return
    }

    if (
      customDetourLat < -90 ||
      customDetourLat > 90 ||
      customDetourLon < -180 ||
      customDetourLon > 180
    ) {
      return
    }

    const label = `${customDetourLat.toFixed(5)}, ${customDetourLon.toFixed(5)}`
    const nextDetours = appendDetourPoint({
      id: `custom-gps:${customDetourLat.toFixed(6)}:${customDetourLon.toFixed(6)}`,
      source: 'custom',
      lat: customDetourLat,
      lon: customDetourLon,
      label,
    })

    if (nextDetours === detourPoints) {
      return
    }

    const success = await recalculateWithDetours(nextDetours)
    if (!success) {
      return
    }

    setCustomDetourValue('')
    setCustomDetourPlace(null)
    setCustomDetourLat('')
    setCustomDetourLon('')
  }

  const handleRemoveDetourPoint = async (detourId: string) => {
    const nextDetours = detourPoints.filter((point) => point.id !== detourId)
    const success = await recalculateWithDetours(nextDetours)
    if (success && selectedPoiId && !nextDetours.some((point) => point.poiId === selectedPoiId)) {
      setSelectedPoiId(null)
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
        : mapStartCoordinate
          ? {
              lat: mapStartCoordinate[1],
              lon: mapStartCoordinate[0],
              label: startLabel || t('poiStartFallback'),
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
      : mapStartCoordinate
        ? {
            lat: mapStartCoordinate[1],
            lon: mapStartCoordinate[0],
            label: startLabel || t('poiStartFallback'),
          }
        : null

    const toLocation: RouteLocation | null = endPlace
      ? {
          lat: endPlace.lat,
          lon: endPlace.lon,
          label: endPlace.label,
        }
      : mapEndCoordinate
        ? {
            lat: mapEndCoordinate[1],
            lon: mapEndCoordinate[0],
            label: endLabel || t('poiEndFallback'),
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

  const handlePoiCategoryChange = (values: string[]) => {
    setPoiCategories(values as PoiCategory[])
  }

  const handlePoiAlertCategoryChange = (values: string[]) => {
    setPoiAlertCategories(values as PoiCategory[])
  }

  const handleCloudProviderChange = (value: string) => {
    if (value === 'none' || value === 'onedrive' || value === 'google-drive') {
      setCloudProvider(value)
      setCloudSyncMessage(null)
      setCloudSyncError(null)
    }
  }

  const handleCloudAutoBackupEnabledChange = (value: boolean) => {
    setCloudAutoBackupEnabled(value)
    setCloudSyncMessage(null)
    setCloudSyncError(null)
  }

  const handleNavigationModeChange = (value: string) => {
    if (!isNavigationMode(value)) {
      return
    }

    setNavigationMode(value)
    if (value === 'simulation') {
      setMapViewMode('3d')
      setNavigationCameraMode('panoramic_3d')
      return
    }

    setMapViewMode('3d')
    setNavigationCameraMode('follow_3d')
  }

  const handleNavigationCameraModeChange = (value: string) => {
    if (!isNavigationCameraMode(value)) {
      return
    }

    setNavigationCameraMode(value)
    if (value === 'overview_2d') {
      setMapViewMode('2d')
      return
    }

    setMapViewMode('3d')
  }

  const handleSystemNotificationsChange = async (checked: boolean) => {
    if (!checked) {
      setSystemNotificationsEnabled(false)
      return
    }

    if (typeof Notification === 'undefined') {
      setSystemNotificationsEnabled(false)
      return
    }

    if (Notification.permission === 'granted') {
      setSystemNotificationsEnabled(true)
      return
    }

    if (Notification.permission === 'denied') {
      setSystemNotificationsEnabled(false)
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setSystemNotificationsEnabled(permission === 'granted')
    } catch {
      setSystemNotificationsEnabled(false)
    }
  }

  const handleOpenNavigationSetup = () => {
    if (!hasRoute || isRouteLoading) {
      return
    }

    setIsNavigationSetupOpen(true)
    setIsPoiModalOpen(false)
    if (!isDesktop) {
      setIsMobileMapPanelExpanded(false)
    }
  }

  const handleCloseNavigationSetup = () => {
    setIsNavigationSetupOpen(false)
  }

  const handleStartNavigation = () => {
    if (!hasRoute || isRouteLoading) {
      return
    }

    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    setNavigationError(null)
    setActivePoiAlertId(null)
    setIsNavigationSetupOpen(false)
    setIsNavigationActive(true)
    setIsPoiModalOpen(false)
    if (!isDesktop) {
      setIsMobileMapPanelExpanded(false)
    }
    if (navigationMode === 'simulation') {
      setMapViewMode('3d')
      setNavigationCameraMode('panoramic_3d')
    }
  }

  const handleExitNavigation = () => {
    setIsNavigationActive(false)
  }

  const handleDismissPoiAlert = () => {
    setActivePoiAlertId(null)
  }

  const handlePoiRefresh = () => {
    setPoiItems([])
    setSelectedPoiId(null)
    setIsPoiModalOpen(false)
    setIsMobilePoiDetailsExpanded(true)
    setPoiRefreshKey((current) => current + 1)
  }

  const handleTypeChange = (value: string) => {
    setTripType(value as TripType)
    setEndValue('')
    setEndPlace(null)
    setTargetDistanceKm('')
    setDetourPoints([])
    setIsCustomDetourPanelOpen(false)
    setCustomDetourValue('')
    setCustomDetourPlace(null)
    setCustomDetourLat('')
    setCustomDetourLon('')
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    markDirty()
  }

  const loadValhallaStatus = async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true
    if (!quiet) {
      setIsValhallaStatusLoading(true)
      setValhallaStatusError(false)
    }

    try {
      const response = await fetch(apiPaths.valhallaStatus)
      if (!response.ok) {
        if (!quiet) {
          setValhallaStatusError(true)
        }
        return
      }

      const data = (await response.json()) as ValhallaStatus
      setValhallaStatus(data)
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

  const readApiMessage = async (response: Response) => {
    try {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as {
          message?: string
          title?: string
          detail?: string
          errors?: Record<string, string[]>
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message.trim()
        }
        if (typeof payload.detail === 'string' && payload.detail.trim()) {
          return payload.detail.trim()
        }
        if (payload.errors && typeof payload.errors === 'object') {
          const firstError = Object.values(payload.errors).find(
            (messages) => Array.isArray(messages) && messages.length > 0,
          )
          if (firstError && firstError[0] && firstError[0].trim()) {
            return firstError[0].trim()
          }
        }
        if (typeof payload.title === 'string' && payload.title.trim()) {
          return payload.title.trim()
        }
      }

      const body = (await response.text()).trim()
      if (body) {
        return body.slice(0, 240)
      }
    } catch {
      return null
    }

    return null
  }

  const handleSubmitDeveloperFeedback = async () => {
    if (!canSubmitFeedback) {
      return
    }

    setIsFeedbackSubmitting(true)
    setFeedbackSubmitMessage(null)
    setFeedbackSubmitError(null)

    try {
      const response = await fetch(apiPaths.feedback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: feedbackSubject,
          message: feedbackMessage,
          contactEmail: feedbackContactEmail,
          page: route,
          website: '',
        }),
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

  const handleSpeedChange = (targetMode: Mode, value: number | '') => {
    if (typeof value !== 'number') {
      return
    }

    const range = speedRanges[targetMode]
    setProfileSettings((current) => ({
      ...current,
      speeds: {
        ...current.speeds,
        [targetMode]: clamp(value, range.min, range.max),
      },
    }))
  }

  const handleResetProfiles = () => {
    setProfileSettings(defaultProfileSettings)
  }

  const handleSaveAddressBookEntry = () => {
    if (!addressBookPlaceCandidate) {
      showErrorToast(t('addressBookMissingPlace'))
      return
    }

    const customName = addressBookNameValue.trim()
    const tags = parseAddressTagsInput(addressBookTagsValue)
    savePlaceInAddressBook(
      addressBookPlaceCandidate,
      customName.length > 0 ? customName : undefined,
      tags,
    )
    setAddressBookNameValue('')
    setAddressBookPlaceValue('')
    setAddressBookTagsValue('')
    setAddressBookPlaceCandidate(null)
  }

  const handleSaveQuickAddress = (place: PlaceCandidate | null) => {
    if (!place) {
      return
    }

    if (isPlaceAlreadySavedInAddressBook(place)) {
      return
    }

    savePlaceInAddressBook(place)
  }

  const handleDeleteAddressBookEntry = (entryId: string) => {
    const existing = addressBookById.get(entryId)
    setAddressBook((current) => current.filter((entry) => entry.id !== entryId))
    showSuccessToast(
      t('addressBookDeletedSuccess', {
        name: existing?.name ?? t('addressBookEntryFallbackName'),
      }),
    )
  }

  const handleDeleteAddressBookTag = (entryId: string, tagToDelete: string) => {
    const existing = addressBookById.get(entryId)
    if (!existing || !existing.tags.includes(tagToDelete)) {
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: entry.tags.filter((tag) => tag !== tagToDelete),
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagDeletedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(tagToDelete),
      }),
    )
  }

  const handleAddAddressBookTag = (entryId: string, tagToAdd: string) => {
    const existing = addressBookById.get(entryId)
    const [parsedTag] = parseAddressTagsInput(tagToAdd, { maxTags: 1 })
    if (!existing || !parsedTag) {
      return
    }

    if (existing.tags.includes(parsedTag)) {
      return
    }

    if (existing.tags.length >= maxAddressBookTagsPerEntry) {
      showErrorToast(
        t('addressBookTagLimitReached', {
          max: maxAddressBookTagsPerEntry,
        }),
      )
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: [...entry.tags, parsedTag],
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagAddedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(parsedTag),
      }),
    )
  }

  const handleAddressBookTagFilterChange = (tag: string) => {
    setAddressBookFilterTag(tag)
  }

  const handleDeliveryModeChange = (value: string) => {
    if (!isMode(value)) {
      return
    }

    setDeliveryMode(value)
  }

  const handleSelectDeliveryStart = (entryId: string) => {
    setDeliveryStartAddressId(entryId)
    setDeliveryStopAddressIds((current) => current.filter((id) => id !== entryId))
    setDeliveryDraggedStopId((current) => (current === entryId ? null : current))
  }

  const handleToggleDeliveryStop = (entryId: string) => {
    if (entryId === deliveryStartAddressId) {
      return
    }

    setDeliveryStopAddressIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    )
    setDeliveryDraggedStopId((current) => (current === entryId ? null : current))
  }

  const reorderDeliveryStops = (sourceId: string, targetId: string) => {
    setDeliveryStopAddressIds((current) => {
      const next = reorderIdsByDragAndDrop(current, sourceId, targetId)
      if (next === current) {
        return current
      }
      return next
    })
  }

  const handleMoveDeliveryStop = (entryId: string, direction: -1 | 1) => {
    setDeliveryStopAddressIds((current) => moveIdByDirection(current, entryId, direction))
  }

  const handleDeliveryStopDragStart = (
    event: DragEvent<HTMLDivElement>,
    entryId: string,
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', entryId)
    setDeliveryDraggedStopId(entryId)
  }

  const handleDeliveryStopDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDeliveryStopDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = deliveryDraggedStopId ?? event.dataTransfer.getData('text/plain')
    if (!sourceId) {
      return
    }

    reorderDeliveryStops(sourceId, targetId)
    setDeliveryDraggedStopId(null)
  }

  const handleDeliveryStopDragEnd = () => {
    setDeliveryDraggedStopId(null)
  }

  const handleClearDeliverySelection = () => {
    setDeliveryStartAddressId(null)
    setDeliveryStopAddressIds([])
    setDeliveryDraggedStopId(null)
    showSuccessToast(t('deliverySelectionCleared'))
  }

  const handleBuildDeliveryRoute = async () => {
    if (!deliveryStartAddress) {
      showErrorToast(t('deliveryRouteMissingStart'))
      return
    }

    if (deliveryStopAddresses.length === 0) {
      showErrorToast(t('deliveryRouteMissingStops'))
      return
    }

    const startLocation = toAddressBookRouteLocation(deliveryStartAddress)
    let endAddress = deliveryStartAddress
    let waypointAddresses = deliveryStopAddresses

    if (!deliveryReturnToStart) {
      endAddress = deliveryStopAddresses[deliveryStopAddresses.length - 1]
      waypointAddresses = deliveryStopAddresses.slice(0, -1)
    }

    const requestBody: RouteRequestPayload = {
      from: startLocation,
      to: toAddressBookRouteLocation(endAddress),
      ...(waypointAddresses.length > 0
        ? {
            waypoints: waypointAddresses.map(toAddressBookRouteLocation),
          }
        : {}),
      optimizeWaypoints: deliveryOptimizeStops,
      mode: apiModeByUi[deliveryMode],
      options: buildRouteOptionsVariant(0),
      speedKmh: profileSettings.speeds[deliveryMode],
      ...(deliveryMode === 'ebike'
        ? {
            ebikeAssist: profileSettings.ebikeAssist,
          }
        : {}),
    }

    setMode(deliveryMode)
    setTripType('oneway')
    setOnewayStartValue(deliveryStartAddress.label)
    setOnewayStartPlace(toAddressBookPlaceCandidate(deliveryStartAddress))
    setLoopStartValue('')
    setLoopStartPlace(null)
    setEndValue(endAddress.label)
    setEndPlace(toAddressBookPlaceCandidate(endAddress))
    setTargetDistanceKm('')
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)

    const nextDetours = waypointAddresses.map(toAddressBookDetourPoint)
    const success = await requestRoute(requestBody, nextDetours)
    if (!success) {
      showErrorToast(t('deliveryRouteBuildFailed'))
      return
    }

    const usedIds = new Set<string>([
      deliveryStartAddress.id,
      ...deliveryStopAddresses.map((entry) => entry.id),
    ])
    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          usedIds.has(entry.id) ? { ...entry, updatedAt: now } : entry,
        ),
      ),
    )

    showSuccessToast(
      t(
        deliveryOptimizeStops
          ? 'deliveryRouteBuiltSuccessOptimized'
          : 'deliveryRouteBuiltSuccessOrdered',
        {
          count: deliveryStopAddresses.length,
        },
      ),
    )
  }

  const buildDateStamp = () => new Date().toISOString().slice(0, 10)

  const serializeJsonContent = (payload: unknown) =>
    `${JSON.stringify(payload, null, 2)}\n`

  const downloadJsonFile = (payload: unknown, fileName: string) => {
    const content = serializeJsonContent(payload)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    downloadBlob(blob, fileName)
  }

  const buildBackupPayload = useCallback(
    () =>
      buildBackupExport({
        preferences: {
          profileSettings,
          appPreferences,
          language: (language === 'en' ? 'en' : 'fr') as SupportedLanguage,
          themeMode: themeMode as ThemeModePreference,
        } satisfies ExportedPreferences,
        plannerDraft: {
          mode,
          tripType,
          onewayStartValue,
          onewayStartPlace,
          loopStartValue,
          loopStartPlace,
          endValue,
          endPlace,
          targetDistanceKm,
        } satisfies PlannerDraft,
        currentRoute: routeResult,
        savedTrips: sortAndLimitSavedTrips(savedTrips),
        addressBook: sortAndLimitAddressBook(addressBook),
      }),
    [
      addressBook,
      appPreferences,
      endPlace,
      endValue,
      language,
      loopStartPlace,
      loopStartValue,
      mode,
      onewayStartPlace,
      onewayStartValue,
      profileSettings,
      routeResult,
      savedTrips,
      targetDistanceKm,
      themeMode,
      tripType,
    ],
  )

  const cloudBackupPayloadContent = useMemo(
    () => serializeJsonContent(buildBackupPayload()),
    [buildBackupPayload],
  )

  const exportPayloadAsJsonFile = async (params: {
    payload: unknown
    fileNamePrefix: string
    successMessage: string
  }) => {
    const fileName = `${params.fileNamePrefix}-${buildDateStamp()}.json`
    downloadJsonFile(params.payload, fileName)
    showSuccessToast(params.successMessage)
  }

  const applyParsedImportedData = (
    imported: ParsedImportedData,
    options?: { mode?: ImportedApplyMode },
  ) => {
    const modeToApply = options?.mode ?? 'replace'

    if (imported.kind === 'preferences') {
      applyImportedPreferences(imported.preferences)
      return imported.kind
    }

    if (imported.kind === 'trip') {
      setSavedTrips((current) => upsertSavedTrip(current, imported.trip))
      return imported.kind
    }

    if (modeToApply === 'merge') {
      setSavedTrips((current) => {
        const byId = new Map<string, SavedTripRecord>()
        for (const trip of current) {
          byId.set(trip.id, trip)
        }
        for (const trip of imported.savedTrips) {
          byId.set(trip.id, trip)
        }
        return sortAndLimitSavedTrips(Array.from(byId.values()))
      })
      setAddressBook((current) => {
        let merged = current
        for (const entry of imported.addressBook) {
          merged = upsertAddressBookEntry(merged, entry)
        }
        return merged
      })

      if (!hasPlannerDraftContent) {
        applyImportedPlannerDraft(imported.plannerDraft)
      }

      if (!routeResult && imported.currentRoute) {
        setRouteResult(imported.currentRoute)
        setHasResult(true)
        setIsDirty(false)
        setDetourPoints([])
        setRouteAlternativeIndex(0)
        setLoopAlternativeIndex(0)
        setRouteErrorKey(null)
        setRouteErrorMessage(null)
      }

      return imported.kind
    }

    applyImportedPreferences(imported.preferences)
    applyImportedPlannerDraft(imported.plannerDraft)
    setSavedTrips(sortAndLimitSavedTrips(imported.savedTrips))
    setAddressBook(sortAndLimitAddressBook(imported.addressBook))
    setRouteResult(imported.currentRoute)
    setHasResult(Boolean(imported.currentRoute))
    setIsDirty(false)
    setDetourPoints([])
    setDeliveryStartAddressId(null)
    setDeliveryStopAddressIds([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    return imported.kind
  }

  const parseImportedPayload = (payload: unknown) => {
    if (isEncryptedBikeVoyagerPayload(payload)) {
      throw new Error(t('dataImportEncryptedUnsupported'))
    }

    const imported = parseImportedBikeVoyagerData(payload)
    if (!imported) {
      throw new Error(t('dataImportInvalid'))
    }

    return imported
  }

  const importPayload = async (
    payload: unknown,
    options?: { mode?: ImportedApplyMode },
  ) => {
    const imported = parseImportedPayload(payload)
    return applyParsedImportedData(imported, options)
  }

  const wouldCloudBackupMergeChangeLocal = (
    imported: Extract<ParsedImportedData, { kind: 'backup' }>,
  ) => {
    const mergedSavedTrips = (() => {
      const byId = new Map<string, SavedTripRecord>()
      for (const trip of savedTrips) {
        byId.set(trip.id, trip)
      }
      for (const trip of imported.savedTrips) {
        byId.set(trip.id, trip)
      }
      return sortAndLimitSavedTrips(Array.from(byId.values()))
    })()

    const mergedAddressBook = (() => {
      let merged = addressBook
      for (const entry of imported.addressBook) {
        merged = upsertAddressBookEntry(merged, entry)
      }
      return merged
    })()

    const savedTripsChanged =
      toCanonicalJson(mergedSavedTrips) !== toCanonicalJson(savedTrips)
    const addressBookChanged =
      toCanonicalJson(mergedAddressBook) !== toCanonicalJson(addressBook)
    const plannerDraftWouldBeImported =
      !hasPlannerDraftContent && hasPlannerDraftData(imported.plannerDraft)
    const routeWouldBeImported = !routeResult && imported.currentRoute !== null

    return (
      savedTripsChanged ||
      addressBookChanged ||
      plannerDraftWouldBeImported ||
      routeWouldBeImported
    )
  }

  const applyImportedPreferences = (preferences: ExportedPreferences) => {
    setProfileSettings(preferences.profileSettings)
    setMapViewMode(preferences.appPreferences.mapViewMode)
    setNavigationMode(preferences.appPreferences.navigationMode)
    setNavigationCameraMode(preferences.appPreferences.navigationCameraMode)
    setPoiAlertEnabled(preferences.appPreferences.poiAlertEnabled)
    setPoiAlertDistanceMeters(preferences.appPreferences.poiAlertDistanceMeters)
    setPoiAlertCategories(preferences.appPreferences.poiAlertCategories)
    setPoiCategories(preferences.appPreferences.poiCategories)
    setPoiCorridorMeters(preferences.appPreferences.poiCorridorMeters)
    setCloudProvider(preferences.appPreferences.cloudProvider)
    setCloudAutoBackupEnabled(preferences.appPreferences.cloudAutoBackupEnabled)
    setColorScheme(preferences.themeMode)
    void i18n.changeLanguage(preferences.language)
  }

  const applyImportedPlannerDraft = (draft: PlannerDraft) => {
    setMode(draft.mode)
    setTripType(draft.tripType)
    setOnewayStartValue(draft.onewayStartValue)
    setOnewayStartPlace(draft.onewayStartPlace)
    setLoopStartValue(draft.loopStartValue)
    setLoopStartPlace(draft.loopStartPlace)
    setEndValue(draft.endValue)
    setEndPlace(draft.endPlace)
    setTargetDistanceKm(draft.targetDistanceKm)
  }

  const handleSaveCurrentLoop = () => {
    if (!routeResult || routeResult.kind !== 'loop') {
      showErrorToast(t('dataLoopSaveUnavailable'), { title: t('dataSaveLoop') })
      return
    }

    const savedTrip = createSavedTripRecord({
      trip: routeResult,
      mode,
      startLabel: startLabel || null,
      endLabel: null,
      targetDistanceKm,
      name: mapHeaderTitle || t('dataSavedLoopDefaultName'),
    })

    setSavedTrips((current) => upsertSavedTrip(current, savedTrip))
    showSuccessToast(t('dataLoopSavedSuccess'), { title: t('dataSaveLoop') })
  }

  const handleOpenSavedTrip = (trip: SavedTripRecord) => {
    setRouteResult(trip.trip)
    setHasResult(true)
    setIsDirty(false)
    setDetourPoints([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)

    setMode(trip.mode)
    setTripType(trip.tripType)
    setOnewayStartPlace(null)
    setLoopStartPlace(null)
    setEndPlace(null)
    setTargetDistanceKm(
      typeof trip.targetDistanceKm === 'number' ? trip.targetDistanceKm : '',
    )

    if (trip.tripType === 'loop') {
      setLoopStartValue(trip.startLabel ?? '')
      setOnewayStartValue('')
      setEndValue('')
    } else {
      setOnewayStartValue(trip.startLabel ?? '')
      setEndValue(trip.endLabel ?? '')
      setLoopStartValue('')
    }

    showSuccessToast(t('dataSavedTripOpened'))
    handleNavigate('carte', true)
  }

  const handleDeleteSavedTrip = (tripId: string) => {
    setSavedTrips((current) => current.filter((trip) => trip.id !== tripId))
    showSuccessToast(t('dataSavedTripDeleted'))
  }

  const handleExportSavedTrip = async (trip: SavedTripRecord) => {
    const payload = buildTripExport(trip)
    await exportPayloadAsJsonFile({
      payload,
      fileNamePrefix: 'bikevoyager-trip',
      successMessage: t('dataSavedTripExported'),
    })
  }

  const handleExportBackup = async () => {
    await exportPayloadAsJsonFile({
      payload: buildBackupPayload(),
      fileNamePrefix: 'bikevoyager-backup',
      successMessage: t('dataExportBackupSuccess'),
    })
  }

  const handleImportData = () => {
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const [file] = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    const maxImportSizeBytes = 5 * 1024 * 1024
    if (file.size > maxImportSizeBytes) {
      showErrorToast(t('dataImportTooLarge'))
      return
    }

    let parsedPayload: unknown
    try {
      const raw = await file.text()
      parsedPayload = JSON.parse(raw) as unknown
    } catch {
      showErrorToast(t('dataImportInvalid'))
      return
    }

    try {
      const importedKind = await importPayload(parsedPayload)
      showSuccessToast(
        importedKind === 'preferences'
          ? t('dataImportPreferencesSuccess')
          : importedKind === 'trip'
            ? t('dataImportTripSuccess')
            : t('dataImportBackupSuccess'),
      )
    } catch (error) {
      showErrorToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : t('dataImportInvalid'),
      )
    }
  }

  const cloudRestoreSuccessMessageByKind = (kind: ParsedImportedData['kind']) => {
    if (kind === 'preferences') {
      return t('cloudRestorePreferencesSuccess')
    }

    if (kind === 'trip') {
      return t('cloudRestoreTripSuccess')
    }

    return t('cloudRestoreBackupSuccess')
  }

  const tryRestoreCloudBackupAfterConnect = async (authState: CloudAuthState) => {
    setIsCloudSyncLoading(true)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      const response = await restoreBackupFromCloud({
        authState,
        fileName: cloudBackupFileName,
      })
      setCloudAuthState(response.authState)
      setCloudLastSyncAt(response.modifiedAt)

      let parsedPayload: unknown
      try {
        parsedPayload = JSON.parse(response.content) as unknown
      } catch {
        throw new Error(t('dataImportInvalid'))
      }

      const imported = parseImportedPayload(parsedPayload)
      if (imported.kind === 'backup' && hasLocalBackupData) {
        if (wouldCloudBackupMergeChangeLocal(imported)) {
          setPendingCloudRestore({
            imported,
            authState: response.authState,
            modifiedAt: response.modifiedAt,
          })
          setCloudSyncMessage(t('cloudRestoreDecisionPrompt'))
        } else {
          setCloudSyncError(null)
          setCloudSyncMessage(t('cloudRestoreAlreadyUpToDate'))
        }
        return
      }

      const importedKind = applyParsedImportedData(imported, { mode: 'replace' })
      setCloudProvider(response.authState.provider)
      cloudLastAutoSyncPayloadRef.current = null
      setCloudSyncError(null)
      setCloudSyncMessage(cloudRestoreSuccessMessageByKind(importedKind))
    } catch (error) {
      if (error instanceof CloudBackupNotFoundError) {
        setCloudSyncError(null)
        setCloudSyncMessage(t('cloudRestoreNotFound'))
        return
      }

      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudRestoreError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    } finally {
      setIsCloudSyncLoading(false)
    }
  }

  useEffect(() => {
    if (cloudOAuthCallbackHandledRef.current) {
      return
    }

    cloudOAuthCallbackHandledRef.current = true

    const handleCloudCallback = async () => {
      const result = await completeCloudOAuthCallback()
      if (result.status === 'none') {
        return
      }

      clearOAuthCallbackQueryParams()

      if (result.status === 'error') {
        setCloudSyncMessage(null)
        setCloudSyncError(
          t('cloudConnectError', {
            message: result.message,
          }),
        )
        return
      }

      setCloudAuthState(result.authState)
      setCloudProvider(result.authState.provider)
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudConnectSuccess'))
      setDataAccordionValue('backup-cloud')
      setShouldRevealCloudPanel(true)
      window.location.hash = cloudDataRouteHash

      await tryRestoreCloudBackupAfterConnect(result.authState)
    }

    void handleCloudCallback()
    // Cet effet doit s'executer une seule fois, protege par cloudOAuthCallbackHandledRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  const applyPendingCloudRestore = (modeToApply: ImportedApplyMode) => {
    if (!pendingCloudRestore) {
      return
    }

    const importedKind = applyParsedImportedData(pendingCloudRestore.imported, {
      mode: modeToApply,
    })
    setCloudAuthState(pendingCloudRestore.authState)
    setCloudProvider(pendingCloudRestore.authState.provider)
    setCloudLastSyncAt(pendingCloudRestore.modifiedAt)
    cloudLastAutoSyncPayloadRef.current = null
    setPendingCloudMergeSyncAuthState(
      modeToApply === 'merge' ? pendingCloudRestore.authState : null,
    )
    setPendingCloudRestore(null)
    setCloudSyncError(null)
    setCloudSyncMessage(
      modeToApply === 'merge'
        ? t('cloudRestoreBackupMerged')
        : cloudRestoreSuccessMessageByKind(importedKind),
    )
  }

  const handleCancelPendingCloudRestore = () => {
    setPendingCloudRestore(null)
    setCloudSyncError(null)
    setCloudSyncMessage(t('cloudRestoreKeepLocal'))
  }

  useEffect(() => {
    if (!pendingCloudMergeSyncAuthState) {
      return
    }

    const authStateToUse = pendingCloudMergeSyncAuthState

    const runMergedBackupSync = async () => {
      setIsCloudSyncLoading(true)
      setCloudSyncError(null)

      try {
        const response = await syncBackupToCloud({
          authState: authStateToUse,
          fileName: cloudBackupFileName,
          content: cloudBackupPayloadContent,
        })
        setCloudAuthState(response.authState)
        setCloudProvider(response.authState.provider)
        setCloudLastSyncAt(response.modifiedAt)
        cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
        setCloudSyncMessage(t('cloudRestoreBackupMergedSynced'))
      } catch (error) {
        setCloudSyncMessage(null)
        setCloudSyncError(
          t('cloudUploadError', {
            message: error instanceof Error ? error.message : t('dataImportInvalid'),
          }),
        )
      } finally {
        setIsCloudSyncLoading(false)
        setPendingCloudMergeSyncAuthState(null)
      }
    }

    void runMergedBackupSync()
  }, [
    cloudBackupFileName,
    cloudBackupPayloadContent,
    pendingCloudMergeSyncAuthState,
    t,
  ])

  const handleCloudConnect = async () => {
    if (!selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudSelectProvider'))
      return
    }

    if (!selectedCloudConfigured) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudProviderMissingClientId'))
      return
    }

    setIsCloudAuthLoading(true)
    setPendingCloudRestore(null)
    setPendingCloudMergeSyncAuthState(null)
    setDataAccordionValue('backup-cloud')
    setShouldRevealCloudPanel(true)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      const authUrl = await startCloudOAuth(selectedCloudProvider, {
        returnHash: cloudDataRouteHash,
      })
      window.location.assign(authUrl)
    } catch (error) {
      setIsCloudAuthLoading(false)
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudConnectError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    }
  }

  const handleCloudDisconnect = async () => {
    setIsCloudAuthLoading(true)
    setPendingCloudRestore(null)
    setPendingCloudMergeSyncAuthState(null)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      await disconnectCloudSession()
      setCloudAuthState(null)
      setCloudLastSyncAt(null)
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudDisconnectSuccess'))
    } catch (error) {
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudDisconnectError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    } finally {
      setIsCloudAuthLoading(false)
    }
  }

  const handleCloudUploadBackup = async () => {
    if (!selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudSelectProvider'))
      return
    }

    if (!selectedCloudConfigured) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudProviderMissingClientId'))
      return
    }

    if (!cloudAuthState || cloudAuthState.provider !== selectedCloudProvider) {
      setCloudSyncMessage(null)
      setCloudSyncError(t('cloudNotConnected'))
      return
    }

    setIsCloudSyncLoading(true)
    setCloudSyncMessage(null)
    setCloudSyncError(null)

    try {
      const response = await syncBackupToCloud({
        authState: cloudAuthState,
        fileName: cloudBackupFileName,
        content: cloudBackupPayloadContent,
      })
      setCloudAuthState(response.authState)
      setCloudLastSyncAt(response.modifiedAt)
      cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
      setCloudSyncError(null)
      setCloudSyncMessage(t('cloudUploadSuccess'))
    } catch (error) {
      setCloudSyncMessage(null)
      setCloudSyncError(
        t('cloudUploadError', {
          message: error instanceof Error ? error.message : t('dataImportInvalid'),
        }),
      )
    } finally {
      setIsCloudSyncLoading(false)
    }
  }

  useEffect(() => {
    if (!cloudAutoBackupEnabled) {
      if (cloudAutoSyncTimerRef.current !== null) {
        window.clearTimeout(cloudAutoSyncTimerRef.current)
        cloudAutoSyncTimerRef.current = null
      }
      return
    }

    if (pendingCloudMergeSyncAuthState) {
      return
    }

    if (!selectedCloudProvider || !selectedCloudConfigured) {
      return
    }

    if (!cloudAuthState || cloudAuthState.provider !== selectedCloudProvider) {
      return
    }

    if (cloudBackupPayloadContent === cloudLastAutoSyncPayloadRef.current) {
      return
    }

    if (cloudAutoSyncTimerRef.current !== null) {
      window.clearTimeout(cloudAutoSyncTimerRef.current)
    }

    cloudAutoSyncTimerRef.current = window.setTimeout(() => {
      const runAutoSync = async () => {
        setIsCloudSyncLoading(true)
        setCloudSyncError(null)

        try {
          const response = await syncBackupToCloud({
            authState: cloudAuthState,
            fileName: cloudBackupFileName,
            content: cloudBackupPayloadContent,
          })
          setCloudAuthState(response.authState)
          setCloudLastSyncAt(response.modifiedAt)
          cloudLastAutoSyncPayloadRef.current = cloudBackupPayloadContent
          setCloudSyncMessage(t('cloudAutoBackupSynced'))
        } catch (error) {
          setCloudSyncMessage(null)
          setCloudSyncError(
            t('cloudUploadError', {
              message: error instanceof Error ? error.message : t('dataImportInvalid'),
            }),
          )
        } finally {
          setIsCloudSyncLoading(false)
        }
      }

      void runAutoSync()
    }, 1200)

    return () => {
      if (cloudAutoSyncTimerRef.current !== null) {
        window.clearTimeout(cloudAutoSyncTimerRef.current)
        cloudAutoSyncTimerRef.current = null
      }
    }
  }, [
    cloudAuthState,
    cloudAutoBackupEnabled,
    cloudBackupFileName,
    cloudBackupPayloadContent,
    pendingCloudMergeSyncAuthState,
    selectedCloudConfigured,
    selectedCloudProvider,
    t,
  ])

  const formatDistance = (distanceMeters: number | null) => {
    if (!distanceMeters || !Number.isFinite(distanceMeters)) {
      return t('placeholderValue')
    }

    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} ${t('unitM')}`
    }

    return `${(distanceMeters / 1000).toFixed(1)} ${t('unitKm')}`
  }

  const formatCoordinate = (value: number) => {
    if (!Number.isFinite(value)) {
      return t('placeholderValue')
    }

    return value.toLocaleString(isFrench ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })
  }

  const toTitleCase = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return trimmed
    }

    return trimmed[0].toLocaleUpperCase(isFrench ? 'fr-FR' : 'en-US') + trimmed.slice(1)
  }

  const formatRawOsmToken = (value: string) =>
    value.trim().replaceAll('_', ' ')

  const normalizeOsmToken = (value: string) =>
    value.trim().toLowerCase()

  const formatPoiTagLabel = (tagKey: string) => {
    const normalized = normalizeOsmToken(tagKey)
    const mapped = osmTagLabels[normalized]
    if (mapped) {
      return isFrench ? mapped.fr : mapped.en
    }

    return toTitleCase(tagKey.replaceAll(':', ' • ').replaceAll('_', ' '))
  }

  const formatPoiTagValue = (tagValue: string) => {
    const tokens = tagValue
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean)

    if (tokens.length === 0) {
      return ''
    }

    const localized = tokens.map((token) => {
      const mapped = osmValueLabels[normalizeOsmToken(token)]
      if (mapped) {
        return isFrench ? mapped.fr : mapped.en
      }

      return formatRawOsmToken(token)
    })

    return localized.join(' ; ')
  }

  const formatPoiKind = (kind: string | null | undefined) => {
    if (!kind) {
      return null
    }

    const separatorIndex = kind.indexOf(':')
    if (separatorIndex <= 0) {
      return toTitleCase(formatPoiTagValue(kind))
    }

    const kindKey = kind.slice(0, separatorIndex)
    const kindValue = kind.slice(separatorIndex + 1)
    return `${formatPoiTagLabel(kindKey)} • ${formatPoiTagValue(kindValue)}`
  }

  const getPoiDisplayName = (poi: PoiItem | null) => {
    if (!poi) {
      return t('poiDetailsTitle')
    }

    const hasExplicitName = Object.keys(poi.tags ?? {}).some((key) => {
      const normalized = key.toLowerCase()
      return normalized === 'name' ||
        normalized === 'name:fr' ||
        normalized === 'name:en' ||
        normalized === 'brand' ||
        normalized === 'operator' ||
        normalized === 'official_name' ||
        normalized === 'int_name'
    })

    if (hasExplicitName && poi.name.trim()) {
      return poi.name
    }

    const kindLabel = formatPoiKind(poi.kind)
    if (kindLabel && kindLabel.includes(' • ')) {
      const parts = kindLabel.split(' • ')
      const last = parts[parts.length - 1]
      return toTitleCase(last)
    }

    if (kindLabel) {
      return toTitleCase(kindLabel)
    }

    return poi.name
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds || !Number.isFinite(seconds)) {
      return t('placeholderValue')
    }

    const totalMinutes = Math.round(seconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours <= 0) {
      return `${minutes} ${t('unitMin')}`
    }

    if (minutes === 0) {
      return `${hours} ${t('unitHour')}`
    }

    return `${hours} ${t('unitHour')} ${minutes} ${t('unitMin')}`
  }

  const computeElevationGain = (profile: RouteElevationPoint[] | null | undefined) => {
    if (!profile || profile.length < 2) {
      return null
    }

    let gain = 0
    for (let i = 1; i < profile.length; i += 1) {
      const delta = profile[i].elevation_m - profile[i - 1].elevation_m
      if (Number.isFinite(delta) && delta > 0) {
        gain += delta
      }
    }

    return gain
  }

  const routeCoordinates = useMemo(
    () => routeResult?.geometry.coordinates ?? [],
    [routeResult?.geometry],
  )
  const routeCumulativeDistances = useMemo(
    () => buildCumulativeDistances(routeCoordinates),
    [routeCoordinates],
  )
  const routeDistanceFromGeometry =
    routeCumulativeDistances.length > 0
      ? routeCumulativeDistances[routeCumulativeDistances.length - 1]
      : 0
  const routeDistanceMeters =
    routeResult?.distance_m ??
    (routeDistanceFromGeometry > 0 ? routeDistanceFromGeometry : null)
  const simulationSpeedKmh =
    mode !== null ? profileSettings.speeds[mode] : defaultProfileSettings.speeds.bike
  const fallbackNavigationSpeedMps = kmhToMps(simulationSpeedKmh)
  const liveNavigationSpeedMps =
    navigationProgress?.speed_mps && navigationProgress.speed_mps > 0.4
      ? navigationProgress.speed_mps
      : fallbackNavigationSpeedMps
  const navigationRemainingMeters =
    isNavigationActive && navigationProgress
      ? Math.max(
          0,
          (routeDistanceFromGeometry > 0 ? routeDistanceFromGeometry : routeDistanceMeters ?? 0) -
            navigationProgress.distance_m,
        )
      : routeDistanceMeters
  const navigationEtaSeconds =
    navigationRemainingMeters !== null && liveNavigationSpeedMps > 0
      ? navigationRemainingMeters / liveNavigationSpeedMps
      : null
  const distanceLabel =
    navigationRemainingMeters !== null
      ? formatDistance(navigationRemainingMeters)
      : t('placeholderValue')
  const etaLabel = navigationEtaSeconds !== null ? formatDuration(navigationEtaSeconds) : t('placeholderValue')
  const navigationProgressPct =
    isNavigationActive && navigationProgress && routeDistanceFromGeometry > 0
      ? Math.max(0, Math.min(100, (navigationProgress.distance_m / routeDistanceFromGeometry) * 100))
      : null
  const elevationGain = routeResult
    ? computeElevationGain(routeResult.elevation_profile)
    : null
  const elevationValueLabel =
    elevationGain !== null ? `${Math.round(elevationGain)} ${t('unitM')}` : t('placeholderValue')
  const elevationHint = routeResult && elevationGain === null ? t('mapElevationUnavailable') : null
  const overlapLabel = routeResult?.kind === 'loop' ? routeResult.overlapScore : null
  const overlapHint =
    overlapLabel === 'faible'
      ? t('mapOverlapLowHelp')
      : overlapLabel === 'moyen'
        ? t('mapOverlapMediumHelp')
        : overlapLabel === 'élevé'
          ? t('mapOverlapHighHelp')
          : null
  const alternativeRouteLabel =
    routeResult?.kind === 'loop'
      ? t('mapRegenerateLoopVariant')
      : t('mapRecalculateRouteVariant')
  const routeBounds = routeResult ? computeRouteBounds(routeResult.geometry) : null
  const expandedRouteBounds = routeBounds ? expandBounds(routeBounds) : null
  const mapStartCoordinate = routeCoordinates.length > 0 ? routeCoordinates[0] : null
  const mapEndCoordinate =
    routeCoordinates.length > 0
      ? routeCoordinates[routeCoordinates.length - 1]
      : null
  const mapTripType: TripType | null = routeResult
    ? routeResult.kind === 'loop'
      ? 'loop'
      : 'oneway'
    : tripType
  const mapStartPlace = mapTripType === 'loop' ? loopStartPlace : onewayStartPlace
  const mapStartValue = mapTripType === 'loop' ? loopStartValue : onewayStartValue
  const startLabel = mapStartPlace?.label ?? mapStartValue.trim()
  const endLabel = endPlace?.label ?? endValue.trim()

  const mapHeaderTitle = hasRoute
    ? routeResult?.kind === 'loop'
      ? t('mapHeaderLoop', {
          start: startLabel || t('placeholderValue'),
        })
      : t('mapHeaderRoute', {
          start: startLabel || t('placeholderValue'),
          end: endLabel || t('placeholderValue'),
        })
    : ''
  const mobileHeaderTitle =
    isMapRoute && hasRoute ? mapHeaderTitle : t('appName')

  const mapOverlayPadding = isDesktop ? 20 : 12
  const viewportHeightUnit = isDesktop ? '100vh' : '100dvh'
  const availableViewportHeight = `calc(${viewportHeightUnit} - ${chromeHeaderHeight + chromeFooterHeight}px)`
  const poiDetourIds = useMemo(() => {
    const ids = new Set<string>()
    for (const point of detourPoints) {
      if (point.poiId) {
        ids.add(point.poiId)
      }
    }
    return ids
  }, [detourPoints])
  const detourSummary = useMemo(() => {
    if (detourPoints.length === 0) {
      return null
    }

    const head = detourPoints.slice(0, 2).map((point) => point.label)
    const suffix = detourPoints.length > 2 ? ` +${detourPoints.length - 2}` : ''
    return `${head.join(' • ')}${suffix}`
  }, [detourPoints])
  const selectedPoiDisplayName = getPoiDisplayName(selectedPoi)
  const selectedPoiCategoryLabel = selectedPoi
    ? poiCategoryLabels[selectedPoi.category]
    : null
  const selectedPoiKind = formatPoiKind(selectedPoi?.kind)
  const selectedPoiTags = useMemo(() => {
    if (!selectedPoi?.tags) {
      return [] as Array<[string, string]>
    }

    return Object.entries(selectedPoi.tags)
      .filter(
        ([key, value]) =>
          Boolean(key?.trim()) &&
          Boolean(value?.trim()),
      )
      .sort(([leftKey], [rightKey]) => {
        const leftIndex = poiPreferredTagOrder.indexOf(leftKey.toLowerCase())
        const rightIndex = poiPreferredTagOrder.indexOf(rightKey.toLowerCase())
        if (leftIndex !== -1 && rightIndex !== -1) {
          return leftIndex - rightIndex
        }
        if (leftIndex !== -1) {
          return -1
        }
        if (rightIndex !== -1) {
          return 1
        }
        return leftKey.localeCompare(rightKey)
      })
  }, [selectedPoi])
  const selectedPoiWebsite =
    selectedPoi?.tags?.website ?? selectedPoi?.tags?.['contact:website'] ?? null

  const handleAddActivePoiAlertWaypoint = async () => {
    if (!activePoiAlert) {
      return
    }

    await handleAddPoiWaypoint(activePoiAlert)
    setActivePoiAlertId(null)
  }

  useEffect(() => {
    if (isNavigationActive) {
      return
    }

    simulationDistanceRef.current = 0
    alertSeenPoiIdsRef.current.clear()
    setNavigationProgress(null)
    setNavigationError(null)
    setActivePoiAlertId(null)
  }, [isNavigationActive])

  useEffect(() => {
    if (!isNavigationActive) {
      return
    }

    if (routeCoordinates.length < 2 || routeCumulativeDistances.length < 2) {
      setNavigationError(t('navigationNoRouteData'))
      return
    }

    alertSeenPoiIdsRef.current.clear()
    setActivePoiAlertId(null)
    setNavigationError(null)

    const initialPoint = sampleRouteAtDistance(
      routeCoordinates,
      routeCumulativeDistances,
      0,
    )
    if (!initialPoint) {
      return
    }

    simulationDistanceRef.current = 0
    setNavigationProgress({
      ...initialPoint,
      source: navigationMode,
      speed_mps: navigationMode === 'simulation' ? kmhToMps(simulationSpeedKmh) : null,
    })
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    simulationSpeedKmh,
    t,
  ])

  useEffect(() => {
    if (
      !isNavigationActive ||
      navigationMode !== 'simulation' ||
      routeCoordinates.length < 2 ||
      routeCumulativeDistances.length < 2 ||
      routeDistanceFromGeometry <= 0
    ) {
      return
    }

    const speedMps = kmhToMps(simulationSpeedKmh)
    let lastTick = performance.now()

    const intervalId = window.setInterval(() => {
      const now = performance.now()
      const deltaSeconds = Math.max(0, (now - lastTick) / 1000)
      lastTick = now

      setNavigationProgress((current) => {
        const currentDistance = current?.distance_m ?? simulationDistanceRef.current
        const nextDistance = Math.min(
          routeDistanceFromGeometry,
          currentDistance + speedMps * deltaSeconds,
        )
        simulationDistanceRef.current = nextDistance

        const sampledPoint = sampleRouteAtDistance(
          routeCoordinates,
          routeCumulativeDistances,
          nextDistance,
        )
        if (!sampledPoint) {
          return current
        }

        return {
          ...sampledPoint,
          source: 'simulation',
          speed_mps: speedMps,
        }
      })
    }, simulationTickMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    routeDistanceFromGeometry,
    simulationSpeedKmh,
  ])

  useEffect(() => {
    if (
      !isNavigationActive ||
      navigationMode !== 'gps' ||
      routeCoordinates.length < 2 ||
      routeCumulativeDistances.length < 2
    ) {
      return
    }

    if (!('geolocation' in navigator)) {
      setNavigationError(t('navigationGpsUnsupported'))
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const projection = projectCoordinateOnRoute(
          [position.coords.longitude, position.coords.latitude],
          routeCoordinates,
          routeCumulativeDistances,
        )
        if (!projection) {
          return
        }

        simulationDistanceRef.current = projection.distance_m
        setNavigationError(null)
        setNavigationProgress({
          ...projection,
          source: 'gps',
          speed_mps:
            typeof position.coords.speed === 'number' && position.coords.speed > 0
              ? position.coords.speed
              : null,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setNavigationError(t('navigationGpsPermissionDenied'))
          return
        }
        if (error.code === error.TIMEOUT) {
          setNavigationError(t('navigationGpsTimeout'))
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          setNavigationError(t('navigationGpsUnavailable'))
          return
        }

        setNavigationError(t('navigationGpsFailed'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    t,
  ])

  useEffect(() => {
    if (
      !isNavigationActive ||
      !poiAlertEnabled ||
      !navigationProgress ||
      poiAlertCategories.length === 0 ||
      poiItems.length === 0
    ) {
      return
    }

    let closestPoi: PoiItem | null = null
    let closestDistance = Number.POSITIVE_INFINITY
    const currentCoordinate: [number, number] = [
      navigationProgress.lon,
      navigationProgress.lat,
    ]

    for (const poi of poiItems) {
      if (!poiAlertCategories.includes(poi.category)) {
        continue
      }
      if (alertSeenPoiIdsRef.current.has(poi.id)) {
        continue
      }

      const poiDistance = haversineDistanceMeters(currentCoordinate, [poi.lon, poi.lat])
      if (poiDistance > poiAlertDistanceMeters || poiDistance >= closestDistance) {
        continue
      }

      closestPoi = poi
      closestDistance = poiDistance
    }

    if (!closestPoi) {
      return
    }

    alertSeenPoiIdsRef.current.add(closestPoi.id)
    setActivePoiAlertId(closestPoi.id)

    if (
      systemNotificationsEnabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const title = t('poiAlertNotificationTitle')
      const body = t('poiAlertNotificationBody', {
        name: closestPoi.name,
        distance: Math.round(closestDistance),
      })
      new Notification(title, { body })
    }
  }, [
    isNavigationActive,
    navigationProgress,
    poiAlertCategories,
    poiAlertDistanceMeters,
    poiAlertEnabled,
    poiItems,
    systemNotificationsEnabled,
    t,
  ])

  useEffect(() => {
    if (!activePoiAlertId) {
      return
    }

    if (poiItems.some((poi) => poi.id === activePoiAlertId)) {
      return
    }

    setActivePoiAlertId(null)
  }, [activePoiAlertId, poiItems])

  const handleExportGpx = async () => {
    if (!routeResult || routeResult.geometry.coordinates.length < 2) {
      setExportError(t('exportGpxFailed'))
      return
    }

    setIsExporting(true)
    setExportError(null)

    try {
      const payload = {
        geometry: routeResult.geometry,
        elevation_profile:
          routeResult.elevation_profile.length > 1
            ? routeResult.elevation_profile
            : null,
        name: mapHeaderTitle || t('exportGpxDefaultName'),
      }

      const response = await fetch(apiPaths.exportGpx, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        setExportError(t('exportGpxFailed'))
        return
      }

      const blob = await response.blob()
      const headerFileName = parseContentDispositionFileName(
        response.headers.get('content-disposition'),
      )
      const fallbackName = buildGpxFileName(
        mapHeaderTitle || t('exportGpxDefaultName'),
      )
      downloadBlob(blob, headerFileName ?? fallbackName)
    } catch {
      setExportError(t('exportGpxFailed'))
    } finally {
      setIsExporting(false)
    }
  }

  const routeErrorDisplayMessage =
    routeErrorMessage ?? (routeErrorKey ? t(routeErrorKey) : null)

  const renderPoiLoadIndicator = (size: 'xs' | 'sm' = 'xs') => {
    if (isPoiLoading) {
      return <Loader size={size} />
    }

    if (poiError && hasPoiFetchCompleted) {
      return (
        <Badge size={size} color="red" variant="light">
          !
        </Badge>
      )
    }

    if (!hasPoiFetchCompleted || !hasPoiCategories) {
      return null
    }

    return (
      <Badge
        size={size}
        variant="light"
        color={visiblePoiItems.length > 0 ? 'blue' : 'gray'}
      >
        {visiblePoiItems.length}
      </Badge>
    )
  }

  const mapSummaryPanelProps = {
    distanceLabel,
    etaLabel,
    overlapLabel,
    overlapHint,
    elevationValueLabel,
    elevationHint,
    detourSummary,
    hasRoute,
    isRouteLoading,
    alternativeRouteLabel,
    isExporting,
    exportError,
    routeErrorMessage: routeErrorDisplayMessage,
    onRecalculateAlternative: handleRecalculateAlternative,
    onOpenNavigationSetup: handleOpenNavigationSetup,
    onExportGpx: handleExportGpx,
    canSaveCurrentLoop: routeResult?.kind === 'loop',
    onSaveCurrentLoop: handleSaveCurrentLoop,
  }
  const canQuickSaveOnewayStart =
    onewayStartPlace !== null && !isPlaceAlreadySavedInAddressBook(onewayStartPlace)
  const canQuickSaveOnewayEnd =
    endPlace !== null && !isPlaceAlreadySavedInAddressBook(endPlace)
  const canQuickSaveLoopStart =
    loopStartPlace !== null && !isPlaceAlreadySavedInAddressBook(loopStartPlace)
  const canSaveAddressBookEntry =
    addressBookPlaceCandidate !== null &&
    !isPlaceAlreadySavedInAddressBook(addressBookPlaceCandidate)
  const deliveryStopsCount = deliveryStopAddresses.length
  const canBuildDeliveryRoute =
    !isRouteLoading &&
    deliveryStartAddress !== null &&
    deliveryStopsCount > 0
  const deliverySummaryLabel =
    deliveryStartAddress !== null && deliveryStopsCount > 0
      ? deliveryReturnToStart
        ? t('deliveryRouteSummaryReturn', {
            start: deliveryStartAddress.name,
            count: deliveryStopsCount,
          })
        : t('deliveryRouteSummaryNoReturn', {
            start: deliveryStartAddress.name,
            count: deliveryStopsCount,
          })
      : t('deliveryRouteSummaryPending')
  const deliveryOrderSummaryLabel = deliveryOptimizeStops
    ? t('deliveryOrderModeOptimized')
    : t('deliveryOrderModeManual')

  const poiPanelProps = {
    poiCategoryOptions,
    poiCategories,
    onPoiCategoryChange: handlePoiCategoryChange,
    poiCorridorMeters,
    onPoiCorridorMetersChange: setPoiCorridorMeters,
    hasPoiCategories,
    isPoiLoading,
    onPoiRefresh: handlePoiRefresh,
    isCustomDetourPanelOpen,
    onToggleCustomDetourPanel: () =>
      setIsCustomDetourPanelOpen((current) => !current),
    detourPoints,
    customDetourValue,
    onCustomDetourValueChange: setCustomDetourValue,
    customDetourPlace,
    onCustomDetourPlaceSelect: setCustomDetourPlace,
    onAddCustomDetourFromAddress: handleAddCustomDetourFromAddress,
    customDetourLat,
    customDetourLon,
    onCustomDetourLatChange: (value: string | number) =>
      setCustomDetourLat(normalizeNumericInput(value)),
    onCustomDetourLonChange: (value: string | number) =>
      setCustomDetourLon(normalizeNumericInput(value)),
    onAddCustomDetourFromCoordinates: handleAddCustomDetourFromCoordinates,
    onRemoveDetourPoint: handleRemoveDetourPoint,
    addressBookEntries: addressBook,
    selectedDeliveryStartId: deliveryStartAddressId,
    selectedDeliveryStopIds: deliveryStopAddressIds,
    onSelectDeliveryStart: handleSelectDeliveryStart,
    onToggleDeliveryStop: handleToggleDeliveryStop,
    onAddAddressBookDetour: handleAddAddressBookDetour,
    deliveryPlannerPanelProps: {
      mode: deliveryMode,
      returnToStart: deliveryReturnToStart,
      optimizeStops: deliveryOptimizeStops,
      stops: deliveryStopAddresses,
      draggedStopId: deliveryDraggedStopId,
      isRouteLoading,
      canBuildRoute: canBuildDeliveryRoute,
      canClearSelection:
        deliveryStartAddressId !== null || deliveryStopAddressIds.length > 0,
      summaryLabel: deliverySummaryLabel,
      orderSummaryLabel: deliveryOrderSummaryLabel,
      onModeChange: handleDeliveryModeChange,
      onReturnToStartChange: setDeliveryReturnToStart,
      onOptimizeStopsChange: setDeliveryOptimizeStops,
      onStopDragStart: handleDeliveryStopDragStart,
      onStopDragOver: handleDeliveryStopDragOver,
      onStopDrop: handleDeliveryStopDrop,
      onStopDragEnd: handleDeliveryStopDragEnd,
      onMoveStop: handleMoveDeliveryStop,
      onBuildRoute: () => {
        void handleBuildDeliveryRoute()
      },
      onClearSelection: handleClearDeliverySelection,
    },
    isRouteLoading,
    poiError,
    poiErrorMessage,
    poiItems: visiblePoiItems,
    selectedPoiId,
    poiDetourIds,
    poiCategoryLabels,
    onPoiSelect: handlePoiSelect,
    onAddPoiWaypoint: handleAddPoiWaypoint,
    getPoiDisplayName,
    formatPoiKind,
    formatDistance,
    borderColor,
    selectedBorderColor: theme.colors.blue[5],
    activeBorderColor: theme.colors.orange[5],
    poiCorridorRange,
  }

  const navigationOptionsPanelProps = {
    navigationMode,
    navigationCameraMode,
    simulationSpeedKmh,
    poiAlertEnabled,
    poiAlertCategories,
    poiAlertDistanceMeters,
    systemNotificationsEnabled,
    notificationsSupported,
    notificationsPermission,
    poiCategoryOptions,
    poiAlertDistanceRange,
    onNavigationModeChange: handleNavigationModeChange,
    onNavigationCameraModeChange: handleNavigationCameraModeChange,
    onPoiAlertEnabledChange: setPoiAlertEnabled,
    onPoiAlertCategoryChange: handlePoiAlertCategoryChange,
    onPoiAlertDistanceMetersChange: setPoiAlertDistanceMeters,
    onSystemNotificationsChange: handleSystemNotificationsChange,
  }
  const renderPlanifier = () => (
    <PlannerPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      theme={theme}
      mode={mode}
      tripType={tripType}
      showLocationInputs={showLocationInputs}
      panelStackStyle={panelStackStyle}
      getPanelStyle={getPanelStyle}
      onModeChange={handleModeChange}
      onTypeChange={handleTypeChange}
      onewayStartValue={onewayStartValue}
      onOnewayStartValueChange={handleOnewayStartValueChange}
      onOnewayStartPlaceSelect={handleOnewayStartPlaceSelect}
      canQuickSaveOnewayStart={canQuickSaveOnewayStart}
      onSaveQuickOnewayStart={() => handleSaveQuickAddress(onewayStartPlace)}
      endValue={endValue}
      onEndValueChange={handleEndValueChange}
      onEndPlaceSelect={handleEndPlaceSelect}
      canQuickSaveOnewayEnd={canQuickSaveOnewayEnd}
      onSaveQuickOnewayEnd={() => handleSaveQuickAddress(endPlace)}
      loopStartValue={loopStartValue}
      onLoopStartValueChange={handleLoopStartValueChange}
      onLoopStartPlaceSelect={handleLoopStartPlaceSelect}
      canQuickSaveLoopStart={canQuickSaveLoopStart}
      onSaveQuickLoopStart={() => handleSaveQuickAddress(loopStartPlace)}
      targetDistanceKm={targetDistanceKm}
      onTargetDistanceChange={handleTargetDistanceChange}
      helperHasMissing={helperHasMissing}
      helperItems={helperItems}
      helperReadyLabel={helperReadyLabel}
      isFormReady={isFormReady}
      isRouteLoading={isRouteLoading}
      onCalculate={handleCalculate}
      ctaLabel={ctaLabel}
      routeErrorMessage={routeErrorDisplayMessage}
    />
  )

  const renderCarte = () => (
    <MapPage
      availableViewportHeight={availableViewportHeight}
      mapBackgroundColor={isDarkTheme ? theme.colors.gray[9] : theme.colors.gray[1]}
      loadingOverlayColor={
        isDarkTheme ? 'rgba(18, 20, 24, 0.62)' : 'rgba(255, 255, 255, 0.64)'
      }
      setupOverlayColor={
        isDarkTheme ? 'rgba(10, 12, 16, 0.62)' : 'rgba(255, 255, 255, 0.62)'
      }
      loadingSpinnerColor={theme.colors.blue[6]}
      routeResult={routeResult}
      expandedRouteBounds={expandedRouteBounds}
      mapViewMode={mapViewMode}
      mapCommand={mapCommand}
      mapCommandSeq={mapCommandSeq}
      poiEnabled={poiEnabled}
      visiblePoiItems={visiblePoiItems}
      selectedPoiId={selectedPoiId}
      onPoiSelect={handlePoiSelect}
      isNavigationActive={isNavigationActive}
      navigationProgress={navigationProgress}
      navigationCameraMode={navigationCameraMode}
      hasRoute={hasRoute}
      mapOverlayPadding={mapOverlayPadding}
      isDesktop={isDesktop}
      isSummaryPanelExpanded={isSummaryPanelExpanded}
      onToggleSummaryPanel={handleToggleSummaryPanel}
      summaryPanelProps={mapSummaryPanelProps}
      isPoiPanelExpanded={isPoiPanelExpanded}
      onTogglePoiPanel={handleTogglePoiPanel}
      poiPanelProps={poiPanelProps}
      renderPoiLoadIndicator={renderPoiLoadIndicator}
      surfaceColor={surfaceColor}
      panelTransitionDuration={panelTransitionDuration}
      panelTransitionTiming={panelTransitionTiming}
      onResetRouteView={() => triggerMapCommand('resetRoute')}
      chromeFooterHeight={chromeFooterHeight}
      isMobileMapPanelExpanded={isMobileMapPanelExpanded}
      onToggleMobileMapPanel={handleToggleMobileMapPanel}
      mobileMapPanelTransition={mobileMapPanelTransition}
      isPoiModalOpen={isPoiModalOpen}
      selectedPoi={selectedPoi}
      selectedPoiDisplayName={selectedPoiDisplayName}
      selectedPoiCategoryLabel={selectedPoiCategoryLabel}
      selectedPoiKind={selectedPoiKind}
      onZoomOutPoi={() => triggerMapCommand('zoomOutPoi')}
      onZoomInPoi={() => triggerMapCommand('zoomInPoi')}
      isRouteLoading={isRouteLoading}
      isMobilePoiDetailsExpanded={isMobilePoiDetailsExpanded}
      onToggleMobilePoiDetails={handleToggleMobilePoiDetails}
      onClosePoiModal={() => setIsPoiModalOpen(false)}
      poiDetourIds={poiDetourIds}
      onAddSelectedPoiWaypoint={() => {
        if (!selectedPoi) {
          return
        }

        void handleAddPoiWaypoint({
          ...selectedPoi,
          name: selectedPoiDisplayName,
        })
      }}
      selectedPoiWebsite={selectedPoiWebsite}
      formatDistance={formatDistance}
      formatCoordinate={formatCoordinate}
      selectedPoiTags={selectedPoiTags}
      formatPoiTagLabel={formatPoiTagLabel}
      formatPoiTagValue={formatPoiTagValue}
      mobilePoiPanelTransition={mobilePoiPanelTransition}
      isNavigationSetupOpen={isNavigationSetupOpen}
      onCloseNavigationSetup={handleCloseNavigationSetup}
      navigationOptionsPanelProps={navigationOptionsPanelProps}
      onStartNavigation={handleStartNavigation}
      navigationMode={navigationMode}
      onExitNavigation={handleExitNavigation}
      distanceLabel={distanceLabel}
      etaLabel={etaLabel}
      navigationProgressPct={navigationProgressPct}
      onNavigationCameraModeChange={handleNavigationCameraModeChange}
      navigationError={navigationError}
      activePoiAlert={activePoiAlert}
      getPoiDisplayName={getPoiDisplayName}
      poiCategoryLabels={poiCategoryLabels}
      onAddActivePoiAlertWaypoint={() => {
        void handleAddActivePoiAlertWaypoint()
      }}
      onDismissPoiAlert={handleDismissPoiAlert}
    />
  )
  const renderProfils = () => (
    <ProfilesPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      profileSettings={profileSettings}
      onSpeedChange={handleSpeedChange}
      onAssistChange={(value) =>
        setProfileSettings((current) => ({
          ...current,
          ebikeAssist: value,
        }))
      }
      onReset={handleResetProfiles}
    />
  )

  const renderDonnees = () => (
    <DataPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isFrench={isFrench}
      surfaceColor={surfaceColor}
      borderColor={borderColor}
      dataAccordionValue={dataAccordionValue}
      onDataAccordionChange={setDataAccordionValue}
      savedTrips={savedTrips}
      onExportBackup={() => {
        void handleExportBackup()
      }}
      onImportData={handleImportData}
      importInputRef={importInputRef}
      onImportFileChange={handleImportFileChange}
      formatDistance={formatDistance}
      onOpenSavedTrip={handleOpenSavedTrip}
      onExportSavedTrip={handleExportSavedTrip}
      onDeleteSavedTrip={handleDeleteSavedTrip}
      hasAnyConfiguredCloudProvider={hasAnyConfiguredCloudProvider}
      cloudProvider={cloudProvider}
      onCloudProviderChange={handleCloudProviderChange}
      cloudProviderControlData={cloudProviderControlData}
      selectedCloudProvider={selectedCloudProvider}
      selectedCloudConfigured={selectedCloudConfigured}
      cloudAuthState={cloudAuthState}
      toCloudProviderLabel={toCloudProviderLabel}
      cloudAccountLabel={cloudAccountLabel}
      cloudLastSyncAt={cloudLastSyncAt}
      cloudBackupFileName={cloudBackupFileName}
      connectedCloudMatchesSelection={connectedCloudMatchesSelection}
      onCloudConnect={() => {
        void handleCloudConnect()
      }}
      onCloudDisconnect={() => {
        void handleCloudDisconnect()
      }}
      isCloudAuthLoading={isCloudAuthLoading}
      isCloudSyncLoading={isCloudSyncLoading}
      cloudAutoBackupEnabled={cloudAutoBackupEnabled}
      onCloudAutoBackupEnabledChange={handleCloudAutoBackupEnabledChange}
      onCloudUploadBackup={() => {
        void handleCloudUploadBackup()
      }}
      cloudSyncMessage={cloudSyncMessage}
      cloudSyncError={cloudSyncError}
      addressBookPanelProps={{
        isDesktop,
        entries: addressBook,
        visibleEntries: visibleAddressBookEntries,
        visibleCount: visibleAddressBookCount,
        filterTag: addressBookFilterTag,
        filterAllValue: addressBookFilterAll,
        filterOptions: addressBookTagOptions,
        nameValue: addressBookNameValue,
        placeValue: addressBookPlaceValue,
        tagsValue: addressBookTagsValue,
        canSave: canSaveAddressBookEntry,
        formatTagLabel: formatAddressTagLabel,
        onNameChange: setAddressBookNameValue,
        onPlaceValueChange: setAddressBookPlaceValue,
        onPlaceSelect: setAddressBookPlaceCandidate,
        onTagsChange: setAddressBookTagsValue,
        onSave: handleSaveAddressBookEntry,
        onFilterChange: handleAddressBookTagFilterChange,
        onDelete: handleDeleteAddressBookEntry,
        onAddTag: handleAddAddressBookTag,
        onDeleteTag: handleDeleteAddressBookTag,
      }}
    />
  )

  const renderAide = () => (
    <HelpPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      isFrench={isFrench}
      theme={theme}
      valhallaStatus={valhallaStatus}
      isValhallaStatusLoading={isValhallaStatusLoading}
      valhallaStatusError={valhallaStatusError}
      valhallaUpdateAvailable={valhallaUpdateAvailable}
      isValhallaBuildRunning={isValhallaBuildRunning}
      cloudDiagnostics={cloudDiagnostics}
      isCloudDiagnosticsLoading={isCloudDiagnosticsLoading}
      cloudDiagnosticsError={cloudDiagnosticsError}
      feedbackSubject={feedbackSubject}
      feedbackContactEmail={feedbackContactEmail}
      feedbackMessage={feedbackMessage}
      isFeedbackSubmitting={isFeedbackSubmitting}
      canSubmitFeedback={canSubmitFeedback}
      feedbackSubmitMessage={feedbackSubmitMessage}
      feedbackSubmitError={feedbackSubmitError}
      onFeedbackSubjectChange={setFeedbackSubject}
      onFeedbackContactEmailChange={setFeedbackContactEmail}
      onFeedbackMessageChange={setFeedbackMessage}
      onSubmitFeedback={() => {
        void handleSubmitDeveloperFeedback()
      }}
    />
  )

  const handleNavigate = (next: RouteKey, force = false) => {
    if (isNavigationActive) {
      setIsNavigationActive(false)
    }
    if (isNavigationSetupOpen) {
      setIsNavigationSetupOpen(false)
    }
    void force
    navigate(next)
  }

  const mainContent = (() => {
    switch (route) {
      case 'carte':
        return renderCarte()
      case 'profils':
        return renderProfils()
      case 'donnees':
        return renderDonnees()
      case 'aide':
        return renderAide()
      default:
        return renderPlanifier()
    }
  })()

  return (
    <AppShell
      padding={0}
      header={showShellHeader ? { height: headerHeight } : undefined}
      footer={
        showShellFooter && !isDesktop ? { height: footerHeight } : undefined
      }
      style={{ minHeight: viewportHeightUnit }}
    >
      {showShellHeader && (
        <AppShell.Header
          style={{
            borderBottom: `1px solid ${borderColor}`,
            background: shellChromeBackground,
            backdropFilter: shellChromeFilter,
            WebkitBackdropFilter: shellChromeFilter,
          }}
        >
          <Container size={contentSize} h="100%">
            <Group justify="space-between" align="center" h="100%" wrap="nowrap">
              {showMobileCompactHeader ? (
                <>
                  <Text fw={600} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                    {mobileHeaderTitle}
                  </Text>
                  <Group gap={6} align="center" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="cyan"
                      radius="xl"
                      size="lg"
                      onClick={() =>
                        void i18n.changeLanguage(language === 'fr' ? 'en' : 'fr')
                      }
                      aria-label={t('settingsLanguageLabel')}
                      title={t('settingsLanguageLabel')}
                    >
                      <Text span fz={17} lh={1}>
                        {language === 'fr' ? '🇫🇷' : '🇬🇧'}
                      </Text>
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color={
                        themeMode === 'auto'
                          ? 'gray'
                          : isDarkTheme
                            ? 'indigo'
                            : 'orange'
                      }
                      radius="xl"
                      size="lg"
                      onClick={() => setColorScheme(nextThemeMode)}
                      aria-label={mobileThemeActionLabel}
                      title={mobileThemeActionLabel}
                    >
                      {isDarkTheme ? <IconMoon size={18} /> : <IconSun size={18} />}
                    </ActionIcon>
                  </Group>
                </>
              ) : (
                <>
                  <Group gap="md" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    {showDesktopMapHeader ? (
                      <Text fw={600} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                        {mapHeaderTitle}
                      </Text>
                    ) : (
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text fw={600}>{t('appName')}</Text>
                        {isDesktop && (
                          <Text size="xs" c="dimmed">
                            {t('tagline')}
                          </Text>
                        )}
                      </Stack>
                    )}
                    {isDesktop && (
                      <Tabs
                        value={route}
                        onChange={(value) =>
                          value ? handleNavigate(value as RouteKey) : null
                        }
                        variant="pills"
                        radius="xl"
                      >
                        <Tabs.List>
                          {navItems.map((item) => (
                            <Tabs.Tab
                              key={item.key}
                              value={item.key}
                              disabled={item.disabled}
                            >
                              {item.label}
                            </Tabs.Tab>
                          ))}
                        </Tabs.List>
                      </Tabs>
                    )}
                  </Group>

                  <Group gap="xs" align="center" wrap="nowrap">
                    {showDesktopMapHeader && (
                      <SegmentedControl
                        size="xs"
                        radius="xl"
                        aria-label={t('mapViewLabel')}
                        value={mapViewMode}
                        onChange={(value) => setMapViewMode(value as MapViewMode)}
                        data={[
                          { label: t('mapView2d'), value: '2d' },
                          { label: t('mapView3d'), value: '3d' },
                        ]}
                      />
                    )}
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      value={language}
                      onChange={(value) => i18n.changeLanguage(value)}
                      data={[
                        { label: 'FR', value: 'fr' },
                        { label: 'EN', value: 'en' },
                      ]}
                    />
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      value={themeMode}
                      onChange={(value) =>
                        setColorScheme(value as 'light' | 'dark' | 'auto')
                      }
                      data={[
                        { label: t('themeAuto'), value: 'auto' },
                        { label: t('themeLight'), value: 'light' },
                        { label: t('themeDark'), value: 'dark' },
                      ]}
                    />
                  </Group>
                </>
              )}
            </Group>
          </Container>
        </AppShell.Header>
      )}

      <AppShell.Main
        style={
          isMapRoute
            ? { overflow: 'hidden' }
            : {
                minHeight: availableViewportHeight,
                background: shellMainBackground,
              }
        }
      >
        {mainContent}
      </AppShell.Main>

      {showShellFooter && !isDesktop && (
        <AppShell.Footer
          style={{
            borderTop: `1px solid ${borderColor}`,
            background: shellChromeBackground,
            backdropFilter: shellChromeFilter,
            WebkitBackdropFilter: shellChromeFilter,
          }}
        >
          <Group
            justify="space-between"
            align="center"
            h="100%"
            px="xs"
            gap={0}
            wrap="nowrap"
          >
            {navItems.map((item) => {
              const isActive = route === item.key
              const Icon = item.icon
              const color = item.disabled
                ? theme.colors.gray[4]
                : isActive
                  ? theme.colors.blue[6]
                  : theme.colors.gray[6]

              return (
                <UnstyledButton
                  key={item.key}
                  onClick={() => !item.disabled && handleNavigate(item.key)}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    minWidth: 0,
                    gap: 4,
                    color,
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <Icon size={20} />
                  <Text
                    size="xs"
                    fw={isActive ? 600 : 500}
                    ta="center"
                    lineClamp={1}
                    style={{ width: '100%' }}
                  >
                    {item.label}
                  </Text>
                </UnstyledButton>
              )
            })}
          </Group>
        </AppShell.Footer>
      )}

      <Modal
        opened={pendingCloudRestore !== null}
        onClose={handleCancelPendingCloudRestore}
        title={t('cloudRestoreDecisionTitle')}
        centered
        radius="md"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {pendingCloudRestore?.modifiedAt
              ? t('cloudRestoreDecisionBodyWithDate', {
                  value: new Date(pendingCloudRestore.modifiedAt).toLocaleString(
                    isFrench ? 'fr-FR' : 'en-US',
                  ),
                })
              : t('cloudRestoreDecisionBody')}
          </Text>
          <Group justify="flex-end" wrap="wrap">
            <Button variant="default" onClick={handleCancelPendingCloudRestore}>
              {t('cloudRestoreDecisionCancel')}
            </Button>
            <Button variant="light" onClick={() => applyPendingCloudRestore('merge')}>
              {t('cloudRestoreDecisionMerge')}
            </Button>
            <Button onClick={() => applyPendingCloudRestore('replace')}>
              {t('cloudRestoreDecisionReplace')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <InstallPrompt />
    </AppShell>
  )
}


