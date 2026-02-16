import { useCallback, useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { useDataFeatureSlice } from './useDataFeatureSlice'
import {
  buildBackupExport,
  parseImportedBikeVoyagerData,
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
import { addressBookFilterAll } from './addressBookUtils'
import { hasPlannerDraftData, toCanonicalJson } from './importDataUtils'
import { isEncryptedBikeVoyagerPayload } from './dataEncryption'
import {
  normalizeNumericInput,
  type DetourPoint,
  type MapViewMode,
  type PlannerDraft,
  type RouteRequestPayload,
} from '../routing/domain'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from './types'
import { createDataAddressBookActions } from './useDataController.addressBookActions'
import { useDataControllerPersistence } from './useDataController.persistence'
import { createDataRouteActions } from './useDataController.routeDataActions'

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
    deliveryStartAddressId,
    deliveryStopAddressIds,
    deliveryReturnToStart,
    deliveryOptimizeStops,
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
    setDeliveryStartAddressId,
    setDeliveryStopAddressIds,
    setDeliveryDraggedStopId,
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

  const addressBookActions = createDataAddressBookActions({
    store,
    t,
    addressBookById,
    deliveryStartAddress,
    deliveryStopAddresses,
    requestRoute,
    showSuccessToast,
    showErrorToast,
  })

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

  const routeDataActions = createDataRouteActions({
    store,
    t,
    startLabel,
    mapHeaderTitle,
    buildBackupPayload,
    importPayload,
    showSuccessToast,
    showErrorToast,
  })

  useDataControllerPersistence({
    profileSettings,
    appPreferences,
    savedTrips,
    addressBook,
    addressBookFilterTag,
    addressBookTagOptions,
    setAddressBookFilterTag,
    setDeliveryStartAddressId,
    setDeliveryStopAddressIds,
    setDeliveryDraggedStopId,
  })

  const canQuickSaveOnewayStart =
    onewayStartPlace !== null &&
    !addressBookActions.isPlaceAlreadySavedInAddressBook(onewayStartPlace)
  const canQuickSaveOnewayEnd =
    endPlace !== null && !addressBookActions.isPlaceAlreadySavedInAddressBook(endPlace)
  const canQuickSaveLoopStart =
    loopStartPlace !== null &&
    !addressBookActions.isPlaceAlreadySavedInAddressBook(loopStartPlace)
  const canSaveAddressBookEntry =
    store.addressBookPlaceCandidate !== null &&
    !addressBookActions.isPlaceAlreadySavedInAddressBook(store.addressBookPlaceCandidate)
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
    formatAddressTagLabel: addressBookActions.formatAddressTagLabel,
    handleSaveAddressBookEntry: addressBookActions.handleSaveAddressBookEntry,
    handleSaveQuickAddress: addressBookActions.handleSaveQuickAddress,
    handleDeleteAddressBookEntry: addressBookActions.handleDeleteAddressBookEntry,
    handleDeleteAddressBookTag: addressBookActions.handleDeleteAddressBookTag,
    handleAddAddressBookTag: addressBookActions.handleAddAddressBookTag,
    handleDeliveryModeChange: addressBookActions.handleDeliveryModeChange,
    handleSelectDeliveryStart: addressBookActions.handleSelectDeliveryStart,
    handleToggleDeliveryStop: addressBookActions.handleToggleDeliveryStop,
    handleMoveDeliveryStop: addressBookActions.handleMoveDeliveryStop,
    reorderDeliveryStops: addressBookActions.reorderDeliveryStops,
    handleClearDeliverySelection: addressBookActions.handleClearDeliverySelection,
    handleBuildDeliveryRoute: addressBookActions.handleBuildDeliveryRoute,
    handleSaveCurrentLoop: routeDataActions.handleSaveCurrentLoop,
    handleOpenSavedTrip: routeDataActions.handleOpenSavedTrip,
    handleDeleteSavedTrip: routeDataActions.handleDeleteSavedTrip,
    handleExportSavedTrip: routeDataActions.handleExportSavedTrip,
    handleExportBackup: routeDataActions.handleExportBackup,
    handleImportData: routeDataActions.handleImportData,
    handleImportFileChange: routeDataActions.handleImportFileChange,
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
    setDeliveryReturnToStart: store.setDeliveryReturnToStart,
    setDeliveryOptimizeStops: store.setDeliveryOptimizeStops,
    setDeliveryDraggedStopId,
    normalizeNumericInput,
    addressBookFilterAll,
  }
}
