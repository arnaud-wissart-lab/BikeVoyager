import {
  buildNavigationDeviationEpisodeKey,
  clampNavigationAutoRecalculationCountdown,
  createNavigationDeviationState,
  resolveNavigationAutoRecalculationDecision,
  type NavigationDeviationState,
} from '../features/routing/domain'

const offRouteState = (firstOffRouteAtMs = 1000): NavigationDeviationState => ({
  ...createNavigationDeviationState(),
  status: 'off_route',
  firstOffRouteAtMs,
  distanceToRouteMeters: 75,
  accuracyMeters: 5,
})

const decide = (
  overrides: Partial<Parameters<typeof resolveNavigationAutoRecalculationDecision>[0]> = {},
) =>
  resolveNavigationAutoRecalculationDecision({
    enabled: true,
    isNavigationActive: true,
    navigationMode: 'gps',
    deviationState: offRouteState(),
    routeSessionKey: 3,
    isRecalculationAvailable: true,
    isRecalculationLoading: false,
    attemptedEpisodeKey: null,
    cancelledEpisodeKey: null,
    ...overrides,
  })

describe('navigationAutoRecalculation', () => {
  it('identifie un épisode avec la session et la première mesure hors itinéraire', () => {
    expect(
      buildNavigationDeviationEpisodeKey({
        deviationState: offRouteState(1234),
        routeSessionKey: 7,
      }),
    ).toBe('7:1234')
    expect(
      buildNavigationDeviationEpisodeKey({
        deviationState: { ...offRouteState(), status: 'suspected' },
        routeSessionKey: 7,
      }),
    ).toBeNull()
  })

  it.each([
    ['option désactivée', { enabled: false }, 'disabled'],
    ['simulation', { navigationMode: 'simulation' }, 'not_off_route'],
    ['navigation inactive', { isNavigationActive: false }, 'not_off_route'],
    [
      'statut suspected',
      { deviationState: { ...offRouteState(), status: 'suspected' } },
      'not_off_route',
    ],
    ['plan indisponible', { isRecalculationAvailable: false }, 'unavailable'],
    ['recalcul en cours', { isRecalculationLoading: true }, 'loading'],
    ['épisode déjà tenté', { attemptedEpisodeKey: '3:1000' }, 'already_attempted'],
    ['épisode annulé', { cancelledEpisodeKey: '3:1000' }, 'cancelled'],
  ] as const)('refuse le compte à rebours quand %s', (_label, overrides, reason) => {
    expect(decide(overrides)).toEqual({ shouldCountdown: false, reason })
  })

  it('autorise le compte à rebours hors itinéraire avec un plan disponible', () => {
    expect(decide()).toEqual({ shouldCountdown: true, episodeKey: '3:1000' })
  })

  it('autorise un nouvel épisode ou une nouvelle session après une tentative', () => {
    expect(
      decide({
        deviationState: offRouteState(2000),
        attemptedEpisodeKey: '3:1000',
      }),
    ).toEqual({ shouldCountdown: true, episodeKey: '3:2000' })
    expect(decide({ routeSessionKey: 4, attemptedEpisodeKey: '3:1000' })).toEqual({
      shouldCountdown: true,
      episodeKey: '4:1000',
    })
  })

  it('calcule les secondes restantes depuis une échéance absolue', () => {
    expect(clampNavigationAutoRecalculationCountdown(9000, 1000)).toBe(8)
    expect(clampNavigationAutoRecalculationCountdown(9000, 1501)).toBe(8)
    expect(clampNavigationAutoRecalculationCountdown(9000, 8999)).toBe(1)
    expect(clampNavigationAutoRecalculationCountdown(9000, 9000)).toBe(0)
    expect(clampNavigationAutoRecalculationCountdown(9000, 12_000)).toBe(0)
  })
})
