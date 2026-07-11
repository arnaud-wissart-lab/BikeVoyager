import { describe, expect, it } from 'vitest'
import {
  buildNavigationDeviationEpisodeKey,
  createNavigationDeviationState,
  dismissNavigationDeviation,
  updateNavigationDeviationState,
  type NavigationDeviationSample,
  type NavigationDeviationState,
} from '../features/routing/domain'

const baseTimeMs = 1_000_000

const createSample = (
  observedAtMs: number,
  overrides: Partial<NavigationDeviationSample> = {},
): NavigationDeviationSample => ({
  isNavigationActive: true,
  navigationMode: 'gps',
  distanceToRouteMeters: 100,
  accuracyMeters: 5,
  observedAtMs,
  evaluatedAtMs: observedAtMs,
  ...overrides,
})

const confirmOffRoute = (
  initialState: NavigationDeviationState = createNavigationDeviationState(),
  startTimeMs = baseTimeMs,
) => {
  const suspected = updateNavigationDeviationState(initialState, createSample(startTimeMs))
  const stillSuspected = updateNavigationDeviationState(suspected, createSample(startTimeMs + 3000))
  return updateNavigationDeviationState(stillSuspected, createSample(startTimeMs + 6000))
}

describe('navigationDeviation', () => {
  it('ne confirme pas une mesure isolée hors trajet', () => {
    const state = updateNavigationDeviationState(
      createNavigationDeviationState(),
      createSample(baseTimeMs),
    )

    expect(state.status).toBe('suspected')
    expect(state.consecutiveOffRouteSamples).toBe(1)
  })

  it('confirme trois mesures cohérentes réparties sur au moins six secondes', () => {
    const state = confirmOffRoute()

    expect(state.status).toBe('off_route')
    expect(state.consecutiveOffRouteSamples).toBe(3)
  })

  it('maintient le soupçon si les trois mesures couvrent moins de six secondes', () => {
    let state = createNavigationDeviationState()
    state = updateNavigationDeviationState(state, createSample(baseTimeMs))
    state = updateNavigationDeviationState(state, createSample(baseTimeMs + 2000))
    state = updateNavigationDeviationState(state, createSample(baseTimeMs + 4000))

    expect(state.status).toBe('suspected')
  })

  it('ignore une mesure dont la précision GPS dépasse cinquante mètres', () => {
    const initialState = createNavigationDeviationState()
    const state = updateNavigationDeviationState(
      initialState,
      createSample(baseTimeMs, { accuracyMeters: 51 }),
    )

    expect(state).toEqual(initialState)
  })

  it('corrige la distance au trajet par la précision GPS', () => {
    const state = updateNavigationDeviationState(
      createNavigationDeviationState(),
      createSample(baseTimeMs, {
        distanceToRouteMeters: 60,
        accuracyMeters: 30,
      }),
    )

    expect(state.status).toBe('on_route')
    expect(state.distanceToRouteMeters).toBe(60)
  })

  it('réarme la détection après deux mesures de retour sous vingt mètres', () => {
    let state = confirmOffRoute()
    const firstOffRouteAtMs = state.firstOffRouteAtMs
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 7000, { distanceToRouteMeters: 10, accuracyMeters: 2 }),
    )
    expect(state.status).toBe('off_route')
    expect(state.firstOffRouteAtMs).toBe(firstOffRouteAtMs)

    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 8000, { distanceToRouteMeters: 10, accuracyMeters: 2 }),
    )

    expect(state.status).toBe('on_route')
    expect(state.consecutiveOnRouteSamples).toBe(0)
    expect(state.firstOffRouteAtMs).toBeNull()
    expect(
      buildNavigationDeviationEpisodeKey({ deviationState: state, routeSessionKey: 1 }),
    ).toBeNull()
  })

  it('conserve l’identité de l’épisode dans la zone d’hystérésis et à la mesure suivante', () => {
    let state = confirmOffRoute()
    const firstOffRouteAtMs = state.firstOffRouteAtMs
    const episodeKey = buildNavigationDeviationEpisodeKey({
      deviationState: state,
      routeSessionKey: 1,
    })

    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 7000, {
        distanceToRouteMeters: 35,
        accuracyMeters: 5,
      }),
    )

    expect(state.status).toBe('off_route')
    expect(state.consecutiveOffRouteSamples).toBe(0)
    expect(state.consecutiveOnRouteSamples).toBe(0)
    expect(state.firstOffRouteAtMs).toBe(firstOffRouteAtMs)
    expect(buildNavigationDeviationEpisodeKey({ deviationState: state, routeSessionKey: 1 })).toBe(
      episodeKey,
    )

    state = updateNavigationDeviationState(state, createSample(baseTimeMs + 8000))

    expect(state.status).toBe('off_route')
    expect(state.firstOffRouteAtMs).toBe(firstOffRouteAtMs)
    expect(buildNavigationDeviationEpisodeKey({ deviationState: state, routeSessionKey: 1 })).toBe(
      episodeKey,
    )
  })

  it('exige un retour réel sous vingt mètres malgré la marge de précision', () => {
    let state = confirmOffRoute()
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 7000, {
        distanceToRouteMeters: 45,
        accuracyMeters: 40,
      }),
    )
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 8000, {
        distanceToRouteMeters: 45,
        accuracyMeters: 40,
      }),
    )

    expect(state.status).toBe('off_route')
  })

  it('maintient le refus tant que le trajet n’est pas rejoint', () => {
    let state = dismissNavigationDeviation(confirmOffRoute())
    state = updateNavigationDeviationState(state, createSample(baseTimeMs + 7000))

    expect(state.status).toBe('dismissed')
  })

  it('réarme un avertissement refusé après un retour confirmé', () => {
    let state = dismissNavigationDeviation(confirmOffRoute())
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 7000, { distanceToRouteMeters: 8, accuracyMeters: 2 }),
    )
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 8000, { distanceToRouteMeters: 8, accuracyMeters: 2 }),
    )

    expect(state.status).toBe('on_route')
  })

  it('confirme une nouvelle sortie après réarmement', () => {
    const initialOffRoute = confirmOffRoute()
    const initialEpisodeKey = buildNavigationDeviationEpisodeKey({
      deviationState: initialOffRoute,
      routeSessionKey: 1,
    })
    const dismissed = dismissNavigationDeviation(initialOffRoute)
    expect(dismissed.firstOffRouteAtMs).toBeNull()
    expect(
      buildNavigationDeviationEpisodeKey({ deviationState: dismissed, routeSessionKey: 1 }),
    ).toBeNull()

    let state = dismissed
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 7000, { distanceToRouteMeters: 8, accuracyMeters: 2 }),
    )
    state = updateNavigationDeviationState(
      state,
      createSample(baseTimeMs + 8000, { distanceToRouteMeters: 8, accuracyMeters: 2 }),
    )
    state = confirmOffRoute(state, baseTimeMs + 9000)

    expect(state.status).toBe('off_route')
    expect(state.firstOffRouteAtMs).toBe(baseTimeMs + 9000)
    expect(
      buildNavigationDeviationEpisodeKey({ deviationState: state, routeSessionKey: 1 }),
    ).not.toBe(initialEpisodeKey)
  })

  it('ne fabrique pas d’identité pour un ancien état hors itinéraire incohérent', () => {
    const inconsistentState = {
      ...confirmOffRoute(),
      firstOffRouteAtMs: null,
    }
    const state = updateNavigationDeviationState(
      inconsistentState,
      createSample(baseTimeMs + 7000, {
        distanceToRouteMeters: 35,
        accuracyMeters: 5,
      }),
    )

    expect(state.status).toBe('off_route')
    expect(state.firstOffRouteAtMs).toBeNull()
    expect(
      buildNavigationDeviationEpisodeKey({ deviationState: state, routeSessionKey: 1 }),
    ).toBeNull()
  })

  it('ignore les timestamps non croissants ou trop anciens', () => {
    const suspected = updateNavigationDeviationState(
      createNavigationDeviationState(),
      createSample(baseTimeMs),
    )
    const nonIncreasing = updateNavigationDeviationState(suspected, createSample(baseTimeMs))
    const stale = updateNavigationDeviationState(
      suspected,
      createSample(baseTimeMs + 1000, { evaluatedAtMs: baseTimeMs + 32_000 }),
    )

    expect(nonIncreasing).toEqual(suspected)
    expect(stale).toEqual(suspected)
  })

  it('ignore une distance non finie ou négative', () => {
    const initialState = createNavigationDeviationState()

    expect(
      updateNavigationDeviationState(
        initialState,
        createSample(baseTimeMs, { distanceToRouteMeters: Number.NaN }),
      ),
    ).toEqual(initialState)
    expect(
      updateNavigationDeviationState(
        initialState,
        createSample(baseTimeMs, { distanceToRouteMeters: -1 }),
      ),
    ).toEqual(initialState)
  })

  it('réinitialise l’état lorsque la navigation est arrêtée', () => {
    const state = updateNavigationDeviationState(
      confirmOffRoute(),
      createSample(baseTimeMs + 7000, { isNavigationActive: false }),
    )

    expect(state).toEqual(createNavigationDeviationState())
  })

  it('ne détecte aucune sortie en simulation', () => {
    const state = updateNavigationDeviationState(
      confirmOffRoute(),
      createSample(baseTimeMs + 7000, { navigationMode: 'simulation' }),
    )

    expect(state).toEqual(createNavigationDeviationState())
  })
})
