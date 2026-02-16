import {
  clamp,
  defaultPoiAlertCategories,
  defaultPoiCategories,
  isMode,
  isNavigationCameraMode,
  isNavigationMode,
  isTripType,
  normalizePlannerDraft,
  normalizeProfileSettings,
  poiAlertDistanceRange,
  poiCorridorRange,
  toStoredTripResult,
} from '../routing/domain'
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
} from '../routing/domain'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isMapViewMode = (value: unknown): value is MapViewMode =>
  value === '2d' || value === '3d'

const isPoiCategory = (value: unknown): value is PoiCategory =>
  value === 'monuments' ||
  value === 'paysages' ||
  value === 'commerces' ||
  value === 'services'

const normalizeCategoryList = (
  value: unknown,
  fallback: PoiCategory[],
): PoiCategory[] => {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const unique = Array.from(new Set(value.filter(isPoiCategory)))
  return unique.length > 0 ? unique : [...fallback]
}

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString()
}

const normalizeOptionalLabel = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeOptionalDistance = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

const normalizeId = (value: unknown) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizeTripName = (value: unknown, tripType: TripType) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return tripType === 'loop' ? 'Boucle' : 'Trajet'
}

const normalizeCoordinate = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    return null
  }

  return value
}

const normalizeAddressName = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return fallback
}

const normalizeAddressLabel = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return fallback
}

const addressBookTagMaxLength = 24

const normalizeAddressTag = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }

  return normalized.slice(0, addressBookTagMaxLength)
}

const normalizeAddressTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const tags: string[] = []
  for (const rawTag of value) {
    const tag = normalizeAddressTag(rawTag)
    if (!tag || tags.includes(tag)) {
      continue
    }

    tags.push(tag)
  }

  return tags
}

export type CloudProvider = 'none' | 'onedrive' | 'google-drive'
export type ThemeModePreference = 'auto' | 'light' | 'dark'
export type SupportedLanguage = 'fr' | 'en'

const isCloudProvider = (value: unknown): value is CloudProvider =>
  value === 'none' || value === 'onedrive' || value === 'google-drive'

const isThemeModePreference = (value: unknown): value is ThemeModePreference =>
  value === 'auto' || value === 'light' || value === 'dark'

const normalizeLanguage = (value: unknown): SupportedLanguage =>
  value === 'en' ? 'en' : 'fr'

const normalizeThemeMode = (value: unknown): ThemeModePreference =>
  isThemeModePreference(value) ? value : 'auto'

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

export const appPreferencesStorageKey = 'bv_app_preferences'
export const savedTripsStorageKey = 'bv_saved_trips'
export const savedTripsMaxItems = 60
export const addressBookStorageKey = 'bv_address_book'
export const addressBookMaxItems = 400

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

export const normalizeAppPreferences = (
  value: Partial<AppPreferences> | null | undefined,
): AppPreferences => {
  if (!value || typeof value !== 'object') {
    return defaultAppPreferences
  }

  const alertDistance =
    typeof value.poiAlertDistanceMeters === 'number' && Number.isFinite(value.poiAlertDistanceMeters)
      ? clamp(
          value.poiAlertDistanceMeters,
          poiAlertDistanceRange.min,
          poiAlertDistanceRange.max,
        )
      : defaultAppPreferences.poiAlertDistanceMeters

  const corridorDistance =
    typeof value.poiCorridorMeters === 'number' && Number.isFinite(value.poiCorridorMeters)
      ? clamp(
          value.poiCorridorMeters,
          poiCorridorRange.min,
          poiCorridorRange.max,
        )
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
    poiCategories: normalizeCategoryList(
      value.poiCategories,
      defaultAppPreferences.poiCategories,
    ),
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

export const loadAppPreferences = (): AppPreferences => {
  if (typeof window === 'undefined') {
    return defaultAppPreferences
  }

  const raw = localStorage.getItem(appPreferencesStorageKey)
  if (!raw) {
    return defaultAppPreferences
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppPreferences>
    return normalizeAppPreferences(parsed)
  } catch {
    return defaultAppPreferences
  }
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

const normalizeSavedTripRecord = (value: unknown): SavedTripRecord | null => {
  if (!isRecord(value)) {
    return null
  }

  const parsedTrip = toStoredTripResult(value.trip ?? value.route)
  if (!parsedTrip) {
    return null
  }

  const parsedTripType = isTripType(value.tripType)
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

export const sortAndLimitSavedTrips = (
  items: SavedTripRecord[],
  maxItems = savedTripsMaxItems,
) =>
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

export const loadSavedTrips = (): SavedTripRecord[] => {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = localStorage.getItem(savedTripsStorageKey)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeSavedTrips(parsed)
  } catch {
    return []
  }
}

export const createSavedTripRecord = (params: {
  trip: TripResult
  mode: Mode | null
  startLabel: string | null
  endLabel: string | null
  targetDistanceKm: number | ''
  name: string
}): SavedTripRecord => {
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
  sortAndLimitSavedTrips([
    next,
    ...current.filter((item) => item.id !== next.id),
  ])

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

export const loadAddressBook = (): AddressBookEntry[] => {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = localStorage.getItem(addressBookStorageKey)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeAddressBook(parsed)
  } catch {
    return []
  }
}

export const createAddressBookEntry = (params: {
  name: string
  place: PlaceCandidate
  tags?: string[]
}): AddressBookEntry => {
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
  plannerDraft: PlannerDraft
  currentRoute: TripResult | null
  savedTrips: SavedTripRecord[]
  addressBook: AddressBookEntry[]
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

const hasPreferenceFields = (value: Record<string, unknown>) =>
  'profileSettings' in value ||
  'profile' in value ||
  'appPreferences' in value ||
  'app' in value ||
  'language' in value ||
  'themeMode' in value ||
  'speeds' in value

const normalizeExportedPreferences = (value: unknown): ExportedPreferences | null => {
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
    profileSettings: normalizeProfileSettings(
      sourceProfile as Partial<ProfileSettings>,
    ),
    appPreferences: normalizeAppPreferences(
      sourceApp as Partial<AppPreferences> | null,
    ),
    language: normalizeLanguage(value.language),
    themeMode: normalizeThemeMode(value.themeMode),
  }
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

export const parseImportedBikeVoyagerData = (
  value: unknown,
): ParsedImportedData | null => {
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
      plannerDraft: normalizePlannerDraft(
        value.plannerDraft as Partial<PlannerDraft> | null,
      ),
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
      plannerDraft: normalizePlannerDraft(
        value.plannerDraft as Partial<PlannerDraft> | null,
      ),
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

