export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const normalizeNumericInput = (value: number | string): number | '' => {
  if (value === '') {
    return ''
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return ''
  }

  return parsed
}

export const toRadians = (value: number) => (value * Math.PI) / 180

export const haversineDistanceMeters = (
  left: [number, number],
  right: [number, number],
) => {
  const [leftLon, leftLat] = left
  const [rightLon, rightLat] = right
  const earthRadius = 6371000
  const dLat = toRadians(rightLat - leftLat)
  const dLon = toRadians(rightLon - leftLon)
  const leftLatRad = toRadians(leftLat)
  const rightLatRad = toRadians(rightLat)

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos(leftLatRad) * Math.cos(rightLatRad) * sinLon * sinLon

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const buildCumulativeDistances = (coordinates: [number, number][]) => {
  if (coordinates.length === 0) {
    return []
  }

  const distances = [0]
  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentDistance = haversineDistanceMeters(
      coordinates[index - 1],
      coordinates[index],
    )
    distances.push(distances[index - 1] + segmentDistance)
  }
  return distances
}

export const normalizeHeadingDegrees = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }

  const wrapped = value % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export const computeHeadingDegrees = (
  start: [number, number],
  end: [number, number],
) => {
  const [startLon, startLat] = start
  const [endLon, endLat] = end
  const startLatRad = toRadians(startLat)
  const endLatRad = toRadians(endLat)
  const lonDeltaRad = toRadians(endLon - startLon)

  const y = Math.sin(lonDeltaRad) * Math.cos(endLatRad)
  const x =
    Math.cos(startLatRad) * Math.sin(endLatRad) -
    Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(lonDeltaRad)
  const heading = (Math.atan2(y, x) * 180) / Math.PI
  return normalizeHeadingDegrees(heading)
}

export type RouteSamplePoint = {
  distance_m: number
  lat: number
  lon: number
  heading_deg: number
}

export const sampleRouteAtDistance = (
  coordinates: [number, number][],
  cumulativeDistances: number[],
  targetDistance: number,
): RouteSamplePoint | null => {
  if (coordinates.length === 0 || cumulativeDistances.length !== coordinates.length) {
    return null
  }

  if (coordinates.length === 1) {
    return {
      distance_m: 0,
      lat: coordinates[0][1],
      lon: coordinates[0][0],
      heading_deg: 0,
    }
  }

  const clampedDistance = Math.max(
    0,
    Math.min(
      targetDistance,
      cumulativeDistances[cumulativeDistances.length - 1] ?? 0,
    ),
  )

  for (let index = 1; index < cumulativeDistances.length; index += 1) {
    const segmentStartDistance = cumulativeDistances[index - 1]
    const segmentEndDistance = cumulativeDistances[index]
    if (clampedDistance > segmentEndDistance) {
      continue
    }

    const span = segmentEndDistance - segmentStartDistance
    const ratio = span <= 0 ? 0 : (clampedDistance - segmentStartDistance) / span
    const [startLon, startLat] = coordinates[index - 1]
    const [endLon, endLat] = coordinates[index]
    const lon = startLon + ratio * (endLon - startLon)
    const lat = startLat + ratio * (endLat - startLat)
    const headingDeg = computeHeadingDegrees(coordinates[index - 1], coordinates[index])

    return {
      distance_m: clampedDistance,
      lat,
      lon,
      heading_deg: headingDeg,
    }
  }

  const lastCoordinate = coordinates[coordinates.length - 1]
  const previousCoordinate = coordinates[coordinates.length - 2]
  return {
    distance_m: cumulativeDistances[cumulativeDistances.length - 1] ?? 0,
    lat: lastCoordinate[1],
    lon: lastCoordinate[0],
    heading_deg: computeHeadingDegrees(previousCoordinate, lastCoordinate),
  }
}

export type RouteProjection = {
  distance_m: number
  lat: number
  lon: number
  heading_deg: number
  distance_to_route_m: number
}

export const projectCoordinateOnRoute = (
  coordinate: [number, number],
  routeCoordinates: [number, number][],
  cumulativeDistances: number[],
): RouteProjection | null => {
  if (
    routeCoordinates.length < 2 ||
    cumulativeDistances.length !== routeCoordinates.length
  ) {
    return null
  }

  const [targetLon, targetLat] = coordinate
  const metersPerDegreeLat = 111320
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestSegmentIndex = 0
  let bestRatio = 0
  let bestLon = routeCoordinates[0][0]
  let bestLat = routeCoordinates[0][1]

  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [startLon, startLat] = routeCoordinates[index - 1]
    const [endLon, endLat] = routeCoordinates[index]
    const meanLat = ((startLat + endLat + targetLat) / 3) * (Math.PI / 180)
    const metersPerDegreeLon = metersPerDegreeLat * Math.max(0.1, Math.cos(meanLat))

    const startX = startLon * metersPerDegreeLon
    const startY = startLat * metersPerDegreeLat
    const endX = endLon * metersPerDegreeLon
    const endY = endLat * metersPerDegreeLat
    const targetX = targetLon * metersPerDegreeLon
    const targetY = targetLat * metersPerDegreeLat

    const segmentX = endX - startX
    const segmentY = endY - startY
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
    if (segmentLengthSquared <= 0.000001) {
      continue
    }

    const rawRatio =
      ((targetX - startX) * segmentX + (targetY - startY) * segmentY) /
      segmentLengthSquared
    const ratio = Math.max(0, Math.min(1, rawRatio))
    const projectedX = startX + ratio * segmentX
    const projectedY = startY + ratio * segmentY
    const deltaX = targetX - projectedX
    const deltaY = targetY - projectedY
    const distanceSquared = deltaX * deltaX + deltaY * deltaY

    if (distanceSquared >= bestDistanceSquared) {
      continue
    }

    bestDistanceSquared = distanceSquared
    bestSegmentIndex = index - 1
    bestRatio = ratio
    bestLon = startLon + ratio * (endLon - startLon)
    bestLat = startLat + ratio * (endLat - startLat)
  }

  if (!Number.isFinite(bestDistanceSquared)) {
    return null
  }

  const segmentDistance =
    cumulativeDistances[bestSegmentIndex + 1] - cumulativeDistances[bestSegmentIndex]
  const distanceAlong =
    cumulativeDistances[bestSegmentIndex] + segmentDistance * bestRatio
  const headingDeg = computeHeadingDegrees(
    routeCoordinates[bestSegmentIndex],
    routeCoordinates[bestSegmentIndex + 1],
  )

  return {
    distance_m: distanceAlong,
    lat: bestLat,
    lon: bestLon,
    heading_deg: headingDeg,
    distance_to_route_m: Math.sqrt(bestDistanceSquared),
  }
}

export const kmhToMps = (value: number) => (value * 1000) / 3600
