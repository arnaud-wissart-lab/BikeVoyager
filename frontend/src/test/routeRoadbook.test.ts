import { describe, expect, it } from 'vitest'
import {
  formatRouteStepDistance,
  formatRouteStepDuration,
  normalizeRouteSteps,
} from '../features/routing/domain'

describe('routeRoadbook', () => {
  it('formate les distances des étapes', () => {
    expect(formatRouteStepDistance(0)).toBe('0 m')
    expect(formatRouteStepDistance(120)).toBe('120 m')
    expect(formatRouteStepDistance(999.4)).toBe('999 m')
    expect(formatRouteStepDistance(1000)).toBe('1.0 km')
    expect(formatRouteStepDistance(1250)).toBe('1.3 km')
  })

  it('ignore les distances invalides', () => {
    expect(formatRouteStepDistance(null)).toBeNull()
    expect(formatRouteStepDistance(Number.NaN)).toBeNull()
    expect(formatRouteStepDistance(-1)).toBeNull()
  })

  it('formate les durées des étapes', () => {
    expect(formatRouteStepDuration(0)).toBe('< 1 min')
    expect(formatRouteStepDuration(30)).toBe('< 1 min')
    expect(formatRouteStepDuration(60)).toBe('1 min')
    expect(formatRouteStepDuration(89)).toBe('1 min')
    expect(formatRouteStepDuration(3600)).toBe('1 h')
    expect(formatRouteStepDuration(4820)).toBe('1 h 20 min')
  })

  it('ignore les durées invalides', () => {
    expect(formatRouteStepDuration(undefined)).toBeNull()
    expect(formatRouteStepDuration(Number.POSITIVE_INFINITY)).toBeNull()
    expect(formatRouteStepDuration(-1)).toBeNull()
  })

  it('normalise les étapes exploitables sans conserver les entrées vides', () => {
    expect(
      normalizeRouteSteps([
        null,
        {},
        { instruction: '   ', distance_m: -1, duration_s: Number.NaN },
        { instruction: '  Tourner   à droite  ', distance_m: 120, duration_s: 65, type: 10 },
        { instruction: '', distance_m: 50, duration_s: 30, type: 0 },
        { instruction: 'Continuer', distance_m: -1, duration_s: Number.POSITIVE_INFINITY, type: 0 },
      ]),
    ).toEqual([
      {
        instruction: 'Tourner à droite',
        distanceLabel: '120 m',
        durationLabel: '1 min',
      },
      {
        instruction: null,
        distanceLabel: '50 m',
        durationLabel: '< 1 min',
      },
      {
        instruction: 'Continuer',
        distanceLabel: null,
        durationLabel: null,
      },
    ])
  })
})
