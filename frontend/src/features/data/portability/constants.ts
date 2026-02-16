import { defaultPoiAlertCategories, defaultPoiCategories } from '../../routing/domain'
import type { AppPreferences } from './types'

export const appPreferencesStorageKey = 'bv_app_preferences'
export const savedTripsStorageKey = 'bv_saved_trips'
export const savedTripsMaxItems = 60
export const addressBookStorageKey = 'bv_address_book'
export const addressBookMaxItems = 400
export const addressBookTagMaxLength = 24

export const defaultAppPreferences: AppPreferences = {
  mapViewMode: '3d',
  navigationMode: 'gps',
  navigationCameraMode: 'follow_3d',
  poiAlertEnabled: true,
  poiAlertDistanceMeters: 300,
  poiAlertCategories: defaultPoiAlertCategories,
  poiCategories: defaultPoiCategories,
  poiCorridorMeters: 800,
  cloudProvider: 'none',
  cloudAutoBackupEnabled: false,
}
