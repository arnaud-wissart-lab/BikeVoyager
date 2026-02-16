import type {
  MapViewMode,
  Mode,
  NavigationCameraMode,
  NavigationMode,
  PlaceCandidate,
  PlannerDraft,
  PoiCategory,
  ProfileSettings,
  TripResult,
  TripType,
} from '../../routing/domain'

export type CloudProvider = 'none' | 'onedrive' | 'google-drive'
export type ThemeModePreference = 'auto' | 'light' | 'dark'
export type SupportedLanguage = 'fr' | 'en'

export type AppPreferences = {
  mapViewMode: MapViewMode
  navigationMode: NavigationMode
  navigationCameraMode: NavigationCameraMode
  poiAlertEnabled: boolean
  poiAlertDistanceMeters: number
  poiAlertCategories: PoiCategory[]
  poiCategories: PoiCategory[]
  poiCorridorMeters: number
  cloudProvider: CloudProvider
  cloudAutoBackupEnabled: boolean
}

export type SavedTripRecord = {
  id: string
  name: string
  savedAt: string
  tripType: TripType
  mode: Mode | null
  startLabel: string | null
  endLabel: string | null
  targetDistanceKm: number | null
  trip: TripResult
}

export type AddressBookEntry = {
  id: string
  name: string
  label: string
  lat: number
  lon: number
  tags: string[]
  savedAt: string
  updatedAt: string
}

export type ExportedPreferences = {
  profileSettings: ProfileSettings
  appPreferences: AppPreferences
  language: SupportedLanguage
  themeMode: ThemeModePreference
}

export type BikeVoyagerPreferencesExport = {
  format: 'bikevoyager-preferences'
  version: 1
  exportedAt: string
  preferences: ExportedPreferences
}

export type BikeVoyagerBackupExport = {
  format: 'bikevoyager-backup'
  version: 1
  exportedAt: string
  preferences: ExportedPreferences
  plannerDraft: PlannerDraft
  currentRoute: TripResult | null
  savedTrips: SavedTripRecord[]
  addressBook: AddressBookEntry[]
}

export type BikeVoyagerTripExport = {
  format: 'bikevoyager-trip'
  version: 1
  exportedAt: string
  trip: SavedTripRecord
}

export type ParsedImportedData =
  | {
      kind: 'preferences'
      preferences: ExportedPreferences
    }
  | {
      kind: 'backup'
      preferences: ExportedPreferences
      plannerDraft: PlannerDraft
      currentRoute: TripResult | null
      savedTrips: SavedTripRecord[]
      addressBook: AddressBookEntry[]
    }
  | {
      kind: 'trip'
      trip: SavedTripRecord
    }

export type CreateSavedTripRecordParams = {
  trip: TripResult
  mode: Mode | null
  startLabel: string | null
  endLabel: string | null
  targetDistanceKm: number | ''
  name: string
}

export type CreateAddressBookEntryParams = {
  name: string
  place: PlaceCandidate
  tags?: string[]
}
