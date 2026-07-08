import {
  createDefaultPoiAdvancedFilterSettings,
  getPoiFilterKeys,
  shouldDisplayPoiByAdvancedFilters,
} from '../features/pois/advancedFilters'
import type { PoiItem } from '../features/routing/domain'

const createPoi = (overrides: Partial<PoiItem>): PoiItem => ({
  id: 'poi',
  name: 'POI',
  lat: 48.8566,
  lon: 2.3522,
  category: 'services',
  kind: null,
  distance_m: 120,
  tags: {},
  ...overrides,
})

describe('poiAdvancedFilters', () => {
  it.each([
    ['drinking_water', createPoi({ tags: { amenity: 'drinking_water' } }), ['drinking_water']],
    ['toilets', createPoi({ tags: { amenity: 'toilets' } }), ['toilets']],
    ['shelter', createPoi({ tags: { amenity: 'shelter' } }), ['shelter']],
    [
      'bicycle_repair_station',
      createPoi({ tags: { amenity: 'bicycle_repair_station' } }),
      ['bicycle_repair_station'],
    ],
    [
      'bicycle_parking amenity',
      createPoi({ tags: { amenity: 'bicycle_parking' } }),
      ['bicycle_parking'],
    ],
    [
      'bicycle_parking tag',
      createPoi({ tags: { bicycle_parking: 'stands' } }),
      ['bicycle_parking'],
    ],
    ['parking voiture', createPoi({ tags: { amenity: 'parking' } }), ['car_parking']],
    ['pharmacy', createPoi({ tags: { amenity: 'pharmacy' } }), ['pharmacy']],
    ['bakery', createPoi({ category: 'commerces', tags: { shop: 'bakery' } }), ['bakery']],
    [
      'convenience',
      createPoi({ category: 'commerces', tags: { shop: 'convenience' } }),
      ['convenience'],
    ],
    [
      'supermarket',
      createPoi({ category: 'commerces', tags: { shop: 'supermarket' } }),
      ['supermarket'],
    ],
    [
      'viewpoint',
      createPoi({ category: 'paysages', tags: { tourism: 'viewpoint' } }),
      ['viewpoint'],
    ],
    ['peak', createPoi({ category: 'paysages', tags: { natural: 'peak' } }), ['peak']],
    [
      'castle historic',
      createPoi({ category: 'monuments', tags: { historic: 'castle' } }),
      ['castle'],
    ],
    [
      'castle tourism',
      createPoi({ category: 'monuments', tags: { tourism: 'castle' } }),
      ['castle'],
    ],
  ])('classe %s', (_, poi, expectedKeys) => {
    expect(getPoiFilterKeys(poi)).toEqual(expectedKeys)
  })

  it.each([
    [createPoi({ tags: { amenity: 'bench' } }), ['services_other']],
    [createPoi({ category: 'commerces', tags: { shop: 'hardware' } }), ['shops_other']],
    [createPoi({ category: 'paysages', tags: { natural: 'wood' } }), ['landscapes_other']],
    [
      createPoi({ category: 'monuments', tags: { historic: 'wayside_cross' } }),
      ['monuments_other'],
    ],
  ])('classe les tags inconnus dans les autres de leur catégorie', (poi, expectedKeys) => {
    expect(getPoiFilterKeys(poi)).toEqual(expectedKeys)
  })

  it('masque un POI quand son sous-filtre est désactivé', () => {
    const settings = createDefaultPoiAdvancedFilterSettings()
    settings.services = settings.services.filter((key) => key !== 'car_parking')

    expect(
      shouldDisplayPoiByAdvancedFilters(createPoi({ tags: { amenity: 'parking' } }), settings),
    ).toBe(false)
  })

  it('masque toute une catégorie quand aucun sous-filtre avancé n’est actif', () => {
    const settings = createDefaultPoiAdvancedFilterSettings()
    settings.services = []

    expect(
      shouldDisplayPoiByAdvancedFilters(
        createPoi({ tags: { amenity: 'drinking_water' } }),
        settings,
      ),
    ).toBe(false)
  })

  it('affiche un POI quand son sous-filtre est actif', () => {
    const settings = createDefaultPoiAdvancedFilterSettings()
    settings.services = ['car_parking']

    expect(
      shouldDisplayPoiByAdvancedFilters(createPoi({ tags: { amenity: 'parking' } }), settings),
    ).toBe(true)
  })

  it('le reset revient aux valeurs par défaut', () => {
    const settings = createDefaultPoiAdvancedFilterSettings()

    expect(settings.services).toContain('drinking_water')
    expect(settings.services).toContain('car_parking')
    expect(settings.commerces).toContain('bakery')
    expect(settings.paysages).toContain('viewpoint')
    expect(settings.monuments).toContain('castle')
  })
})
