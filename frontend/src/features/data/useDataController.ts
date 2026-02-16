import { useCallback, useEffect, useMemo, type ChangeEvent } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { useDataFeatureSlice } from './useDataFeatureSlice'
import {
  addressBookStorageKey,
  appPreferencesStorageKey,
  buildBackupExport,
  buildTripExport,
  createAddressBookEntry,
  createSavedTripRecord,
  parseImportedBikeVoyagerData,
  savedTripsStorageKey,
  sortAndLimitAddressBook,
  sortAndLimitSavedTrips,
  upsertAddressBookEntry,
  upsertSavedTrip,
  type AddressBookEntry,
  type AppPreferences,
  type ExportedPreferences,
  type ParsedImportedData,
  type SavedTripRecord,
  type SupportedLanguage,
  type ThemeModePreference,
} from './dataPortability'
import {
  addressBookFilterAll,
  formatAddressTagFallbackLabel,
  maxAddressBookTagsPerEntry,
  moveIdByDirection,
  parseAddressTagsInput,
  reorderIdsByDragAndDrop,
} from './addressBookUtils'
import {
  hasPlannerDraftData,
  toCanonicalJson,
} from './importDataUtils'
import { isEncryptedBikeVoyagerPayload } from './dataEncryption'
import {
  apiModeByUi,
  downloadBlob,
  isMode,
  normalizeNumericInput,
  profileStorageKey,
  routeOptionVariants,
  type DetourPoint,
  type MapViewMode,
  type PlannerDraft,
  type PlaceCandidate,
  type RouteLocation,
  type RouteRequestPayload,
} from '../routing/domain'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from './types'

type UseDataControllerParams = {
  store: AppStore
  t: TFunction
  language: 'fr' | 'en'
  themeMode: 'light' | 'dark' | 'auto'
  setThemeMode: (value: 'light' | 'dark' | 'auto') => void
  mapViewMode: MapViewMode
  mapHeaderTitle: string
  startLabel: string
  showSuccessToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
  showErrorToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
  requestRoute: (
    payload: RouteRequestPayload,
    nextDetours?: DetourPoint[],
  ) => Promise<boolean>
}

const buildDateStamp = () => new Date().toISOString().slice(0, 10)
const serializeJsonContent = (payload: unknown) => `${JSON.stringify(payload, null, 2)}\n`

export const useDataController = ({
  store,
  t,
  language,
  themeMode,
  setThemeMode,
  mapViewMode,
  mapHeaderTitle,
  startLabel,
  showSuccessToast,
  showErrorToast,
  requestRoute,
}: UseDataControllerParams) => {
  const {
    routeResult,
    savedTrips,
    addressBook,
    addressBookFilterTag,
    addressBookNameValue,
    addressBookTagsValue,
    addressBookPlaceCandidate,
    deliveryStartAddressId,
    deliveryStopAddressIds,
    deliveryReturnToStart,
    deliveryOptimizeStops,
    deliveryMode,
    mode,
    tripType,
    onewayStartValue,
    onewayStartPlace,
    loopStartValue,
    loopStartPlace,
    endValue,
    endPlace,
    targetDistanceKm,
    profileSettings,
    cloudProvider,
    cloudAutoBackupEnabled,
    poiAlertEnabled,
    poiAlertDistanceMeters,
    poiAlertCategories,
    poiCategories,
    poiCorridorMeters,
    navigationMode,
    navigationCameraMode,
    setSavedTrips,
    setAddressBook,
    setAddressBookFilterTag,
    setAddressBookNameValue,
    setAddressBookPlaceValue,
    setAddressBookTagsValue,
    setAddressBookPlaceCandidate,
    setDeliveryStartAddressId,
    setDeliveryStopAddressIds,
    setDeliveryReturnToStart,
    setDeliveryOptimizeStops,
    setDeliveryDraggedStopId,
    setDeliveryMode,
    setMode,
    setTripType,
    setOnewayStartValue,
    setOnewayStartPlace,
    setLoopStartValue,
    setLoopStartPlace,
    setEndValue,
    setEndPlace,
    setTargetDistanceKm,
    setProfileSettings,
    setCloudProvider,
    setCloudAutoBackupEnabled,
    setPoiAlertEnabled,
    setPoiAlertDistanceMeters,
    setPoiAlertCategories,
    setPoiCategories,
    setPoiCorridorMeters,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    setRouteAlternativeIndex,
    setLoopAlternativeIndex,
    setRouteErrorKey,
    setRouteErrorMessage,
    importInputRef,
  } = store

  const {
    addressBookById,
    addressBookTagOptions,
    visibleAddressBookEntries,
    visibleAddressBookCount,
  } = useDataFeatureSlice({
    addressBook,
    filterTag: addressBookFilterTag,
  })

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
    if (!place || isPlaceAlreadySavedInAddressBook(place)) {
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
      options: routeOptionVariants[0],
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

  const downloadJsonFile = (payload: unknown, fileName: string) => {
    const content = serializeJsonContent(payload)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    downloadBlob(blob, fileName)
  }

  const exportPayloadAsJsonFile = async (params: {
    payload: unknown
    fileNamePrefix: string
    successMessage: string
  }) => {
    const fileName = `${params.fileNamePrefix}-${buildDateStamp()}.json`
    downloadJsonFile(params.payload, fileName)
    showSuccessToast(params.successMessage)
  }

  const applyImportedPreferences = (preferences: ExportedPreferences) => {
    setProfileSettings(preferences.profileSettings)
    setPoiAlertEnabled(preferences.appPreferences.poiAlertEnabled)
    setPoiAlertDistanceMeters(preferences.appPreferences.poiAlertDistanceMeters)
    setPoiAlertCategories(preferences.appPreferences.poiAlertCategories)
    setPoiCategories(preferences.appPreferences.poiCategories)
    setPoiCorridorMeters(preferences.appPreferences.poiCorridorMeters)
    setCloudProvider(preferences.appPreferences.cloudProvider)
    setCloudAutoBackupEnabled(preferences.appPreferences.cloudAutoBackupEnabled)
    setThemeMode(preferences.themeMode)
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

  const applyParsedImportedData = (
    imported: ParsedImportedData,
    options?: { mode?: ImportedDataApplyMode },
  ): ImportedDataApplyResult => {
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
    options?: { mode?: ImportedDataApplyMode },
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

  const cloudRestoreSuccessMessageByKind = (kind: ParsedImportedData['kind']) => {
    if (kind === 'preferences') {
      return t('cloudRestorePreferencesSuccess')
    }
    if (kind === 'trip') {
      return t('cloudRestoreTripSuccess')
    }
    return t('cloudRestoreBackupSuccess')
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
  }

  const handleDeleteSavedTrip = (tripId: string) => {
    setSavedTrips((current) => current.filter((trip) => trip.id !== tripId))
    showSuccessToast(t('dataSavedTripDeleted'))
  }

  const handleExportSavedTrip = async (trip: SavedTripRecord) => {
    await exportPayloadAsJsonFile({
      payload: buildTripExport(trip),
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

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
      parsedPayload = JSON.parse(await file.text()) as unknown
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
  }, [addressBook, setDeliveryDraggedStopId, setDeliveryStartAddressId, setDeliveryStopAddressIds])

  useEffect(() => {
    if (addressBookFilterTag === addressBookFilterAll) {
      return
    }
    if (addressBookTagOptions.includes(addressBookFilterTag)) {
      return
    }
    setAddressBookFilterTag(addressBookFilterAll)
  }, [addressBookFilterTag, addressBookTagOptions, setAddressBookFilterTag])

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
    !store.isRouteLoading && deliveryStartAddress !== null && deliveryStopsCount > 0
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

  return {
    appPreferences,
    addressBookById,
    addressBookTagOptions,
    visibleAddressBookEntries,
    visibleAddressBookCount,
    deliveryStartAddress,
    deliveryStopAddresses,
    formatAddressTagLabel,
    handleSaveAddressBookEntry,
    handleSaveQuickAddress,
    handleDeleteAddressBookEntry,
    handleDeleteAddressBookTag,
    handleAddAddressBookTag,
    handleDeliveryModeChange,
    handleSelectDeliveryStart,
    handleToggleDeliveryStop,
    handleMoveDeliveryStop,
    reorderDeliveryStops,
    handleClearDeliverySelection,
    handleBuildDeliveryRoute,
    handleSaveCurrentLoop,
    handleOpenSavedTrip,
    handleDeleteSavedTrip,
    handleExportSavedTrip,
    handleExportBackup,
    handleImportData,
    handleImportFileChange,
    buildBackupPayload,
    cloudBackupPayloadContent,
    importPayload,
    parseImportedPayload,
    applyParsedImportedData,
    wouldCloudBackupMergeChangeLocal,
    cloudRestoreSuccessMessageByKind,
    hasPlannerDraftContent,
    hasLocalBackupData,
    canQuickSaveOnewayStart,
    canQuickSaveOnewayEnd,
    canQuickSaveLoopStart,
    canSaveAddressBookEntry,
    canBuildDeliveryRoute,
    deliverySummaryLabel,
    deliveryOrderSummaryLabel,
    setAddressBookFilterTag,
    setDeliveryReturnToStart,
    setDeliveryOptimizeStops,
    setDeliveryDraggedStopId,
    normalizeNumericInput,
    addressBookFilterAll,
  }
}
