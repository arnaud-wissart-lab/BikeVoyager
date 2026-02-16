import { fetchLoop } from './api'
import {
  apiModeByUi,
  type AssistLevel,
  type DetourPoint,
  type LoopRequestPayload,
  type Mode,
  type RouteKey,
  type RouteLocation,
  type TripResult,
} from './domain'
import {
  normalizeLoopResponseError,
  setLoopUnexpectedError,
  type RouteErrorSetters,
} from './actions.errors'
import { toWaypointPayload } from './actions.poi'
import type { RouteRequestKind } from './types'

type CreateLoopRequestActionParams = RouteErrorSetters & {
  setIsRouteLoading: (value: boolean) => void
  lastRouteRequestRef: { current: RouteRequestKind | null }
  setRouteResult: (value: TripResult | null) => void
  setHasResult: (value: boolean) => void
  setIsDirty: (value: boolean) => void
  setDetourPoints: (value: DetourPoint[]) => void
  onNavigate: (next: RouteKey, force?: boolean) => void
}

type ResolveLoopStartLocationParams = {
  loopStartPlace: RouteLocation | null
  mapStartCoordinate: [number, number] | null
  startLabel: string
  getStartFallbackLabel: () => string
}

type BuildLoopRequestPayloadParams = {
  start: RouteLocation
  targetDistanceKm: number
  mode: Mode
  speedKmh: number
  ebikeAssist: AssistLevel
  variation: number
  detourPoints: DetourPoint[]
}

export const resolveEbikeAssistForMode = (
  mode: Mode,
  ebikeAssist: AssistLevel,
) => (mode === 'ebike' ? ebikeAssist : undefined)

export const resolveLoopStartLocation = ({
  loopStartPlace,
  mapStartCoordinate,
  startLabel,
  getStartFallbackLabel,
}: ResolveLoopStartLocationParams): RouteLocation | null =>
  loopStartPlace
    ? {
        lat: loopStartPlace.lat,
        lon: loopStartPlace.lon,
        label: loopStartPlace.label,
      }
    : mapStartCoordinate
      ? {
          lat: mapStartCoordinate[1],
          lon: mapStartCoordinate[0],
          label: startLabel || getStartFallbackLabel(),
        }
      : null

export const resolveLoopDistanceKm = (
  targetDistanceKm: number | '',
  routeDistanceMeters: number,
) =>
  typeof targetDistanceKm === 'number' && targetDistanceKm > 0
    ? targetDistanceKm
    : Math.max(1, Math.round(routeDistanceMeters / 1000))

export const buildLoopRequestPayload = ({
  start,
  targetDistanceKm,
  mode,
  speedKmh,
  ebikeAssist,
  variation,
  detourPoints,
}: BuildLoopRequestPayloadParams): LoopRequestPayload => ({
  start,
  targetDistanceKm,
  mode: apiModeByUi[mode],
  speedKmh,
  ...(mode === 'ebike'
    ? {
        ebikeAssist,
      }
    : {}),
  variation,
  ...(detourPoints.length > 0
    ? {
        waypoints: toWaypointPayload(detourPoints),
      }
    : {}),
})

export const createLoopRequestAction = ({
  setIsRouteLoading,
  lastRouteRequestRef,
  setRouteErrorMessage,
  setRouteErrorKey,
  setRouteResult,
  setHasResult,
  setIsDirty,
  setDetourPoints,
  onNavigate,
}: CreateLoopRequestActionParams) => {
  const errorSetters: RouteErrorSetters = {
    setRouteErrorMessage,
    setRouteErrorKey,
  }

  return async (
    requestBody: LoopRequestPayload,
    nextDetours: DetourPoint[] = [],
  ) => {
    setIsRouteLoading(true)
    lastRouteRequestRef.current = {
      type: 'loop',
      payload: requestBody,
    }

    try {
      const result = await fetchLoop(requestBody)
      if (!result.ok) {
        await normalizeLoopResponseError(result.response, errorSetters)
        return false
      }

      setRouteResult(result.result)
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      onNavigate('carte', true)
      return true
    } catch {
      setLoopUnexpectedError(errorSetters)
      return false
    } finally {
      setIsRouteLoading(false)
    }
  }
}
