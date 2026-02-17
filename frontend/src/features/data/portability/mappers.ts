import {
  clamp,
  isMode,
  isNavigationCameraMode,
  isNavigationMode,
  isTripType,
  normalizeProfileSettings,
  poiAlertDistanceRange,
  poiCorridorRange,
  toStoredTripResult,
  type ProfileSettings,
  type TripType,
} from '../../routing/domain'
import { addressBookMaxItems, defaultAppPreferences, savedTripsMaxItems } from './constants'
import type {
  AddressBookEntry,
  AppPreferences,
  CreateAddressBookEntryParams,
  CreateSavedTripRecordParams,
  ExportedPreferences,
  SavedTripRecord,
} from './types'
import {
  isCloudProvider,
  isMapViewMode,
  isRecord,
  normalizeAddressLabel,
  normalizeAddressName,
  normalizeAddressTags,
  normalizeCategoryList,
  normalizeCoordinate,
  normalizeId,
  normalizeIsoDate,
  normalizeLanguage,
  normalizeOptionalDistance,
  normalizeOptionalLabel,
  normalizeThemeMode,
  normalizeTripName,
} from './validators'

export const normalizeAppPreferences = (
  value: Partial<AppPreferences> | null | undefined,
): AppPreferences => {
  if (!value || typeof value !== 'object') {
    return defaultAppPreferences
  }

  const alertDistance =
    typeof value.poiAlertDistanceMeters === 'number' &&
    Number.isFinite(value.poiAlertDistanceMeters)
      ? clamp(value.poiAlertDistanceMeters, poiAlertDistanceRange.min, poiAlertDistanceRange.max)
      : defaultAppPreferences.poiAlertDistanceMeters

  const corridorDistance =
    typeof value.poiCorridorMeters === 'number' && Number.isFinite(value.poiCorridorMeters)
      ? clamp(value.poiCorridorMeters, poiCorridorRange.min, poiCorridorRange.max)
      : defaultAppPreferences.poiCorridorMeters

  return {
    mapViewMode: isMapViewMode(value.mapViewMode)
      ? value.mapViewMode
      : defaultAppPreferences.mapViewMode,
    navigationMode: isNavigationMode(value.navigationMode)
      ? value.navigationMode
      : defaultAppPreferences.navigationMode,
    navigationCameraMode: isNavigationCameraMode(value.navigationCameraMode)
      ? value.navigationCameraMode
      : defaultAppPreferences.navigationCameraMode,
    poiAlertEnabled:
      typeof value.poiAlertEnabled === 'boolean'
        ? value.poiAlertEnabled
        : defaultAppPreferences.poiAlertEnabled,
    poiAlertDistanceMeters: alertDistance,
    poiAlertCategories: normalizeCategoryList(
      value.poiAlertCategories,
      defaultAppPreferences.poiAlertCategories,
    ),
    poiCategories: normalizeCategoryList(value.poiCategories, defaultAppPreferences.poiCategories),
    poiCorridorMeters: corridorDistance,
    cloudProvider: isCloudProvider(value.cloudProvider)
      ? value.cloudProvider
      : defaultAppPreferences.cloudProvider,
    cloudAutoBackupEnabled:
      typeof value.cloudAutoBackupEnabled === 'boolean'
        ? value.cloudAutoBackupEnabled
        : defaultAppPreferences.cloudAutoBackupEnabled,
  }
}

export const normalizeSavedTripRecord = (value: unknown): SavedTripRecord | null => {
  if (!isRecord(value)) {
    return null
  }

  const parsedTrip = toStoredTripResult(value.trip ?? value.route)
  if (!parsedTrip) {
    return null
  }

  const parsedTripType: TripType = isTripType(value.tripType)
    ? value.tripType
    : parsedTrip.kind === 'loop'
      ? 'loop'
      : 'oneway'

  return {
    id: normalizeId(value.id),
    name: normalizeTripName(value.name, parsedTripType),
    savedAt: normalizeIsoDate(value.savedAt),
    tripType: parsedTripType,
    mode: isMode(value.mode) ? value.mode : null,
    startLabel: normalizeOptionalLabel(value.startLabel),
    endLabel: normalizeOptionalLabel(value.endLabel),
    targetDistanceKm: normalizeOptionalDistance(value.targetDistanceKm),
    trip: parsedTrip,
  }
}

export const sortAndLimitSavedTrips = (items: SavedTripRecord[], maxItems = savedTripsMaxItems) =>
  [...items]
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt))
    .slice(0, Math.max(1, maxItems))

export const normalizeSavedTrips = (value: unknown): SavedTripRecord[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const parsed = value
    .map((entry) => normalizeSavedTripRecord(entry))
    .filter((entry): entry is SavedTripRecord => entry !== null)

  return sortAndLimitSavedTrips(parsed)
}

export const createSavedTripRecord = (params: CreateSavedTripRecordParams): SavedTripRecord => {
  const tripType: TripType = params.trip.kind === 'loop' ? 'loop' : 'oneway'

  return {
    id: normalizeId(null),
    name: normalizeTripName(params.name, tripType),
    savedAt: new Date().toISOString(),
    tripType,
    mode: params.mode,
    startLabel: normalizeOptionalLabel(params.startLabel),
    endLabel: normalizeOptionalLabel(params.endLabel),
    targetDistanceKm: normalizeOptionalDistance(params.targetDistanceKm),
    trip: params.trip,
  }
}

export const upsertSavedTrip = (
  current: SavedTripRecord[],
  next: SavedTripRecord,
): SavedTripRecord[] =>
  sortAndLimitSavedTrips([next, ...current.filter((item) => item.id !== next.id)])

const normalizeAddressBookEntry = (value: unknown): AddressBookEntry | null => {
  if (!isRecord(value)) {
    return null
  }

  const lat = normalizeCoordinate(value.lat, -90, 90)
  const lon = normalizeCoordinate(value.lon, -180, 180)

  if (lat === null || lon === null) {
    return null
  }

  const fallbackLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`
  const label = normalizeAddressLabel(value.label, fallbackLabel)
  const name = normalizeAddressName(value.name, label)

  return {
    id: normalizeId(value.id),
    name,
    label,
    lat,
    lon,
    tags: normalizeAddressTags(value.tags),
    savedAt: normalizeIsoDate(value.savedAt),
    updatedAt: normalizeIsoDate(value.updatedAt ?? value.savedAt),
  }
}

export const sortAndLimitAddressBook = (
  items: AddressBookEntry[],
  maxItems = addressBookMaxItems,
) =>
  [...items]
    .sort((left, right) => {
      const nameOrder = left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
      if (nameOrder !== 0) {
        return nameOrder
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    })
    .slice(0, Math.max(1, maxItems))

export const normalizeAddressBook = (value: unknown): AddressBookEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const parsed = value
    .map((entry) => normalizeAddressBookEntry(entry))
    .filter((entry): entry is AddressBookEntry => entry !== null)

  return sortAndLimitAddressBook(parsed)
}

export const createAddressBookEntry = (params: CreateAddressBookEntryParams): AddressBookEntry => {
  const now = new Date().toISOString()

  return {
    id: normalizeId(null),
    name: normalizeAddressName(params.name, params.place.label),
    label: normalizeAddressLabel(params.place.label, params.name),
    lat: params.place.lat,
    lon: params.place.lon,
    tags: normalizeAddressTags(params.tags),
    savedAt: now,
    updatedAt: now,
  }
}

export const upsertAddressBookEntry = (
  current: AddressBookEntry[],
  next: AddressBookEntry,
): AddressBookEntry[] => {
  const normalizedName = normalizeAddressName(next.name, next.label)
  const normalizedLabel = normalizeAddressLabel(next.label, normalizedName)
  const now = new Date().toISOString()
  const preparedNext: AddressBookEntry = {
    ...next,
    name: normalizedName,
    label: normalizedLabel,
    tags: normalizeAddressTags(next.tags),
    updatedAt: now,
  }

  const duplicate = current.find((entry) => {
    if (entry.id === preparedNext.id) {
      return false
    }

    const sameCoordinates =
      Math.abs(entry.lat - preparedNext.lat) < 0.00001 &&
      Math.abs(entry.lon - preparedNext.lon) < 0.00001
    if (!sameCoordinates) {
      return false
    }

    return entry.name.toLowerCase() === preparedNext.name.toLowerCase()
  })

  if (duplicate) {
    const merged: AddressBookEntry = {
      ...preparedNext,
      id: duplicate.id,
      tags: normalizeAddressTags([...duplicate.tags, ...preparedNext.tags]),
      savedAt: duplicate.savedAt,
    }
    return sortAndLimitAddressBook([
      merged,
      ...current.filter((entry) => entry.id !== duplicate.id),
    ])
  }

  return sortAndLimitAddressBook([
    preparedNext,
    ...current.filter((entry) => entry.id !== preparedNext.id),
  ])
}

export const hasPreferenceFields = (value: Record<string, unknown>) =>
  'profileSettings' in value ||
  'profile' in value ||
  'appPreferences' in value ||
  'app' in value ||
  'language' in value ||
  'themeMode' in value ||
  'speeds' in value

export const normalizeExportedPreferences = (value: unknown): ExportedPreferences | null => {
  if (!isRecord(value)) {
    return null
  }

  const sourceProfile = isRecord(value.profileSettings)
    ? value.profileSettings
    : isRecord(value.profile)
      ? value.profile
      : value
  const sourceApp = isRecord(value.appPreferences)
    ? value.appPreferences
    : isRecord(value.app)
      ? value.app
      : null

  return {
    profileSettings: normalizeProfileSettings(sourceProfile as Partial<ProfileSettings>),
    appPreferences: normalizeAppPreferences(sourceApp as Partial<AppPreferences> | null),
    language: normalizeLanguage(value.language),
    themeMode: normalizeThemeMode(value.themeMode),
  }
}
