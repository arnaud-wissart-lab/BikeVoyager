import { describe, expect, it } from 'vitest'
import {
  createRouteComparisonMetrics,
  createRouteComparisonSummary,
  type TripResult,
} from '../features/routing/domain'

const createRoute = (overrides: Partial<TripResult> = {}): TripResult => ({
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.36, 48.86],
    ],
  },
  distance_m: 10000,
  duration_s_engine: 2400,
  eta_s: 2400,
  turn_by_turn: [],
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 1000, elevation_m: 140 },
    { distance_m: 2000, elevation_m: 120 },
  ],
  ...overrides,
})

describe('route comparison', () => {
  it('compare deux routes avec des distances et durées différentes', () => {
    const current = createRoute()
    const alternative = createRoute({
      distance_m: 8500,
      duration_s_engine: 1800,
      eta_s: 1800,
    })

    const comparison = createRouteComparisonSummary(current, alternative, 'bike', 'medium')

    expect(comparison?.current.distanceMeters).toBe(10000)
    expect(comparison?.alternative.distanceMeters).toBe(8500)
    expect(comparison?.delta.distanceMeters).toBe(-1500)
    expect(comparison?.delta.durationSeconds).toBe(-600)
  })

  it('compare le dénivelé positif et négatif', () => {
    const current = createRoute({
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 1000, elevation_m: 160 },
        { distance_m: 2000, elevation_m: 120 },
      ],
    })
    const alternative = createRoute({
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 1000, elevation_m: 130 },
        { distance_m: 2000, elevation_m: 110 },
      ],
    })

    const comparison = createRouteComparisonSummary(current, alternative, 'bike', 'medium')

    expect(comparison?.current.elevationGainMeters).toBe(60)
    expect(comparison?.current.elevationLossMeters).toBe(40)
    expect(comparison?.alternative.elevationGainMeters).toBe(30)
    expect(comparison?.alternative.elevationLossMeters).toBe(20)
    expect(comparison?.delta.elevationGainMeters).toBe(-30)
    expect(comparison?.delta.elevationLossMeters).toBe(-20)
  })

  it('calcule correctement les deltas positifs', () => {
    const current = createRoute({ distance_m: 12000, eta_s: 3000 })
    const alternative = createRoute({ distance_m: 15000, eta_s: 3600 })

    const comparison = createRouteComparisonSummary(current, alternative, 'bike', 'medium')

    expect(comparison?.delta.distanceMeters).toBe(3000)
    expect(comparison?.delta.durationSeconds).toBe(600)
  })

  it('utilise un fallback si l’altimétrie est absente', () => {
    const metrics = createRouteComparisonMetrics(
      createRoute({
        elevation_profile: [],
      }),
      'bike',
      'medium',
    )

    expect(metrics.hasElevationProfile).toBe(false)
    expect(metrics.elevationGainMeters).toBeNull()
    expect(metrics.elevationLossMeters).toBeNull()
    expect(metrics.maxSlopePercent).toBeNull()
    expect(metrics.difficulty).toBeNull()
  })

  it('détecte un changement de difficulté quand les métriques changent', () => {
    const current = createRoute({
      distance_m: 5000,
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 1000, elevation_m: 120 },
      ],
    })
    const alternative = createRoute({
      distance_m: 110000,
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 1000, elevation_m: 1700 },
      ],
    })

    const comparison = createRouteComparisonSummary(current, alternative, 'bike', 'medium')

    expect(comparison?.current.difficulty).toBe('easy')
    expect(comparison?.alternative.difficulty).toBe('hard')
    expect(comparison?.delta.difficultyChanged).toBe(true)
  })

  it('retourne null si l’alternative est absente', () => {
    expect(createRouteComparisonSummary(createRoute(), null, 'bike', 'medium')).toBeNull()
  })
})
