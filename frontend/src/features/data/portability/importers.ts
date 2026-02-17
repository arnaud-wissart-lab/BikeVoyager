import type { PlannerDraft } from '../../routing/domain'
import { normalizePlannerDraft, toStoredTripResult } from '../../routing/domain'
import {
  hasPreferenceFields,
  normalizeAddressBook,
  normalizeExportedPreferences,
  normalizeSavedTripRecord,
  normalizeSavedTrips,
} from './mappers'
import type { ParsedImportedData } from './types'
import { isRecord } from './validators'

export const parseImportedBikeVoyagerData = (value: unknown): ParsedImportedData | null => {
  if (!isRecord(value)) {
    return null
  }

  const format = typeof value.format === 'string' ? value.format.toLowerCase() : null

  if (format === 'bikevoyager-preferences') {
    const preferences = normalizeExportedPreferences(value.preferences)
    if (!preferences) {
      return null
    }
    return { kind: 'preferences', preferences }
  }

  if (format === 'bikevoyager-trip') {
    const trip = normalizeSavedTripRecord(value.trip)
    if (!trip) {
      return null
    }
    return { kind: 'trip', trip }
  }

  if (format === 'bikevoyager-backup') {
    const preferences = normalizeExportedPreferences(value.preferences)
    if (!preferences) {
      return null
    }

    return {
      kind: 'backup',
      preferences,
      plannerDraft: normalizePlannerDraft(value.plannerDraft as Partial<PlannerDraft> | null),
      currentRoute: toStoredTripResult(value.currentRoute),
      savedTrips: normalizeSavedTrips(value.savedTrips),
      addressBook: normalizeAddressBook(value.addressBook),
    }
  }

  if ('trip' in value || 'route' in value) {
    const trip = normalizeSavedTripRecord(value.trip ?? value)
    if (!trip) {
      return null
    }
    return { kind: 'trip', trip }
  }

  if (
    'currentRoute' in value ||
    'plannerDraft' in value ||
    'savedTrips' in value ||
    'addressBook' in value ||
    'preferences' in value
  ) {
    const preferencesSource = isRecord(value.preferences) ? value.preferences : value
    const preferences = normalizeExportedPreferences(preferencesSource)
    if (!preferences) {
      return null
    }

    return {
      kind: 'backup',
      preferences,
      plannerDraft: normalizePlannerDraft(value.plannerDraft as Partial<PlannerDraft> | null),
      currentRoute: toStoredTripResult(value.currentRoute),
      savedTrips: normalizeSavedTrips(value.savedTrips),
      addressBook: normalizeAddressBook(value.addressBook),
    }
  }

  if (hasPreferenceFields(value)) {
    const preferences = normalizeExportedPreferences(value)
    if (!preferences) {
      return null
    }
    return { kind: 'preferences', preferences }
  }

  return null
}
