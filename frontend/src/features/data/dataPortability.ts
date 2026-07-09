export {
  addressBookMaxItems,
  addressBookStorageKey,
  appPreferencesStorageKey,
  defaultAppPreferences,
  savedTripMaxTags,
  savedTripNameMaxLength,
  savedTripNotesMaxLength,
  savedTripTagMaxLength,
  savedTripsMaxItems,
  savedTripsStorageKey,
} from './portability/constants'
export { loadAddressBook, loadAppPreferences, loadSavedTrips } from './portability/io'
export {
  createAddressBookEntry,
  createSavedTripRecord,
  duplicateSavedTrip,
  normalizeAddressBook,
  normalizeAppPreferences,
  normalizeSavedTrips,
  sortAndLimitAddressBook,
  sortAndLimitSavedTrips,
  updateSavedTripMetadata,
  upsertAddressBookEntry,
  upsertSavedTrip,
} from './portability/mappers'
export { parseImportedBikeVoyagerData } from './portability/importers'
export {
  buildBackupExport,
  buildPreferencesExport,
  buildTripExport,
} from './portability/exporters/json'
export {
  buildGpxFileName,
  buildSavedTripGpxFileName,
  downloadBlob,
} from './portability/exporters/gpx'
export type {
  AddressBookEntry,
  AppPreferences,
  BikeVoyagerBackupExport,
  BikeVoyagerPreferencesExport,
  BikeVoyagerTripExport,
  CloudProvider,
  ExportedPreferences,
  ParsedImportedData,
  SavedTripMetadataInput,
  SavedTripRecord,
  SupportedLanguage,
  ThemeModePreference,
} from './portability/types'
