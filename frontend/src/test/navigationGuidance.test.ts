import { describe, expect, it } from 'vitest'
import {
  buildNavigationStepRanges,
  resolveNavigationGuidance,
  type RouteStep,
} from '../features/routing/domain'

const steps: RouteStep[] = [
  { instruction: 'Étape A', distance_m: 100, duration_s: 10, type: 1 },
  { instruction: 'Étape B', distance_m: 200, duration_s: 20, type: 2 },
  { instruction: 'Étape C', distance_m: 300, duration_s: 30, type: 3 },
]

describe('navigationGuidance', () => {
  it('construit des intervalles cumulés à partir des distances de chaque étape', () => {
    expect(buildNavigationStepRanges(steps)).toEqual([
      {
        stepIndex: 0,
        instruction: 'Étape A',
        startDistanceMeters: 0,
        endDistanceMeters: 100,
      },
      {
        stepIndex: 1,
        instruction: 'Étape B',
        startDistanceMeters: 100,
        endDistanceMeters: 300,
      },
      {
        stepIndex: 2,
        instruction: 'Étape C',
        startDistanceMeters: 300,
        endDistanceMeters: 600,
      },
    ])
  })

  it('sélectionne la première étape au départ', () => {
    expect(resolveNavigationGuidance(steps, 0, 600)).toEqual({
      activeStepIndex: 0,
      activeInstruction: 'Étape A',
      distanceToManeuverMeters: 100,
      nextInstruction: 'Étape B',
      isArrival: false,
    })
  })

  it('passe à l’étape suivante exactement à la frontière', () => {
    expect(resolveNavigationGuidance(steps, 100, 600)).toEqual({
      activeStepIndex: 1,
      activeInstruction: 'Étape B',
      distanceToManeuverMeters: 200,
      nextInstruction: 'Étape C',
      isArrival: false,
    })
  })

  it('stabilise l’étape active autour d’une frontière', () => {
    expect(resolveNavigationGuidance(steps, 99.8, 600)?.activeStepIndex).toBe(1)
    expect(resolveNavigationGuidance(steps, 100.2, 600)?.activeStepIndex).toBe(1)
  })

  it('calcule la distance restante au milieu d’une étape', () => {
    expect(resolveNavigationGuidance(steps, 150, 600)).toMatchObject({
      activeStepIndex: 1,
      distanceToManeuverMeters: 150,
      nextInstruction: 'Étape C',
      isArrival: false,
    })
  })

  it('borne le guidage sur la dernière étape', () => {
    expect(resolveNavigationGuidance(steps, 350, 600)).toEqual({
      activeStepIndex: 2,
      activeInstruction: 'Étape C',
      distanceToManeuverMeters: 250,
      nextInstruction: null,
      isArrival: false,
    })
  })

  it('retourne l’arrivée à 100 % et au-delà du trajet', () => {
    const expectedArrival = {
      activeStepIndex: 2,
      activeInstruction: 'Étape C',
      distanceToManeuverMeters: 0,
      nextInstruction: null,
      isArrival: true,
    }

    expect(resolveNavigationGuidance(steps, 600, 600)).toEqual(expectedArrival)
    expect(resolveNavigationGuidance(steps, 900, 600)).toEqual(expectedArrival)
  })

  it('borne une progression négative au départ du trajet', () => {
    expect(resolveNavigationGuidance(steps, -20, 600)).toMatchObject({
      activeStepIndex: 0,
      distanceToManeuverMeters: 100,
      isArrival: false,
    })
  })

  it('préserve les distances valides des étapes sans instruction', () => {
    const invalidSteps = [
      null,
      { instruction: '   ', distance_m: 100 },
      { instruction: 'Distance invalide', distance_m: -1 },
      { instruction: '  Étape   valide  ', distance_m: 100 },
    ]

    expect(buildNavigationStepRanges(invalidSteps)).toEqual([
      {
        stepIndex: 1,
        instruction: null,
        startDistanceMeters: 0,
        endDistanceMeters: 100,
      },
      {
        stepIndex: 3,
        instruction: 'Étape valide',
        startDistanceMeters: 100,
        endDistanceMeters: 200,
      },
    ])
    expect(resolveNavigationGuidance(invalidSteps, 0, 200)).toBeNull()
    expect(resolveNavigationGuidance(invalidSteps, 100, 200)).toEqual({
      activeStepIndex: 3,
      activeInstruction: 'Étape valide',
      distanceToManeuverMeters: 100,
      nextInstruction: null,
      isArrival: false,
    })
    expect(resolveNavigationGuidance(undefined, 0, 100)).toBeNull()
    expect(resolveNavigationGuidance([], 0, 100)).toBeNull()
  })

  it('conserve les positions des instructions autour d’un long segment vide', () => {
    const stepsWithGap = [
      { instruction: 'Étape A', distance_m: 100 },
      { instruction: '   ', distance_m: 1000 },
      { instruction: 'Étape C', distance_m: 100 },
    ]

    expect(buildNavigationStepRanges(stepsWithGap)).toEqual([
      {
        stepIndex: 0,
        instruction: 'Étape A',
        startDistanceMeters: 0,
        endDistanceMeters: 100,
      },
      {
        stepIndex: 1,
        instruction: null,
        startDistanceMeters: 100,
        endDistanceMeters: 1100,
      },
      {
        stepIndex: 2,
        instruction: 'Étape C',
        startDistanceMeters: 1100,
        endDistanceMeters: 1200,
      },
    ])
    expect(resolveNavigationGuidance(stepsWithGap, 50, 1200)).toMatchObject({
      activeStepIndex: 0,
      activeInstruction: 'Étape A',
      distanceToManeuverMeters: 50,
    })
    expect(resolveNavigationGuidance(stepsWithGap, 500, 1200)).toBeNull()
    expect(resolveNavigationGuidance(stepsWithGap, 1150, 1200)).toMatchObject({
      activeStepIndex: 2,
      activeInstruction: 'Étape C',
      distanceToManeuverMeters: 50,
    })
  })

  it('cherche l’instruction suivante au-delà de plusieurs segments vides', () => {
    const stepsWithSeveralGaps = [
      { instruction: 'Étape A', distance_m: 100 },
      { instruction: '', distance_m: 200 },
      { instruction: null, distance_m: 300 },
      { instruction: 'Étape C', distance_m: 100 },
    ]

    expect(resolveNavigationGuidance(stepsWithSeveralGaps, 50, 700)).toMatchObject({
      activeInstruction: 'Étape A',
      nextInstruction: 'Étape C',
    })
  })

  it('franchit les étapes de distance nulle sans produire de distance négative', () => {
    const stepsWithZeroDistance = [
      { instruction: 'Étape immédiate', distance_m: 0 },
      { instruction: 'Étape mesurable', distance_m: 200 },
    ]

    expect(resolveNavigationGuidance(stepsWithZeroDistance, 0, 200)).toEqual({
      activeStepIndex: 1,
      activeInstruction: 'Étape mesurable',
      distanceToManeuverMeters: 200,
      nextInstruction: null,
      isArrival: false,
    })
    expect(
      resolveNavigationGuidance([{ instruction: 'Étape immédiate', distance_m: 0 }], 0, 200),
    ).toBeNull()
  })

  it('normalise la progression quand la somme des étapes diffère de la géométrie', () => {
    expect(resolveNavigationGuidance(steps, 400, 1200)).toEqual({
      activeStepIndex: 1,
      activeInstruction: 'Étape B',
      distanceToManeuverMeters: 200,
      nextInstruction: 'Étape C',
      isArrival: false,
    })
  })
})
