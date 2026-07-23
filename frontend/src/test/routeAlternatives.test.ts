import { describe, expect, it } from 'vitest'
import {
  assessRouteAlternative,
  computeRouteDiversity,
  maximumAlternativeDistanceRatio,
  minimumDistinctRouteRatio,
  type RouteGeometry,
  type TripResult,
} from '../features/routing/domain'

const kilometersToLongitude = (kilometers: number) => kilometers / 111.32
const kilometersToLatitude = (kilometers: number) => kilometers / 110.54

const buildRouteGeometry = (
  totalKilometers: number,
  distinctKilometers: number,
  offsetKilometers = 0,
): RouteGeometry => {
  const diversionStart = totalKilometers / 2 - distinctKilometers / 2
  const diversionEnd = diversionStart + distinctKilometers
  return {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [kilometersToLongitude(diversionStart), 0],
      [
        kilometersToLongitude(diversionStart + distinctKilometers / 2),
        kilometersToLatitude(offsetKilometers),
      ],
      [kilometersToLongitude(diversionEnd), 0],
      [kilometersToLongitude(totalKilometers), 0],
    ],
  }
}

const createRoute = (
  totalKilometers: number,
  geometry: RouteGeometry,
  elevationGainMeters = 100,
): TripResult => ({
  kind: 'route',
  geometry,
  distance_m: totalKilometers * 1000,
  duration_s_engine: totalKilometers * 240,
  eta_s: totalKilometers * 240,
  turn_by_turn: [],
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: (totalKilometers * 1000) / 2, elevation_m: 100 + elevationGainMeters },
    { distance_m: totalKilometers * 1000, elevation_m: 100 },
  ],
})

describe('pertinence des alternatives', () => {
  it('retient 500 m réellement différents sur un trajet de 5 km', () => {
    const current = createRoute(5, buildRouteGeometry(5, 0.5))
    const candidate = createRoute(5, buildRouteGeometry(5, 0.5, 0.2))

    const assessment = assessRouteAlternative(current, candidate, 'bike', 'medium')

    expect(assessment).not.toBeNull()
    expect(assessment?.distinctRatio).toBeGreaterThanOrEqual(minimumDistinctRouteRatio)
    expect(assessment?.isRelevant).toBe(true)
  })

  it('écarte les mêmes 500 m différents sur un trajet de 100 km', () => {
    const current = createRoute(100, buildRouteGeometry(100, 0.5))
    const candidate = createRoute(100, buildRouteGeometry(100, 0.5, 0.2))

    const assessment = assessRouteAlternative(current, candidate, 'bike', 'medium')

    expect(assessment).not.toBeNull()
    expect(assessment?.distinctRatio).toBeLessThan(minimumDistinctRouteRatio)
    expect(assessment?.isRelevant).toBe(false)
  })

  it('retient un faible écart de tracé lorsqu’il apporte un profil nettement plus plat', () => {
    const current = createRoute(100, buildRouteGeometry(100, 2), 500)
    const candidate = createRoute(100, buildRouteGeometry(100, 2, 0.2), 300)

    const assessment = assessRouteAlternative(current, candidate, 'bike', 'medium')

    expect(assessment?.distinctRatio).toBeLessThan(minimumDistinctRouteRatio)
    expect(assessment?.hasMeaningfulElevationDifference).toBe(true)
    expect(assessment?.isRelevant).toBe(true)
  })

  it('écarte une variante dont le détour dépasse le plafond', () => {
    const current = createRoute(100, buildRouteGeometry(100, 20))
    const candidate = {
      ...createRoute(100, buildRouteGeometry(100, 20, 5)),
      distance_m: 100_000 * (maximumAlternativeDistanceRatio + 0.01),
    }

    expect(assessRouteAlternative(current, candidate, 'bike', 'medium')?.isRelevant).toBe(false)
  })

  it('mesure la diversité dans les deux sens du tracé', () => {
    const shortRoute = buildRouteGeometry(5, 0.5)
    const divertedRoute = buildRouteGeometry(5, 0.5, 0.2)

    const forward = computeRouteDiversity(shortRoute, divertedRoute)
    const reverse = computeRouteDiversity(divertedRoute, shortRoute)

    expect(forward.distinctRatio).toBeCloseTo(reverse.distinctRatio, 5)
    expect(forward.distinctDistanceMeters).toBeCloseTo(reverse.distinctDistanceMeters, 5)
  })
})
