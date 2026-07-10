import type { RouteStep } from './types'

export type RouteRoadbookStep = {
  instruction: string | null
  distanceLabel: string | null
  durationLabel: string | null
}

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const formatRouteStepDistance = (distanceMeters: unknown): string | null => {
  if (!isNonNegativeFiniteNumber(distanceMeters)) {
    return null
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`
}

export const formatRouteStepDuration = (durationSeconds: unknown): string | null => {
  if (!isNonNegativeFiniteNumber(durationSeconds)) {
    return null
  }

  if (durationSeconds < 60) {
    return '< 1 min'
  }

  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) {
    return `${minutes} min`
  }

  if (minutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${minutes} min`
}

export const normalizeRouteSteps = (steps: unknown): RouteRoadbookStep[] => {
  if (!Array.isArray(steps)) {
    return []
  }

  return steps
    .map((step) => {
      if (!step || typeof step !== 'object') {
        return null
      }

      const candidate = step as Partial<RouteStep>
      const instruction =
        typeof candidate.instruction === 'string' && candidate.instruction.trim().length > 0
          ? candidate.instruction.trim().replace(/\s+/g, ' ')
          : null
      const distanceLabel = formatRouteStepDistance(candidate.distance_m)
      const durationLabel = formatRouteStepDuration(candidate.duration_s)

      if (!instruction && !distanceLabel && !durationLabel) {
        return null
      }

      return {
        instruction,
        distanceLabel,
        durationLabel,
      }
    })
    .filter((step): step is RouteRoadbookStep => step !== null)
}
