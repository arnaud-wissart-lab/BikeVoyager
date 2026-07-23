import { mapPaddingRatio, minimumMapSpan } from './constants'
import type { RouteBounds, RouteGeometry } from './types'

const routeCoordinateTolerance = 0.00001

export const areRouteGeometriesEquivalent = (current: RouteGeometry, candidate: RouteGeometry) => {
  if (current.coordinates.length !== candidate.coordinates.length) {
    return false
  }

  return current.coordinates.every(([currentLon, currentLat], index) => {
    const [candidateLon, candidateLat] = candidate.coordinates[index]
    return (
      Math.abs(currentLon - candidateLon) <= routeCoordinateTolerance &&
      Math.abs(currentLat - candidateLat) <= routeCoordinateTolerance
    )
  })
}

export const computeRouteBounds = (geometry: RouteGeometry | null): RouteBounds | null => {
  if (!geometry || geometry.type !== 'LineString' || geometry.coordinates.length === 0) {
    return null
  }

  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const coordinate of geometry.coordinates) {
    const [lon, lat] = coordinate
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue
    }

    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return null
  }

  return { minLat, minLon, maxLat, maxLon }
}

export const expandBounds = (bounds: RouteBounds): RouteBounds => {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, minimumMapSpan)
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, minimumMapSpan)
  const latPadding = latSpan * mapPaddingRatio
  const lonPadding = lonSpan * mapPaddingRatio

  return {
    minLat: Math.max(-90, bounds.minLat - latPadding),
    maxLat: Math.min(90, bounds.maxLat + latPadding),
    minLon: Math.max(-180, bounds.minLon - lonPadding),
    maxLon: Math.min(180, bounds.maxLon + lonPadding),
  }
}
