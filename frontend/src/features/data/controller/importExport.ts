import type { TFunction } from 'i18next'
import type { AppStore } from '../../../state/appStore'
import {
  parseImportedBikeVoyagerData,
  sortAndLimitAddressBook,
  sortAndLimitSavedTrips,
  upsertSavedTrip,
  type AddressBookEntry,
  type ExportedPreferences,
  type ParsedImportedData,
  type SavedTripRecord,
} from '../dataPortability'
import { toCanonicalJson } from '../importDataUtils'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from '../types'
import { assertPayloadIsImportable } from './crypto'
import { mergeAddressBookEntries, mergeSavedTripsById } from './storage'
import { shouldImportPlannerDraft } from './validators'

type ThemeModeSetter = (value: 'light' | 'dark' | 'auto') => void

type DataImportStoreSlice = Pick<
  AppStore,
  | 'routeResult'
  | 'setProfileSettings'
  | 'setPoiAlertEnabled'
  | 'setPoiAlertDistanceMeters'
  | 'setPoiAlertCategories'
  | 'setPoiCategories'
  | 'setPoiCorridorMeters'
  | 'setCloudProvider'
  | 'setCloudAutoBackupEnabled'
  | 'setMode'
  | 'setTripType'
  | 'setOnewayStartValue'
  | 'setOnewayStartPlace'
  | 'setLoopStartValue'
  | 'setLoopStartPlace'
  | 'setEndValue'
  | 'setEndPlace'
  | 'setTargetDistanceKm'
  | 'setSavedTrips'
  | 'setAddressBook'
  | 'setRouteResult'
  | 'setHasResult'
  | 'setIsDirty'
  | 'setDetourPoints'
  | 'setDeliveryStartAddressId'
  | 'setDeliveryStopAddressIds'
  | 'setRouteAlternativeIndex'
  | 'setLoopAlternativeIndex'
  | 'setRouteErrorKey'
  | 'setRouteErrorMessage'
>

const applyImportedPreferences = (
  store: DataImportStoreSlice,
  setThemeMode: ThemeModeSetter,
  preferences: ExportedPreferences,
) => {
  store.setProfileSettings(preferences.profileSettings)
  store.setPoiAlertEnabled(preferences.appPreferences.poiAlertEnabled)
  store.setPoiAlertDistanceMeters(preferences.appPreferences.poiAlertDistanceMeters)
  store.setPoiAlertCategories(preferences.appPreferences.poiAlertCategories)
  store.setPoiCategories(preferences.appPreferences.poiCategories)
  store.setPoiCorridorMeters(preferences.appPreferences.poiCorridorMeters)
  store.setCloudProvider(preferences.appPreferences.cloudProvider)
  store.setCloudAutoBackupEnabled(preferences.appPreferences.cloudAutoBackupEnabled)
  setThemeMode(preferences.themeMode)
}

const applyImportedPlannerDraft = (
  store: DataImportStoreSlice,
  draft: Extract<ParsedImportedData, { kind: 'backup' }>['plannerDraft'],
) => {
  store.setMode(draft.mode)
  store.setTripType(draft.tripType)
  store.setOnewayStartValue(draft.onewayStartValue)
  store.setOnewayStartPlace(draft.onewayStartPlace)
  store.setLoopStartValue(draft.loopStartValue)
  store.setLoopStartPlace(draft.loopStartPlace)
  store.setEndValue(draft.endValue)
  store.setEndPlace(draft.endPlace)
  store.setTargetDistanceKm(draft.targetDistanceKm)
}

type ApplyParsedImportedDataParams = {
  store: DataImportStoreSlice
  setThemeMode: ThemeModeSetter
  imported: ParsedImportedData
  hasPlannerDraftContent: boolean
  options?: { mode?: ImportedDataApplyMode }
}

export const applyParsedImportedData = ({
  store,
  setThemeMode,
  imported,
  hasPlannerDraftContent,
  options,
}: ApplyParsedImportedDataParams): ImportedDataApplyResult => {
  const modeToApply = options?.mode ?? 'replace'
  if (imported.kind === 'preferences') {
    applyImportedPreferences(store, setThemeMode, imported.preferences)
    return imported.kind
  }

  if (imported.kind === 'trip') {
    store.setSavedTrips((current) => upsertSavedTrip(current, imported.trip))
    return imported.kind
  }

  if (modeToApply === 'merge') {
    store.setSavedTrips((current) => mergeSavedTripsById(current, imported.savedTrips))
    store.setAddressBook((current) =>
      mergeAddressBookEntries(current, imported.addressBook),
    )

    if (shouldImportPlannerDraft(hasPlannerDraftContent, imported.plannerDraft)) {
      applyImportedPlannerDraft(store, imported.plannerDraft)
    }

    if (!store.routeResult && imported.currentRoute) {
      store.setRouteResult(imported.currentRoute)
      store.setHasResult(true)
      store.setIsDirty(false)
      store.setDetourPoints([])
      store.setRouteAlternativeIndex(0)
      store.setLoopAlternativeIndex(0)
      store.setRouteErrorKey(null)
      store.setRouteErrorMessage(null)
    }

    return imported.kind
  }

  applyImportedPreferences(store, setThemeMode, imported.preferences)
  applyImportedPlannerDraft(store, imported.plannerDraft)
  store.setSavedTrips(sortAndLimitSavedTrips(imported.savedTrips))
  store.setAddressBook(sortAndLimitAddressBook(imported.addressBook))
  store.setRouteResult(imported.currentRoute)
  store.setHasResult(Boolean(imported.currentRoute))
  store.setIsDirty(false)
  store.setDetourPoints([])
  store.setDeliveryStartAddressId(null)
  store.setDeliveryStopAddressIds([])
  store.setRouteAlternativeIndex(0)
  store.setLoopAlternativeIndex(0)
  store.setRouteErrorKey(null)
  store.setRouteErrorMessage(null)
  return imported.kind
}

export const parseImportedPayload = (payload: unknown, t: TFunction) => {
  assertPayloadIsImportable(payload, t)
  const imported = parseImportedBikeVoyagerData(payload)
  if (!imported) {
    throw new Error(t('dataImportInvalid'))
  }
  return imported
}

type CloudBackupMergeCheckParams = {
  importedBackup: Extract<ParsedImportedData, { kind: 'backup' }>
  currentSavedTrips: SavedTripRecord[]
  currentAddressBook: AddressBookEntry[]
  currentRouteResult: AppStore['routeResult']
  hasPlannerDraftContent: boolean
}

export const wouldCloudBackupMergeChangeLocal = ({
  importedBackup,
  currentSavedTrips,
  currentAddressBook,
  currentRouteResult,
  hasPlannerDraftContent,
}: CloudBackupMergeCheckParams) => {
  const mergedSavedTrips = mergeSavedTripsById(
    currentSavedTrips,
    importedBackup.savedTrips,
  )
  const mergedAddressBook = mergeAddressBookEntries(
    currentAddressBook,
    importedBackup.addressBook,
  )
  const savedTripsChanged =
    toCanonicalJson(mergedSavedTrips) !== toCanonicalJson(currentSavedTrips)
  const addressBookChanged =
    toCanonicalJson(mergedAddressBook) !== toCanonicalJson(currentAddressBook)
  const plannerDraftWouldBeImported = shouldImportPlannerDraft(
    hasPlannerDraftContent,
    importedBackup.plannerDraft,
  )
  const routeWouldBeImported =
    !currentRouteResult && importedBackup.currentRoute !== null

  return (
    savedTripsChanged ||
    addressBookChanged ||
    plannerDraftWouldBeImported ||
    routeWouldBeImported
  )
}

export const getCloudRestoreSuccessMessageByKind = (
  kind: ParsedImportedData['kind'],
  t: TFunction,
) => {
  if (kind === 'preferences') {
    return t('cloudRestorePreferencesSuccess')
  }
  if (kind === 'trip') {
    return t('cloudRestoreTripSuccess')
  }
  return t('cloudRestoreBackupSuccess')
}

export const serializeJsonContent = (payload: unknown) =>
  `${JSON.stringify(payload, null, 2)}\n`
