import { buildRouteSignature } from '../components/cesium/math'
import type { RouteGeometry } from '../features/routing/domain'

describe('buildRouteSignature', () => {
  it('distingue deux tracés avec les mêmes extrémités et le même nombre de points', () => {
    const firstRoute: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [2.3522, 48.8566],
        [2.36, 48.86],
        [2.37, 48.865],
      ],
    }
    const secondRoute: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [2.3522, 48.8566],
        [2.365, 48.858],
        [2.37, 48.865],
      ],
    }

    expect(buildRouteSignature(firstRoute)).not.toBe(buildRouteSignature(secondRoute))
  })

  it('ignore les coordonnées invalides et retourne null sans deux points valides', () => {
    const invalidRoute = {
      type: 'LineString',
      coordinates: [[2.3522, Number.NaN], [2.36], [2.37, 48.865]],
    } as unknown as RouteGeometry

    expect(buildRouteSignature(invalidRoute)).toBeNull()
  })

  it('intègre les points d’altimétrie exploitables', () => {
    const route: RouteGeometry = {
      type: 'LineString',
      coordinates: [
        [2.3522, 48.8566],
        [2.36, 48.86],
      ],
    }

    const firstSignature = buildRouteSignature(route, [
      { distance_m: 0, elevation_m: 100 },
      { distance_m: 1200, elevation_m: 130 },
    ])
    const secondSignature = buildRouteSignature(route, [
      { distance_m: 0, elevation_m: 100 },
      { distance_m: 1200, elevation_m: 145 },
    ])

    expect(firstSignature).not.toBe(secondSignature)
  })
})
