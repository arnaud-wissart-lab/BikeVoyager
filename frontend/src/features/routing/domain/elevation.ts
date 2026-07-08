import type { AssistLevel, Mode, RouteElevationPoint } from './types'

type ElevationProfilePointInput = {
  distance_m?: number | null
  elevation_m?: number | null
}

export type ElevationProfileInput = Array<ElevationProfilePointInput | null | undefined>

export type ElevationMinMax = {
  min: number
  max: number
}

export type ElevationStats = {
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  elevationMinMax: ElevationMinMax | null
  maxSlopePercent: number | null
  isAvailable: boolean
}

export type RouteDifficulty = 'easy' | 'moderate' | 'demanding' | 'hard'

type DifficultyThreshold = {
  distanceMeters: number
  gainMeters: number
  gainPerKm: number
  maxSlopePercent: number
}

type DifficultyLevel = Exclude<RouteDifficulty, 'easy'>

export const reliableSlopeMinimumDistanceMeters = 20
export const routeDifficultyMinimumDistanceMeters = 500

// Ces seuils sont heuristiques: ils donnent un repère vélo/VAE lisible, pas une mesure sportive.
const difficultyThresholds: Record<Mode, Record<DifficultyLevel, DifficultyThreshold>> = {
  walk: {
    moderate: { distanceMeters: 8000, gainMeters: 200, gainPerKm: 35, maxSlopePercent: 8 },
    demanding: { distanceMeters: 16000, gainMeters: 500, gainPerKm: 60, maxSlopePercent: 12 },
    hard: { distanceMeters: 26000, gainMeters: 900, gainPerKm: 90, maxSlopePercent: 16 },
  },
  bike: {
    moderate: { distanceMeters: 25000, gainMeters: 300, gainPerKm: 25, maxSlopePercent: 6 },
    demanding: { distanceMeters: 60000, gainMeters: 800, gainPerKm: 40, maxSlopePercent: 10 },
    hard: {
      distanceMeters: 100000,
      gainMeters: 1400,
      gainPerKm: 60,
      maxSlopePercent: 14,
    },
  },
  ebike: {
    moderate: { distanceMeters: 35000, gainMeters: 500, gainPerKm: 30, maxSlopePercent: 8 },
    demanding: { distanceMeters: 85000, gainMeters: 1200, gainPerKm: 45, maxSlopePercent: 12 },
    hard: {
      distanceMeters: 140000,
      gainMeters: 2000,
      gainPerKm: 65,
      maxSlopePercent: 16,
    },
  },
}

const ebikeAssistThresholdFactors: Record<AssistLevel, number> = {
  low: 0.9,
  medium: 1,
  high: 1.12,
}

const isFinitePositiveOrZero = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const normalizeElevationProfile = (
  profile: ElevationProfileInput | null | undefined,
): RouteElevationPoint[] => {
  const points: RouteElevationPoint[] = []

  for (const point of profile ?? []) {
    const distanceMeters = point?.distance_m
    const elevationMeters = point?.elevation_m

    if (
      typeof distanceMeters !== 'number' ||
      typeof elevationMeters !== 'number' ||
      !Number.isFinite(distanceMeters) ||
      !Number.isFinite(elevationMeters) ||
      distanceMeters < 0
    ) {
      continue
    }

    if (points.length > 0 && distanceMeters <= points[points.length - 1].distance_m) {
      continue
    }

    points.push({
      distance_m: distanceMeters,
      elevation_m: elevationMeters,
    })
  }

  return points
}

type ElevationSegment = {
  distanceDelta: number
  elevationDelta: number
}

const getElevationSegments = (
  profile: ElevationProfileInput | null | undefined,
  minimumDistanceMeters = 0,
): ElevationSegment[] => {
  const points = normalizeElevationProfile(profile)
  const segments: ElevationSegment[] = []

  for (let index = 1; index < points.length; index += 1) {
    const distanceDelta = points[index].distance_m - points[index - 1].distance_m

    if (distanceDelta <= 0 || distanceDelta < minimumDistanceMeters) {
      continue
    }

    segments.push({
      distanceDelta,
      elevationDelta: points[index].elevation_m - points[index - 1].elevation_m,
    })
  }

  return segments
}

export const computeElevationGain = (profile: ElevationProfileInput | null | undefined) => {
  const segments = getElevationSegments(profile)
  if (segments.length === 0) {
    return null
  }

  let gain = 0
  for (const segment of segments) {
    if (segment.elevationDelta > 0) {
      gain += segment.elevationDelta
    }
  }

  return gain
}

export const computeElevationLoss = (profile: ElevationProfileInput | null | undefined) => {
  const segments = getElevationSegments(profile)
  if (segments.length === 0) {
    return null
  }

  let loss = 0
  for (const segment of segments) {
    if (segment.elevationDelta < 0) {
      loss += Math.abs(segment.elevationDelta)
    }
  }

  return loss
}

export const computeElevationMinMax = (
  profile: ElevationProfileInput | null | undefined,
): ElevationMinMax | null => {
  const points = normalizeElevationProfile(profile)
  if (points.length < 2) {
    return null
  }

  let min = points[0].elevation_m
  let max = points[0].elevation_m

  for (const point of points) {
    min = Math.min(min, point.elevation_m)
    max = Math.max(max, point.elevation_m)
  }

  return { min, max }
}

export const computeMaxSlope = (profile: ElevationProfileInput | null | undefined) => {
  const segments = getElevationSegments(profile, reliableSlopeMinimumDistanceMeters)
  if (segments.length === 0) {
    return null
  }

  let maxSlope = 0
  for (const segment of segments) {
    const slope = Math.max(0, (segment.elevationDelta / segment.distanceDelta) * 100)
    maxSlope = Math.max(maxSlope, slope)
  }

  return maxSlope
}

export const computeElevationStats = (
  profile: ElevationProfileInput | null | undefined,
): ElevationStats => {
  const normalizedProfile = normalizeElevationProfile(profile)
  const isAvailable = normalizedProfile.length >= 2

  if (!isAvailable) {
    return {
      elevationGainMeters: null,
      elevationLossMeters: null,
      elevationMinMax: null,
      maxSlopePercent: null,
      isAvailable: false,
    }
  }

  return {
    elevationGainMeters: computeElevationGain(normalizedProfile),
    elevationLossMeters: computeElevationLoss(normalizedProfile),
    elevationMinMax: computeElevationMinMax(normalizedProfile),
    maxSlopePercent: computeMaxSlope(normalizedProfile),
    isAvailable: true,
  }
}

const reachesThreshold = (
  distanceMeters: number,
  elevationGainMeters: number,
  gainPerKm: number,
  maxSlopePercent: number,
  threshold: DifficultyThreshold,
) =>
  distanceMeters >= threshold.distanceMeters ||
  elevationGainMeters >= threshold.gainMeters ||
  gainPerKm >= threshold.gainPerKm ||
  maxSlopePercent >= threshold.maxSlopePercent

const applyEbikeAssistFactor = (
  threshold: DifficultyThreshold,
  mode: Mode,
  ebikeAssist: AssistLevel | null | undefined,
): DifficultyThreshold => {
  if (mode !== 'ebike') {
    return threshold
  }

  const factor = ebikeAssist ? ebikeAssistThresholdFactors[ebikeAssist] : 1

  return {
    distanceMeters: threshold.distanceMeters * factor,
    gainMeters: threshold.gainMeters * factor,
    gainPerKm: threshold.gainPerKm * factor,
    maxSlopePercent: threshold.maxSlopePercent * factor,
  }
}

export const computeRouteDifficulty = (
  distanceMeters: number | null | undefined,
  elevationGainMeters: number | null | undefined,
  maxSlopePercent: number | null | undefined,
  mode: Mode | null | undefined,
  ebikeAssist?: AssistLevel | null,
): RouteDifficulty | null => {
  if (
    !mode ||
    !isFinitePositiveOrZero(distanceMeters) ||
    !isFinitePositiveOrZero(elevationGainMeters) ||
    distanceMeters < routeDifficultyMinimumDistanceMeters
  ) {
    return null
  }

  const thresholds = difficultyThresholds[mode]
  const gainPerKm = elevationGainMeters / (distanceMeters / 1000)
  const slopeForDifficulty = isFinitePositiveOrZero(maxSlopePercent) ? maxSlopePercent : 0

  if (
    reachesThreshold(
      distanceMeters,
      elevationGainMeters,
      gainPerKm,
      slopeForDifficulty,
      applyEbikeAssistFactor(thresholds.hard, mode, ebikeAssist),
    )
  ) {
    return 'hard'
  }

  if (
    reachesThreshold(
      distanceMeters,
      elevationGainMeters,
      gainPerKm,
      slopeForDifficulty,
      applyEbikeAssistFactor(thresholds.demanding, mode, ebikeAssist),
    )
  ) {
    return 'demanding'
  }

  if (
    reachesThreshold(
      distanceMeters,
      elevationGainMeters,
      gainPerKm,
      slopeForDifficulty,
      applyEbikeAssistFactor(thresholds.moderate, mode, ebikeAssist),
    )
  ) {
    return 'moderate'
  }

  return 'easy'
}
