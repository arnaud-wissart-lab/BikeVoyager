import { fetchRoute } from './api'
import {
  apiModeByUi,
  routeOptionVariants,
  type AssistLevel,
  type DetourPoint,
  type Mode,
  type RouteKey,
  type RouteLocation,
  type RouteRequestPayload,
  type TripResult,
} from './domain'
import {
  normalizeRouteResponseError,
  setRouteUnexpectedError,
  type RouteErrorSetters,
} from './actions.errors'
import { toWaypointPayload } from './actions.poi'
import type { RouteRequestKind } from './types'

type CreateRouteRequestActionParams = RouteErrorSetters & {
  setIsRouteLoading: (value: boolean) => void
  lastRouteRequestRef: { current: RouteRequestKind | null }
  setRouteResult: (value: TripResult | null) => void
  setHasResult: (value: boolean) => void
  setIsDirty: (value: boolean) => void
  setDetourPoints: (value: DetourPoint[]) => void
  onNavigate: (next: RouteKey, force?: boolean) => void
}

type ResolveRouteLocationsParams = {
  onewayStartPlace: RouteLocation | null
  endPlace: RouteLocation | null
  mapStartCoordinate: [number, number] | null
  mapEndCoordinate: [number, number] | null
  startLabel: string
  endLabel: string
  getStartFallbackLabel: () => string
  getEndFallbackLabel: () => string
}

type BuildRouteRequestPayloadParams = {
  from: RouteLocation
  to: RouteLocation
  mode: Mode
  speedKmh: number
  ebikeAssist: AssistLevel
  variantIndex: number
  detourPoints: DetourPoint[]
}

export const buildRouteOptionsVariant = (variantIndex: number) =>
  routeOptionVariants[variantIndex % routeOptionVariants.length]

export const resolveRouteLocations = ({
  onewayStartPlace,
  endPlace,
  mapStartCoordinate,
  mapEndCoordinate,
  startLabel,
  endLabel,
  getStartFallbackLabel,
  getEndFallbackLabel,
}: ResolveRouteLocationsParams) => {
  const fromLocation: RouteLocation | null = onewayStartPlace
    ? {
        lat: onewayStartPlace.lat,
        lon: onewayStartPlace.lon,
        label: onewayStartPlace.label,
      }
    : mapStartCoordinate
      ? {
          lat: mapStartCoordinate[1],
          lon: mapStartCoordinate[0],
          label: startLabel || getStartFallbackLabel(),
        }
      : null

  const toLocation: RouteLocation | null = endPlace
    ? {
        lat: endPlace.lat,
        lon: endPlace.lon,
        label: endPlace.label,
      }
    : mapEndCoordinate
      ? {
          lat: mapEndCoordinate[1],
          lon: mapEndCoordinate[0],
          label: endLabel || getEndFallbackLabel(),
        }
      : null

  return {
    fromLocation,
    toLocation,
  }
}

export const buildRouteRequestPayload = ({
  from,
  to,
  mode,
  speedKmh,
  ebikeAssist,
  variantIndex,
  detourPoints,
}: BuildRouteRequestPayloadParams): RouteRequestPayload => ({
  from,
  to,
  ...(detourPoints.length > 0
    ? {
        waypoints: toWaypointPayload(detourPoints),
      }
    : {}),
  mode: apiModeByUi[mode],
  options: buildRouteOptionsVariant(variantIndex),
  speedKmh,
  ...(mode === 'ebike'
    ? {
        ebikeAssist,
      }
    : {}),
})

export const createRouteRequestAction = ({
  setIsRouteLoading,
  lastRouteRequestRef,
  setRouteErrorMessage,
  setRouteErrorKey,
  setRouteResult,
  setHasResult,
  setIsDirty,
  setDetourPoints,
  onNavigate,
}: CreateRouteRequestActionParams) => {
  const errorSetters: RouteErrorSetters = {
    setRouteErrorMessage,
    setRouteErrorKey,
  }

  return async (requestBody: RouteRequestPayload, nextDetours: DetourPoint[] = []) => {
    setIsRouteLoading(true)
    lastRouteRequestRef.current = {
      type: 'route',
      payload: requestBody,
    }

    try {
      const result = await fetchRoute(requestBody)
      if (!result.ok) {
        await normalizeRouteResponseError(result.response, errorSetters)
        return false
      }

      setRouteResult(result.result)
      setHasResult(true)
      setIsDirty(false)
      setDetourPoints(nextDetours)
      onNavigate('carte', true)
      return true
    } catch {
      setRouteUnexpectedError(errorSetters)
      return false
    } finally {
      setIsRouteLoading(false)
    }
  }
}
