import {
  addressBookStorageKey,
  appPreferencesStorageKey,
  defaultAppPreferences,
  savedTripsStorageKey,
} from './constants'
import {
  normalizeAddressBook,
  normalizeAppPreferences,
  normalizeSavedTrips,
} from './mappers'
import type { AddressBookEntry, AppPreferences, SavedTripRecord } from './types'

const loadRawStorageValue = (storageKey: string) => {
  if (typeof window === 'undefined') {
    return null
  }

  return localStorage.getItem(storageKey)
}

const parseStorageJson = (raw: string | null): unknown | null => {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

const loadFromLocalStorage = <T>(params: {
  storageKey: string
  fallback: T
  normalize: (value: unknown) => T
}): T => {
  const raw = loadRawStorageValue(params.storageKey)
  const parsed = parseStorageJson(raw)
  if (parsed === null) {
    return params.fallback
  }

  return params.normalize(parsed)
}

export const loadAppPreferences = (): AppPreferences =>
  loadFromLocalStorage({
    storageKey: appPreferencesStorageKey,
    fallback: defaultAppPreferences,
    normalize: (value) => normalizeAppPreferences(value as Partial<AppPreferences>),
  })

export const loadSavedTrips = (): SavedTripRecord[] =>
  loadFromLocalStorage({
    storageKey: savedTripsStorageKey,
    fallback: [],
    normalize: normalizeSavedTrips,
  })

export const loadAddressBook = (): AddressBookEntry[] =>
  loadFromLocalStorage({
    storageKey: addressBookStorageKey,
    fallback: [],
    normalize: normalizeAddressBook,
  })
