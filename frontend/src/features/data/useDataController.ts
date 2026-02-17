import { useCallback, useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { useDataFeatureSlice } from './useDataFeatureSlice'
import {
  buildBackupExport,
  sortAndLimitAddressBook,
  sortAndLimitSavedTrips,
  type AddressBookEntry,
  type AppPreferences,
  type ParsedImportedData,
} from './dataPortability'
import { addressBookFilterAll } from './addressBookUtils'
import {
  normalizeNumericInput,
  type DetourPoint,
  type MapViewMode,
  type RouteRequestPayload,
} from '../routing/domain'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from './types'
import { createDataAddressBookActions } from './useDataController.addressBookActions'
import { useDataControllerPersistence } from './useDataController.persistence'
import { createDataRouteActions } from './useDataController.routeDataActions'
import {
  applyParsedImportedData as applyParsedImportedDataCore,
  getCloudRestoreSuccessMessageByKind,
  parseImportedPayload as parseImportedPayloadCore,
  serializeJsonContent,
  wouldCloudBackupMergeChangeLocal as wouldCloudBackupMergeChangeLocalCore,
} from './controller/importExport'
import { buildExportedPreferences, buildPlannerDraftSnapshot } from './controller/mappers'
import { hasAnyLocalBackupData, hasPlannerDraftSnapshotData } from './controller/validators'

type UseDataControllerParams = {
  store: AppStore
  t: TFunction
  language: 'fr' | 'en'
  themeMode: 'light' | 'dark' | 'auto'
  setThemeMode: (value: 'light' | 'dark' | 'auto') => void
  mapViewMode: MapViewMode
  mapHeaderTitle: string
  startLabel: string
  showSuccessToast: (message: string, options?: { title?: string; durationMs?: number }) => void
  showErrorToast: (message: string, options?: { title?: string; durationMs?: number }) => void
  requestRoute: (payload: RouteRequestPayload, nextDetours?: DetourPoint[]) => Promise<boolean>
}

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
    setAddressBookFilterTag,
    setDeliveryStartAddressId,
    setDeliveryStopAddressIds,
    setDeliveryDraggedStopId,
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
    ? (addressBookById.get(deliveryStartAddressId) ?? null)
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
        preferences: buildExportedPreferences({
          profileSettings,
          appPreferences,
          language,
          themeMode,
        }),
        plannerDraft: buildPlannerDraftSnapshot({
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

  const plannerDraftSnapshot = useMemo(
    () =>
      buildPlannerDraftSnapshot({
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
    [
      endPlace,
      endValue,
      loopStartPlace,
      loopStartValue,
      mode,
      onewayStartPlace,
      onewayStartValue,
      targetDistanceKm,
      tripType,
    ],
  )

  const hasPlannerDraftContent = hasPlannerDraftSnapshotData(plannerDraftSnapshot)

  const hasLocalBackupData = hasAnyLocalBackupData({
    hasPlannerDraftContent,
    routeResult,
    savedTrips,
    addressBook,
  })

  const applyParsedImportedData = (
    imported: ParsedImportedData,
    options?: { mode?: ImportedDataApplyMode },
  ): ImportedDataApplyResult =>
    applyParsedImportedDataCore({
      store,
      setThemeMode,
      imported,
      hasPlannerDraftContent,
      options,
    })

  const parseImportedPayload = (payload: unknown) => parseImportedPayloadCore(payload, t)

  const importPayload = async (payload: unknown, options?: { mode?: ImportedDataApplyMode }) => {
    const imported = parseImportedPayload(payload)
    return applyParsedImportedData(imported, options)
  }

  const wouldCloudBackupMergeChangeLocal = (
    imported: Extract<ParsedImportedData, { kind: 'backup' }>,
  ) =>
    wouldCloudBackupMergeChangeLocalCore({
      importedBackup: imported,
      currentSavedTrips: savedTrips,
      currentAddressBook: addressBook,
      currentRouteResult: routeResult,
      hasPlannerDraftContent,
    })

  const cloudRestoreSuccessMessageByKind = (kind: ParsedImportedData['kind']) =>
    getCloudRestoreSuccessMessageByKind(kind, t)

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
    loopStartPlace !== null && !addressBookActions.isPlaceAlreadySavedInAddressBook(loopStartPlace)
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
