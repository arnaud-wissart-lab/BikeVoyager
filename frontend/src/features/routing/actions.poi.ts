import type { DetourPoint, RouteLocation } from './domain'

const pointsAreClose = (left: { lat: number; lon: number }, right: { lat: number; lon: number }) =>
  Math.abs(left.lat - right.lat) < 0.00003 && Math.abs(left.lon - right.lon) < 0.00003

export const appendDetourPoint = (detourPoints: DetourPoint[], point: DetourPoint) => {
  if (detourPoints.some((existing) => existing.id === point.id)) {
    return detourPoints
  }

  if (detourPoints.some((existing) => pointsAreClose(existing, point))) {
    return detourPoints
  }

  return [...detourPoints, point]
}

export const toWaypointPayload = (points: DetourPoint[]): RouteLocation[] =>
  points.map(({ lat, lon, label }) => ({ lat, lon, label }))
