import {
  defaultProfileSettings,
  emptyPlannerDraft,
  plannerDraftStorageKey,
  profileStorageKey,
  routeStorageKey,
  speedRanges,
} from './constants'
import { isAssistLevel, isMode, isTripType } from './guards'
import { clamp } from './math'
import type {
  PlaceCandidate,
  PlannerDraft,
  ProfileSettings,
  RouteElevationPoint,
  RouteResult,
  TripResult,
} from './types'

export const normalizeProfileSettings = (
  value: Partial<ProfileSettings> | null | undefined,
): ProfileSettings => {
  const walk = value?.speeds?.walk
  const bike = value?.speeds?.bike
  const ebike = value?.speeds?.ebike

  return {
    speeds: {
      walk:
        typeof walk === 'number'
          ? clamp(walk, speedRanges.walk.min, speedRanges.walk.max)
          : defaultProfileSettings.speeds.walk,
      bike:
        typeof bike === 'number'
          ? clamp(bike, speedRanges.bike.min, speedRanges.bike.max)
          : defaultProfileSettings.speeds.bike,
      ebike:
        typeof ebike === 'number'
          ? clamp(ebike, speedRanges.ebike.min, speedRanges.ebike.max)
          : defaultProfileSettings.speeds.ebike,
    },
    ebikeAssist: isAssistLevel(value?.ebikeAssist)
      ? value.ebikeAssist
      : defaultProfileSettings.ebikeAssist,
  }
}

export const loadProfileSettings = (): ProfileSettings => {
  if (typeof window === 'undefined') {
    return defaultProfileSettings
  }

  const raw = localStorage.getItem(profileStorageKey)
  if (!raw) {
    return defaultProfileSettings
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>
    return normalizeProfileSettings(parsed)
  } catch {
    return defaultProfileSettings
  }
}

export const toStoredPlaceCandidate = (value: unknown): PlaceCandidate | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PlaceCandidate>
  if (
    typeof candidate.label !== 'string' ||
    candidate.label.trim().length === 0 ||
    typeof candidate.lat !== 'number' ||
    !Number.isFinite(candidate.lat) ||
    typeof candidate.lon !== 'number' ||
    !Number.isFinite(candidate.lon)
  ) {
    return null
  }

  return {
    label: candidate.label,
    lat: candidate.lat,
    lon: candidate.lon,
    score:
      typeof candidate.score === 'number' && Number.isFinite(candidate.score) ? candidate.score : 1,
    source:
      typeof candidate.source === 'string' && candidate.source.trim().length > 0
        ? candidate.source
        : 'stored',
    postcode: typeof candidate.postcode === 'string' ? candidate.postcode : undefined,
    city: typeof candidate.city === 'string' ? candidate.city : undefined,
    department: typeof candidate.department === 'string' ? candidate.department : undefined,
    inseeCode: typeof candidate.inseeCode === 'string' ? candidate.inseeCode : undefined,
  }
}

export const loadPlannerDraft = (): PlannerDraft => {
  if (typeof window === 'undefined') {
    return emptyPlannerDraft
  }

  const raw = localStorage.getItem(plannerDraftStorageKey)
  if (!raw) {
    return emptyPlannerDraft
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlannerDraft>
    return normalizePlannerDraft(parsed)
  } catch {
    return emptyPlannerDraft
  }
}

export const normalizePlannerDraft = (
  value: Partial<PlannerDraft> | null | undefined,
): PlannerDraft => {
  if (!value || typeof value !== 'object') {
    return emptyPlannerDraft
  }

  const targetDistance =
    typeof value.targetDistanceKm === 'number' && Number.isFinite(value.targetDistanceKm)
      ? value.targetDistanceKm
      : ''

  return {
    mode: isMode(value.mode) ? value.mode : null,
    tripType: isTripType(value.tripType) ? value.tripType : null,
    onewayStartValue: typeof value.onewayStartValue === 'string' ? value.onewayStartValue : '',
    onewayStartPlace: toStoredPlaceCandidate(value.onewayStartPlace),
    loopStartValue: typeof value.loopStartValue === 'string' ? value.loopStartValue : '',
    loopStartPlace: toStoredPlaceCandidate(value.loopStartPlace),
    endValue: typeof value.endValue === 'string' ? value.endValue : '',
    endPlace: toStoredPlaceCandidate(value.endPlace),
    targetDistanceKm: targetDistance,
  }
}

export const toStoredTripResult = (value: unknown): TripResult | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as TripResult
  if (candidate?.geometry?.type !== 'LineString') {
    return null
  }

  const normalizeElevationProfile = (profile: unknown): RouteElevationPoint[] => {
    if (!Array.isArray(profile)) {
      return []
    }

    return profile
      .map((point) => {
        if (!point || typeof point !== 'object') {
          return null
        }

        const entry = point as Partial<RouteElevationPoint>
        if (
          typeof entry.distance_m !== 'number' ||
          !Number.isFinite(entry.distance_m) ||
          typeof entry.elevation_m !== 'number' ||
          !Number.isFinite(entry.elevation_m)
        ) {
          return null
        }

        return {
          distance_m: entry.distance_m,
          elevation_m: entry.elevation_m,
        }
      })
      .filter((point): point is RouteElevationPoint => point !== null)
  }

  if (candidate.kind === 'route' || candidate.kind === 'loop') {
    return {
      ...candidate,
      elevation_profile: normalizeElevationProfile(
        (candidate as Partial<TripResult>).elevation_profile,
      ),
    }
  }

  const legacy = value as Omit<RouteResult, 'kind'> & {
    elevation_profile?: unknown
  }
  return {
    ...legacy,
    kind: 'route',
    elevation_profile: normalizeElevationProfile(legacy.elevation_profile),
  }
}

export const loadStoredRoute = (): TripResult | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(routeStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return toStoredTripResult(parsed)
  } catch {
    return null
  }
}
