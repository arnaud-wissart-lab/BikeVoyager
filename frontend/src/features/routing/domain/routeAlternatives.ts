import { createRouteComparisonSummary, type RouteComparisonSummary } from './routeComparison'
import type { AssistLevel, Mode, RouteGeometry, TripResult } from './types'

export const maximumAlternativeCount = 3
export const minimumDistinctRouteRatio = 0.05
export const minimumProfileAlternativeDistinctRatio = 0.01
export const nearDuplicateRouteRatio = 0.02
export const maximumAlternativeDistanceRatio = 1.35

const routeSampleSpacingMeters = 40
const routeProximityMeters = 60
const metersPerDegreeLatitude = 111_320

type ProjectedSample = {
  x: number
  y: number
  weightMeters: number
}

export type RouteDiversity = {
  distinctDistanceMeters: number
  distinctRatio: number
}

export type RouteAlternativeAssessment = RouteDiversity & {
  distanceRatio: number | null
  hasMeaningfulElevationDifference: boolean
  isRelevant: boolean
  relevanceScore: number
}

export type RouteAlternativeCandidate = {
  route: TripResult
  routeAlternativeIndex: number | null
  loopAlternativeIndex: number | null
}

export type RouteAlternativeOption = {
  id: string
  candidate: RouteAlternativeCandidate
  comparison: RouteComparisonSummary
  assessment: RouteAlternativeAssessment
}

const getProjectionLatitude = (first: RouteGeometry, second: RouteGeometry) => {
  const coordinates = [...first.coordinates, ...second.coordinates]
  if (coordinates.length === 0) {
    return 0
  }

  return coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) / coordinates.length
}

const projectCoordinates = (
  geometry: RouteGeometry,
  projectionLatitude: number,
): [number, number][] => {
  const longitudeScale =
    metersPerDegreeLatitude * Math.max(0.01, Math.cos((projectionLatitude * Math.PI) / 180))

  return geometry.coordinates
    .filter(
      (coordinate): coordinate is [number, number] =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1]),
    )
    .map(([longitude, latitude]) => [
      longitude * longitudeScale,
      latitude * metersPerDegreeLatitude,
    ])
}

const sampleProjectedRoute = (coordinates: [number, number][]): ProjectedSample[] => {
  const samples: ProjectedSample[] = []

  for (let index = 1; index < coordinates.length; index += 1) {
    const [startX, startY] = coordinates[index - 1]
    const [endX, endY] = coordinates[index]
    const deltaX = endX - startX
    const deltaY = endY - startY
    const segmentLength = Math.hypot(deltaX, deltaY)
    if (!Number.isFinite(segmentLength) || segmentLength <= 0) {
      continue
    }

    const sampleCount = Math.max(1, Math.ceil(segmentLength / routeSampleSpacingMeters))
    const weightMeters = segmentLength / sampleCount
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const progress = (sampleIndex + 0.5) / sampleCount
      samples.push({
        x: startX + deltaX * progress,
        y: startY + deltaY * progress,
        weightMeters,
      })
    }
  }

  return samples
}

const buildSampleGrid = (samples: ProjectedSample[]) => {
  const grid = new Map<string, ProjectedSample[]>()

  for (const sample of samples) {
    const x = Math.floor(sample.x / routeProximityMeters)
    const y = Math.floor(sample.y / routeProximityMeters)
    const key = `${x}:${y}`
    const cell = grid.get(key)
    if (cell) {
      cell.push(sample)
    } else {
      grid.set(key, [sample])
    }
  }

  return grid
}

const computeDirectionalDiversity = (
  samples: ProjectedSample[],
  referenceGrid: Map<string, ProjectedSample[]>,
) => {
  let totalDistanceMeters = 0
  let distinctDistanceMeters = 0
  const maximumSquaredDistance = routeProximityMeters * routeProximityMeters

  for (const sample of samples) {
    totalDistanceMeters += sample.weightMeters
    const cellX = Math.floor(sample.x / routeProximityMeters)
    const cellY = Math.floor(sample.y / routeProximityMeters)
    let isNearReference = false

    for (let xOffset = -1; xOffset <= 1 && !isNearReference; xOffset += 1) {
      for (let yOffset = -1; yOffset <= 1 && !isNearReference; yOffset += 1) {
        const referenceSamples = referenceGrid.get(`${cellX + xOffset}:${cellY + yOffset}`) ?? []
        isNearReference = referenceSamples.some((referenceSample) => {
          const deltaX = sample.x - referenceSample.x
          const deltaY = sample.y - referenceSample.y
          return deltaX * deltaX + deltaY * deltaY <= maximumSquaredDistance
        })
      }
    }

    if (!isNearReference) {
      distinctDistanceMeters += sample.weightMeters
    }
  }

  return {
    distinctDistanceMeters,
    distinctRatio:
      totalDistanceMeters > 0 ? Math.min(1, distinctDistanceMeters / totalDistanceMeters) : 0,
  }
}

export const computeRouteDiversity = (
  currentGeometry: RouteGeometry,
  candidateGeometry: RouteGeometry,
): RouteDiversity => {
  const projectionLatitude = getProjectionLatitude(currentGeometry, candidateGeometry)
  const currentSamples = sampleProjectedRoute(
    projectCoordinates(currentGeometry, projectionLatitude),
  )
  const candidateSamples = sampleProjectedRoute(
    projectCoordinates(candidateGeometry, projectionLatitude),
  )

  if (currentSamples.length === 0 || candidateSamples.length === 0) {
    return {
      distinctDistanceMeters: 0,
      distinctRatio: 0,
    }
  }

  const candidateDiversity = computeDirectionalDiversity(
    candidateSamples,
    buildSampleGrid(currentSamples),
  )
  const currentDiversity = computeDirectionalDiversity(
    currentSamples,
    buildSampleGrid(candidateSamples),
  )

  return {
    distinctDistanceMeters: Math.max(
      currentDiversity.distinctDistanceMeters,
      candidateDiversity.distinctDistanceMeters,
    ),
    distinctRatio: Math.max(currentDiversity.distinctRatio, candidateDiversity.distinctRatio),
  }
}

const hasMeaningfulElevationDifference = (comparison: RouteComparisonSummary) => {
  const currentGain = comparison.current.elevationGainMeters
  const gainDelta = comparison.delta.elevationGainMeters
  const currentSlope = comparison.current.maxSlopePercent
  const candidateSlope = comparison.alternative.maxSlopePercent

  const hasMeaningfulGainDifference =
    currentGain !== null &&
    gainDelta !== null &&
    Math.abs(gainDelta) >= Math.max(50, currentGain * 0.15)
  const hasMeaningfulSlopeDifference =
    currentSlope !== null && candidateSlope !== null && Math.abs(candidateSlope - currentSlope) >= 2

  return hasMeaningfulGainDifference || hasMeaningfulSlopeDifference
}

export const assessRouteAlternative = (
  currentRoute: TripResult,
  candidateRoute: TripResult,
  mode: Mode | null | undefined,
  ebikeAssist: AssistLevel | null | undefined,
): RouteAlternativeAssessment | null => {
  const comparison = createRouteComparisonSummary(currentRoute, candidateRoute, mode, ebikeAssist)
  if (!comparison) {
    return null
  }

  const computedDiversity = computeRouteDiversity(currentRoute.geometry, candidateRoute.geometry)
  const currentDistance = comparison.current.distanceMeters
  const candidateDistance = comparison.alternative.distanceMeters
  const distanceRatio =
    currentDistance !== null && currentDistance > 0 && candidateDistance !== null
      ? candidateDistance / currentDistance
      : null
  const meaningfulElevationDifference = hasMeaningfulElevationDifference(comparison)
  const hasMeaningfulShape = computedDiversity.distinctRatio >= minimumDistinctRouteRatio
  const hasUsefulProfile =
    computedDiversity.distinctRatio >= minimumProfileAlternativeDistinctRatio &&
    meaningfulElevationDifference
  const hasReasonableDistance =
    distanceRatio === null || distanceRatio <= maximumAlternativeDistanceRatio
  const distancePenalty = Math.max(0, (distanceRatio ?? 1) - 1) * 20
  const profileBonus = meaningfulElevationDifference ? 10 : 0
  const longestReportedDistance =
    currentDistance !== null && candidateDistance !== null
      ? Math.max(currentDistance, candidateDistance)
      : null
  const diversity = {
    distinctRatio: computedDiversity.distinctRatio,
    distinctDistanceMeters:
      longestReportedDistance !== null
        ? computedDiversity.distinctRatio * longestReportedDistance
        : computedDiversity.distinctDistanceMeters,
  }

  return {
    ...diversity,
    distanceRatio,
    hasMeaningfulElevationDifference: meaningfulElevationDifference,
    isRelevant: (hasMeaningfulShape || hasUsefulProfile) && hasReasonableDistance,
    relevanceScore: diversity.distinctRatio * 100 + profileBonus - distancePenalty,
  }
}

export const areRoutesNearDuplicate = (first: TripResult, second: TripResult) =>
  computeRouteDiversity(first.geometry, second.geometry).distinctRatio < nearDuplicateRouteRatio
