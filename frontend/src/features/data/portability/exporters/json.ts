import { normalizePlannerDraft } from '../../../routing/domain'
import { sortAndLimitAddressBook, sortAndLimitSavedTrips } from '../mappers'
import type {
  BikeVoyagerBackupExport,
  BikeVoyagerPreferencesExport,
  BikeVoyagerTripExport,
  ExportedPreferences,
  SavedTripRecord,
} from '../types'

export const buildPreferencesExport = (
  preferences: ExportedPreferences,
): BikeVoyagerPreferencesExport => ({
  format: 'bikevoyager-preferences',
  version: 1,
  exportedAt: new Date().toISOString(),
  preferences,
})

export const buildBackupExport = (params: {
  preferences: ExportedPreferences
  plannerDraft: BikeVoyagerBackupExport['plannerDraft']
  currentRoute: BikeVoyagerBackupExport['currentRoute']
  savedTrips: SavedTripRecord[]
  addressBook: BikeVoyagerBackupExport['addressBook']
}): BikeVoyagerBackupExport => ({
  format: 'bikevoyager-backup',
  version: 1,
  exportedAt: new Date().toISOString(),
  preferences: params.preferences,
  plannerDraft: normalizePlannerDraft(params.plannerDraft),
  currentRoute: params.currentRoute,
  savedTrips: sortAndLimitSavedTrips(params.savedTrips),
  addressBook: sortAndLimitAddressBook(params.addressBook),
})

export const buildTripExport = (trip: SavedTripRecord): BikeVoyagerTripExport => ({
  format: 'bikevoyager-trip',
  version: 1,
  exportedAt: new Date().toISOString(),
  trip,
})
