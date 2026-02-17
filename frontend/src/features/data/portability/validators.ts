import type { MapViewMode, PoiCategory, TripType } from '../../routing/domain'
import { addressBookTagMaxLength } from './constants'
import type { CloudProvider, SupportedLanguage, ThemeModePreference } from './types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

export const isMapViewMode = (value: unknown): value is MapViewMode =>
  value === '2d' || value === '3d'

export const isPoiCategory = (value: unknown): value is PoiCategory =>
  value === 'monuments' || value === 'paysages' || value === 'commerces' || value === 'services'

export const normalizeCategoryList = (value: unknown, fallback: PoiCategory[]): PoiCategory[] => {
  if (!Array.isArray(value)) {
    return [...fallback]
  }

  const unique = Array.from(new Set(value.filter(isPoiCategory)))
  return unique.length > 0 ? unique : [...fallback]
}

export const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== 'string') {
    return new Date().toISOString()
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString()
}

export const normalizeOptionalLabel = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const normalizeOptionalDistance = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

export const normalizeId = (value: unknown) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const normalizeTripName = (value: unknown, tripType: TripType) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return tripType === 'loop' ? 'Boucle' : 'Trajet'
}

export const normalizeCoordinate = (value: unknown, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    return null
  }

  return value
}

export const normalizeAddressName = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return fallback
}

export const normalizeAddressLabel = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return fallback
}

export const normalizeAddressTag = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    return null
  }

  return normalized.slice(0, addressBookTagMaxLength)
}

export const normalizeAddressTags = (value: unknown): string[] => {
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

export const isCloudProvider = (value: unknown): value is CloudProvider =>
  value === 'none' || value === 'onedrive' || value === 'google-drive'

const isThemeModePreference = (value: unknown): value is ThemeModePreference =>
  value === 'auto' || value === 'light' || value === 'dark'

export const normalizeLanguage = (value: unknown): SupportedLanguage =>
  value === 'en' ? 'en' : 'fr'

export const normalizeThemeMode = (value: unknown): ThemeModePreference =>
  isThemeModePreference(value) ? value : 'auto'
