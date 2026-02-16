import { apiModeByUi } from './constants'
import type { AssistLevel, LoopRequestPayload, Mode, PlaceCandidate } from './types'

export const loopTelemetryEvents = {
  requested: 'LoopGenerateRequested',
  succeeded: 'LoopGenerateSucceeded',
  failed: 'LoopGenerateFailed',
} as const

export type LoopTelemetryEvent =
  (typeof loopTelemetryEvents)[keyof typeof loopTelemetryEvents]

export const trackLoopEvent = (
  event: LoopTelemetryEvent,
  payload?: Record<string, unknown>,
) => {
  void event
  void payload
  // TODO: connecter les evenements de telemetrie de boucle au pipeline d'analyse.
}

export const buildLoopRequest = (
  startPlace: PlaceCandidate | null,
  targetDistanceKm: number | '',
  mode: Mode,
  speedKmh: number,
  ebikeAssist?: AssistLevel,
  variation = 0,
): LoopRequestPayload | null => {
  if (!startPlace || typeof targetDistanceKm !== 'number' || targetDistanceKm <= 0) {
    return null
  }

  return {
    start: {
      label: startPlace.label,
      lat: startPlace.lat,
      lon: startPlace.lon,
    },
    targetDistanceKm,
    mode: apiModeByUi[mode],
    speedKmh,
    ...(mode === 'ebike' && ebikeAssist
      ? {
          ebikeAssist,
        }
      : {}),
    variation,
  }
}
