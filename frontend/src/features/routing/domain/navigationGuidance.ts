import type { RouteStep } from './types'

export type NavigationGuidance = {
  activeStepIndex: number
  activeInstruction: string
  distanceToManeuverMeters: number | null
  nextInstruction: string | null
  isArrival: boolean
}

export type NavigationStepRange = {
  stepIndex: number
  instruction: string
  startDistanceMeters: number
  endDistanceMeters: number
}

const navigationBoundaryToleranceMeters = 0.5

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const normalizeInstruction = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const instruction = value.trim().replace(/\s+/g, ' ')
  return instruction.length > 0 ? instruction : null
}

export const buildNavigationStepRanges = (steps: unknown): NavigationStepRange[] => {
  if (!Array.isArray(steps)) {
    return []
  }

  const ranges: NavigationStepRange[] = []
  let cumulativeDistanceMeters = 0

  steps.forEach((step, stepIndex) => {
    if (!step || typeof step !== 'object') {
      return
    }

    const candidate = step as Partial<RouteStep>
    const instruction = normalizeInstruction(candidate.instruction)
    if (!instruction || !isNonNegativeFiniteNumber(candidate.distance_m)) {
      return
    }

    const endDistanceMeters = cumulativeDistanceMeters + candidate.distance_m
    if (!Number.isFinite(endDistanceMeters)) {
      return
    }

    ranges.push({
      stepIndex,
      instruction,
      startDistanceMeters: cumulativeDistanceMeters,
      endDistanceMeters,
    })
    cumulativeDistanceMeters = endDistanceMeters
  })

  return ranges
}

export const resolveNavigationGuidance = (
  steps: unknown,
  navigationDistanceMeters: number,
  routeDistanceMeters: number | null,
): NavigationGuidance | null => {
  const ranges = buildNavigationStepRanges(steps)
  const totalStepDistanceMeters = ranges.at(-1)?.endDistanceMeters ?? 0
  if (ranges.length === 0 || totalStepDistanceMeters <= 0) {
    return null
  }

  const effectiveRouteDistanceMeters =
    isNonNegativeFiniteNumber(routeDistanceMeters) && routeDistanceMeters > 0
      ? routeDistanceMeters
      : totalStepDistanceMeters
  const progressMeters = Number.isFinite(navigationDistanceMeters)
    ? Math.min(effectiveRouteDistanceMeters, Math.max(0, navigationDistanceMeters))
    : 0
  const lastRange = ranges[ranges.length - 1]

  if (progressMeters >= effectiveRouteDistanceMeters) {
    return {
      activeStepIndex: lastRange.stepIndex,
      activeInstruction: lastRange.instruction,
      distanceToManeuverMeters: 0,
      nextInstruction: null,
      isArrival: true,
    }
  }

  const routeToStepScale = totalStepDistanceMeters / effectiveRouteDistanceMeters
  const normalizedProgressMeters = progressMeters * routeToStepScale
  const normalizedToleranceMeters = navigationBoundaryToleranceMeters * routeToStepScale
  const activeRangeIndex = ranges.findIndex(
    (range, index) =>
      index === ranges.length - 1 ||
      normalizedProgressMeters < Math.max(0, range.endDistanceMeters - normalizedToleranceMeters),
  )
  const activeRange = ranges[Math.max(0, activeRangeIndex)]
  const progressWithinRangeMeters = Math.max(
    activeRange.startDistanceMeters,
    normalizedProgressMeters,
  )
  const remainingStepDistanceMeters = Math.max(
    0,
    activeRange.endDistanceMeters - progressWithinRangeMeters,
  )

  return {
    activeStepIndex: activeRange.stepIndex,
    activeInstruction: activeRange.instruction,
    distanceToManeuverMeters: remainingStepDistanceMeters / routeToStepScale,
    nextInstruction: ranges[activeRangeIndex + 1]?.instruction ?? null,
    isArrival: false,
  }
}
