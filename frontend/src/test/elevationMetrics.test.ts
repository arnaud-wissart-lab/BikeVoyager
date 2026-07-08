import {
  computeElevationGain,
  computeElevationLoss,
  computeElevationMinMax,
  computeElevationStats,
  computeMaxSlope,
  computeRouteDifficulty,
  reliableSlopeMinimumDistanceMeters,
  routeDifficultyMinimumDistanceMeters,
  type RouteElevationPoint,
} from '../features/routing/domain'

const flatProfile: RouteElevationPoint[] = [
  { distance_m: 0, elevation_m: 100 },
  { distance_m: 1000, elevation_m: 100 },
  { distance_m: 2000, elevation_m: 100 },
]

const uphillProfile: RouteElevationPoint[] = [
  { distance_m: 0, elevation_m: 100 },
  { distance_m: 1000, elevation_m: 180 },
]

const downhillProfile: RouteElevationPoint[] = [
  { distance_m: 0, elevation_m: 180 },
  { distance_m: 1000, elevation_m: 120 },
]

const rollingProfile: RouteElevationPoint[] = [
  { distance_m: 0, elevation_m: 100 },
  { distance_m: 1000, elevation_m: 130 },
  { distance_m: 1500, elevation_m: 125 },
  { distance_m: 2500, elevation_m: 160 },
  { distance_m: 3000, elevation_m: 140 },
]

describe('elevationMetrics', () => {
  it('calcule une route plate sans dénivelé ni pente', () => {
    expect(computeElevationGain(flatProfile)).toBe(0)
    expect(computeElevationLoss(flatProfile)).toBe(0)
    expect(computeElevationMinMax(flatProfile)).toEqual({ min: 100, max: 100 })
    expect(computeMaxSlope(flatProfile)).toBe(0)
  })

  it('calcule une montée simple', () => {
    expect(computeElevationGain(uphillProfile)).toBe(80)
    expect(computeElevationLoss(uphillProfile)).toBe(0)
    expect(computeElevationMinMax(uphillProfile)).toEqual({ min: 100, max: 180 })
    expect(computeMaxSlope(uphillProfile)).toBe(8)
  })

  it('calcule une descente simple sans pente montante', () => {
    expect(computeElevationGain(downhillProfile)).toBe(0)
    expect(computeElevationLoss(downhillProfile)).toBe(60)
    expect(computeElevationMinMax(downhillProfile)).toEqual({ min: 120, max: 180 })
    expect(computeMaxSlope(downhillProfile)).toBe(0)
  })

  it('calcule une route vallonnée', () => {
    expect(computeElevationGain(rollingProfile)).toBe(65)
    expect(computeElevationLoss(rollingProfile)).toBe(25)
    expect(computeElevationMinMax(rollingProfile)).toEqual({ min: 100, max: 160 })
    expect(computeMaxSlope(rollingProfile)).toBeCloseTo(3.5, 6)
  })

  it('calcule un jeu de statistiques cohérent', () => {
    const stats = computeElevationStats(rollingProfile)

    expect(stats).toMatchObject({
      elevationGainMeters: 65,
      elevationLossMeters: 25,
      elevationMinMax: { min: 100, max: 160 },
      isAvailable: true,
    })
    expect(stats.maxSlopePercent).toBeCloseTo(3.5, 6)
  })

  it('ignore les valeurs non finies et les distances incohérentes', () => {
    const invalidProfile = [
      null,
      { distance_m: 0, elevation_m: 100 },
      { distance_m: 500, elevation_m: Number.NaN },
      { distance_m: 1000, elevation_m: 140 },
      { distance_m: 900, elevation_m: 220 },
      { distance_m: 1000, elevation_m: 220 },
      { distance_m: 1500, elevation_m: 120 },
    ]

    expect(computeElevationGain(invalidProfile)).toBe(40)
    expect(computeElevationLoss(invalidProfile)).toBe(20)
    expect(computeElevationMinMax(invalidProfile)).toEqual({ min: 100, max: 140 })
  })

  it('ignore les points sans altitude exploitable', () => {
    const incompleteProfile = [
      { distance_m: 0, elevation_m: 100 },
      { distance_m: 500 },
      { distance_m: 1000, elevation_m: null },
      { distance_m: 2000, elevation_m: 140 },
    ]

    expect(computeElevationGain(incompleteProfile)).toBe(40)
    expect(computeElevationLoss(incompleteProfile)).toBe(0)
    expect(computeElevationMinMax(incompleteProfile)).toEqual({ min: 100, max: 140 })
  })

  it('ignore les doublons de distance', () => {
    const duplicateDistanceProfile: RouteElevationPoint[] = [
      { distance_m: 0, elevation_m: 100 },
      { distance_m: 0, elevation_m: 200 },
      { distance_m: 1000, elevation_m: 140 },
    ]

    expect(computeElevationGain(duplicateDistanceProfile)).toBe(40)
    expect(computeElevationLoss(duplicateDistanceProfile)).toBe(0)
  })

  it('ne calcule pas de pente maximale sur un segment trop court', () => {
    expect(
      computeMaxSlope([
        { distance_m: 0, elevation_m: 100 },
        { distance_m: reliableSlopeMinimumDistanceMeters - 1, elevation_m: 103 },
      ]),
    ).toBeNull()
  })

  it('calcule la pente sur un segment qui atteint le seuil fiable', () => {
    expect(
      computeMaxSlope([
        { distance_m: 0, elevation_m: 100 },
        { distance_m: reliableSlopeMinimumDistanceMeters, elevation_m: 110 },
      ]),
    ).toBe(50)
  })

  it('retourne null quand le profil est absent ou incomplet', () => {
    expect(computeElevationGain(null)).toBeNull()
    expect(computeElevationLoss([{ distance_m: 0, elevation_m: 100 }])).toBeNull()
    expect(computeElevationMinMax([])).toBeNull()
    expect(computeElevationMinMax([{ distance_m: 0, elevation_m: 100 }])).toBeNull()
    expect(computeMaxSlope([{ distance_m: 0, elevation_m: 100 }])).toBeNull()
    expect(computeElevationStats(null).isAvailable).toBe(false)
  })

  it('classe une difficulté simple selon le mode', () => {
    expect(computeRouteDifficulty(5000, 80, 4, 'bike')).toBe('easy')
    expect(computeRouteDifficulty(30000, 350, 7, 'bike')).toBe('moderate')
    expect(computeRouteDifficulty(65000, 900, 11, 'bike')).toBe('demanding')
    expect(computeRouteDifficulty(110000, 1600, 15, 'bike')).toBe('hard')
    expect(computeRouteDifficulty(30000, 350, 7, 'ebike', 'medium')).toBe('easy')
  })

  it('tient compte du niveau d’assistance VAE', () => {
    expect(computeRouteDifficulty(34000, 470, 7.5, 'ebike', 'low')).toBe('moderate')
    expect(computeRouteDifficulty(34000, 470, 7.5, 'ebike', 'high')).toBe('easy')
  })

  it('classe le VAE plus bas que le vélo classique à effort comparable', () => {
    expect(computeRouteDifficulty(65000, 900, 11, 'bike')).toBe('demanding')
    expect(computeRouteDifficulty(65000, 900, 11, 'ebike', 'medium')).toBe('moderate')
  })

  it('classe la difficulté sans pente fiable si distance et D+ sont valides', () => {
    expect(computeRouteDifficulty(65000, 900, null, 'bike')).toBe('demanding')
  })

  it('ne classe pas une route trop courte pour une difficulté heuristique', () => {
    expect(
      computeRouteDifficulty(routeDifficultyMinimumDistanceMeters - 1, 30, null, 'bike'),
    ).toBeNull()
  })

  it('retourne null pour les entrées de difficulté incomplètes', () => {
    expect(computeRouteDifficulty(null, 100, 4, 'bike')).toBeNull()
    expect(computeRouteDifficulty(10000, null, 4, 'bike')).toBeNull()
    expect(computeRouteDifficulty(10000, 100, 4, null)).toBeNull()
  })
})
