import type {
  NavigationCameraMode,
  RouteElevationPoint,
  RouteGeometry,
} from '../../features/routing/domain'

export const hasWebglSupport = () => {
  if (typeof window === 'undefined') {
    return false
  }

  if (import.meta.env.MODE === 'test') {
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    const webgl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return Boolean(webgl)
  } catch {
    return false
  }
}

const toRadians = (value: number) => (value * Math.PI) / 180

export const haversineDistanceMeters = (
  a: [number, number],
  b: [number, number],
) => {
  const [lon1, lat1] = a
  const [lon2, lat2] = b
  const earthRadius = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const lat1Rad = toRadians(lat1)
  const lat2Rad = toRadians(lat2)

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinLon * sinLon
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

const buildCumulativeDistances = (coordinates: [number, number][]) => {
  if (coordinates.length === 0) {
    return []
  }

  const distances = [0]
  for (let i = 1; i < coordinates.length; i += 1) {
    const segment = haversineDistanceMeters(coordinates[i - 1], coordinates[i])
    distances.push(distances[i - 1] + segment)
  }
  return distances
}

const interpolateElevation = (
  profile: RouteElevationPoint[],
  distance: number,
) => {
  if (profile.length === 0) {
    return 0
  }

  if (distance <= profile[0].distance_m) {
    return profile[0].elevation_m
  }

  for (let i = 1; i < profile.length; i += 1) {
    const previous = profile[i - 1]
    const current = profile[i]
    if (distance <= current.distance_m) {
      const span = current.distance_m - previous.distance_m
      if (span <= 0) {
        return current.elevation_m
      }
      const ratio = (distance - previous.distance_m) / span
      return previous.elevation_m + ratio * (current.elevation_m - previous.elevation_m)
    }
  }

  return profile[profile.length - 1].elevation_m
}

export const buildRouteHeights = (
  coordinates: [number, number][],
  elevationProfile?: RouteElevationPoint[] | null,
) => {
  if (!elevationProfile || elevationProfile.length < 2) {
    return null
  }

  const distances = buildCumulativeDistances(coordinates)
  return distances.map((distance) => interpolateElevation(elevationProfile, distance))
}

export const buildRouteSignature = (
  geometry: RouteGeometry | null,
  elevationProfile?: RouteElevationPoint[] | null,
) => {
  if (!geometry || geometry.coordinates.length === 0) {
    return null
  }

  const first = geometry.coordinates[0]
  const last = geometry.coordinates[geometry.coordinates.length - 1]
  const altitudeKey = elevationProfile?.length ?? 0
  return `${geometry.coordinates.length}:${first[0].toFixed(5)}:${first[1].toFixed(5)}:${last[0].toFixed(5)}:${last[1].toFixed(5)}:${altitudeKey}`
}

export const normalizeHeadingDegrees = (heading: number) => {
  if (!Number.isFinite(heading)) {
    return 0
  }

  const wrapped = heading % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export const destinationPointByBearing = (
  origin: [number, number],
  bearingDeg: number,
  distanceMeters: number,
): [number, number] => {
  const [lon, lat] = origin
  const earthRadius = 6371000
  const angularDistance = distanceMeters / earthRadius
  const bearing = toRadians(bearingDeg)
  const latRad = toRadians(lat)
  const lonRad = toRadians(lon)

  const nextLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
  )
  const nextLon =
    lonRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLat),
    )

  return [(nextLon * 180) / Math.PI, (nextLat * 180) / Math.PI]
}

export const getNavigationCameraPreset = (mode: NavigationCameraMode) => {
  if (mode === 'follow_3d') {
    return {
      backDistance_m: 115,
      height_m: 84,
      pitchDeg: -40,
    }
  }

  if (mode === 'panoramic_3d') {
    return {
      backDistance_m: 230,
      height_m: 150,
      pitchDeg: -34,
    }
  }

  return {
    backDistance_m: 0,
    height_m: 1700,
    pitchDeg: -89.5,
  }
}
