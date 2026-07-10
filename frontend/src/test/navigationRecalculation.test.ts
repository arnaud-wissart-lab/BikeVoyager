import { describe, expect, it } from 'vitest'
import {
  createNavigationRecalculationPlan,
  type NavigationRecalculationPlanParams,
  type RouteRequestPayload,
  type TripResult,
} from '../features/routing/domain'

const evaluatedAtMs = 1_000_000

const routeResult: TripResult = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.35, 48.85],
      [2.36, 48.86],
    ],
  },
  distance_m: 1500,
  duration_s_engine: 360,
  eta_s: 360,
  turn_by_turn: [],
  elevation_profile: [],
}

const lastRoutePayload: RouteRequestPayload = {
  from: { lat: 48.85, lon: 2.35, label: 'Départ initial' },
  to: { lat: 48.86, lon: 2.36, label: 'Destination initiale' },
  mode: 'ebike',
  options: { preferCycleways: false, avoidHills: true },
  speedKmh: 22,
  ebikeAssist: 'high',
}

const createParams = (
  overrides: Partial<NavigationRecalculationPlanParams> = {},
): NavigationRecalculationPlanParams => ({
  isNavigationActive: true,
  navigationMode: 'gps',
  navigationProgress: {
    distance_m: 200,
    lat: 48.851,
    lon: 2.351,
    heading_deg: 10,
    source: 'gps',
    speed_mps: 4,
    distance_to_route_m: 75,
    observed_lat: 48.8525,
    observed_lon: 2.349,
    accuracy_m: 8,
    observed_at_ms: evaluatedAtMs - 1000,
  },
  routeResult,
  detourPointCount: 0,
  lastRoutePayload,
  mapEndCoordinate: [2.36, 48.86],
  endLabel: 'Destination affichée',
  currentPositionLabel: 'Position GPS actuelle',
  destinationFallbackLabel: 'Arrivée',
  fallbackSettings: {
    mode: 'ebike',
    options: { preferCycleways: false, avoidHills: true },
    speedKmh: 22,
    ebikeAssist: 'high',
  },
  evaluatedAtMs,
  ...overrides,
})

describe('navigationRecalculation', () => {
  it('utilise la position GPS observée et non la position projetée', () => {
    const plan = createNavigationRecalculationPlan(createParams())

    expect(plan.available).toBe(true)
    if (!plan.available) {
      return
    }

    expect(plan.payload.from).toEqual({
      lat: 48.8525,
      lon: 2.349,
      label: 'Position GPS actuelle',
    })
    expect(plan.payload.from).not.toEqual({ lat: 48.851, lon: 2.351 })
  })

  it('conserve la destination, le mode, les options, la vitesse et l’assistance', () => {
    const plan = createNavigationRecalculationPlan(createParams())

    expect(plan.available).toBe(true)
    if (!plan.available) {
      return
    }

    expect(plan.payload.to).toEqual(lastRoutePayload.to)
    expect(plan.payload.mode).toBe('ebike')
    expect(plan.payload.options).toEqual(lastRoutePayload.options)
    expect(plan.payload.speedKmh).toBe(22)
    expect(plan.payload.ebikeAssist).toBe('high')
  })

  it('utilise la destination géométrique et les réglages courants sans payload cohérent', () => {
    const plan = createNavigationRecalculationPlan(
      createParams({
        lastRoutePayload: {
          ...lastRoutePayload,
          to: { lat: 43.3, lon: 5.4, label: 'Destination obsolète' },
        },
        fallbackSettings: {
          mode: 'bicycle',
          options: { preferCycleways: true, avoidHills: false },
          speedKmh: 15,
        },
      }),
    )

    expect(plan.available).toBe(true)
    if (!plan.available) {
      return
    }

    expect(plan.payload.to).toEqual({
      lat: 48.86,
      lon: 2.36,
      label: 'Destination affichée',
    })
    expect(plan.payload.mode).toBe('bicycle')
    expect(plan.payload.options).toEqual({ preferCycleways: true, avoidHills: false })
    expect(plan.payload.speedKmh).toBe(15)
  })

  it('refuse une position trop imprécise', () => {
    const plan = createNavigationRecalculationPlan(
      createParams({
        navigationProgress: {
          ...createParams().navigationProgress!,
          accuracy_m: 51,
        },
      }),
    )

    expect(plan).toEqual({ available: false, reason: 'position_inaccurate' })
  })

  it('refuse une position de plus de trente secondes', () => {
    const plan = createNavigationRecalculationPlan(
      createParams({
        navigationProgress: {
          ...createParams().navigationProgress!,
          observed_at_ms: evaluatedAtMs - 30_001,
        },
      }),
    )

    expect(plan).toEqual({ available: false, reason: 'position_stale' })
  })

  it('refuse le recalcul d’une boucle', () => {
    const loopResult: TripResult = {
      kind: 'loop',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.35, 48.85],
          [2.36, 48.86],
          [2.35, 48.85],
        ],
      },
      distance_m: 4000,
      eta_s: 900,
      overlapScore: 'faible',
      segmentsCount: 3,
      elevation_profile: [],
    }
    const plan = createNavigationRecalculationPlan(createParams({ routeResult: loopResult }))

    expect(plan).toEqual({ available: false, reason: 'loop' })
  })

  it('refuse explicitement un trajet avec des détours dans le store', () => {
    const plan = createNavigationRecalculationPlan(createParams({ detourPointCount: 1 }))

    expect(plan).toEqual({ available: false, reason: 'waypoints' })
  })

  it('refuse explicitement un payload cohérent avec des étapes intermédiaires', () => {
    const plan = createNavigationRecalculationPlan(
      createParams({
        lastRoutePayload: {
          ...lastRoutePayload,
          waypoints: [{ lat: 48.855, lon: 2.355, label: 'Étape conservée' }],
        },
      }),
    )

    expect(plan).toEqual({ available: false, reason: 'waypoints' })
  })
})
