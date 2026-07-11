import { defaultPoiAlertCategories, defaultPoiCategories } from '../../routing/domain'
import { defaultPoiAdvancedFilterSettings } from '../../pois/advancedFilters'
import type { AppPreferences } from './types'

export const appPreferencesStorageKey = 'bv_app_preferences'
export const savedTripsStorageKey = 'bv_saved_trips'
export const savedTripsMaxItems = 60
export const savedTripNameMaxLength = 120
export const savedTripNotesMaxLength = 1000
export const savedTripTagMaxLength = 32
export const savedTripMaxTags = 10
export const addressBookStorageKey = 'bv_address_book'
export const addressBookMaxItems = 400
export const addressBookTagMaxLength = 24

export const defaultAppPreferences: AppPreferences = {
  mapViewMode: '3d',
  navigationMode: 'gps',
  navigationCameraMode: 'follow_3d',
  automaticNavigationRecalculationEnabled: false,
  voiceGuidanceEnabled: false,
  poiAlertEnabled: true,
  poiAlertDistanceMeters: 300,
  poiAlertCategories: defaultPoiAlertCategories,
  poiCategories: defaultPoiCategories,
  poiAdvancedFilterSettings: defaultPoiAdvancedFilterSettings,
  poiCorridorMeters: 800,
  cloudProvider: 'none',
  cloudAutoBackupEnabled: false,
}
