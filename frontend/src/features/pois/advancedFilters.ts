import type { PoiItem } from '../routing/domain'
import type {
  PoiAdvancedFilterGroup,
  PoiAdvancedFilterGroupKey,
  PoiAdvancedFilterOptionKey,
  PoiAdvancedFilterSettings,
} from './types'

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? ''

const categoryOrder: PoiAdvancedFilterGroupKey[] = [
  'services',
  'commerces',
  'paysages',
  'monuments',
]

export const poiAdvancedFilterGroups: PoiAdvancedFilterGroup[] = [
  {
    key: 'services',
    labelKey: 'poiAdvancedFiltersServices',
    options: [
      { key: 'drinking_water', labelKey: 'poiAdvancedFilterDrinkingWater' },
      { key: 'toilets', labelKey: 'poiAdvancedFilterToilets' },
      { key: 'shelter', labelKey: 'poiAdvancedFilterShelter' },
      { key: 'bicycle_repair_station', labelKey: 'poiAdvancedFilterBicycleRepair' },
      { key: 'bicycle_parking', labelKey: 'poiAdvancedFilterBicycleParking' },
      { key: 'pharmacy', labelKey: 'poiAdvancedFilterPharmacy' },
      { key: 'transport', labelKey: 'poiAdvancedFilterTransport' },
      { key: 'charging_station', labelKey: 'poiAdvancedFilterChargingStation' },
      { key: 'bank_atm', labelKey: 'poiAdvancedFilterBankAtm' },
      { key: 'car_parking', labelKey: 'poiAdvancedFilterCarParking' },
      { key: 'services_other', labelKey: 'poiAdvancedFilterServicesOther' },
    ],
  },
  {
    key: 'commerces',
    labelKey: 'poiAdvancedFiltersShops',
    options: [
      { key: 'bakery', labelKey: 'poiAdvancedFilterBakery' },
      { key: 'convenience', labelKey: 'poiAdvancedFilterConvenience' },
      { key: 'supermarket', labelKey: 'poiAdvancedFilterSupermarket' },
      { key: 'market', labelKey: 'poiAdvancedFilterMarket' },
      { key: 'cafe_restaurant', labelKey: 'poiAdvancedFilterCafeRestaurant' },
      { key: 'farm_local', labelKey: 'poiAdvancedFilterFarmLocal' },
      { key: 'shops_other', labelKey: 'poiAdvancedFilterShopsOther' },
    ],
  },
  {
    key: 'paysages',
    labelKey: 'poiAdvancedFiltersLandscapes',
    options: [
      { key: 'viewpoint', labelKey: 'poiAdvancedFilterViewpoint' },
      { key: 'water', labelKey: 'poiAdvancedFilterWater' },
      { key: 'beach_bay', labelKey: 'poiAdvancedFilterBeachBay' },
      { key: 'peak', labelKey: 'poiAdvancedFilterPeak' },
      { key: 'picnic', labelKey: 'poiAdvancedFilterPicnic' },
      { key: 'landscapes_other', labelKey: 'poiAdvancedFilterLandscapesOther' },
    ],
  },
  {
    key: 'monuments',
    labelKey: 'poiAdvancedFiltersMonuments',
    options: [
      { key: 'monument', labelKey: 'poiAdvancedFilterMonument' },
      { key: 'castle', labelKey: 'poiAdvancedFilterCastle' },
      { key: 'museum', labelKey: 'poiAdvancedFilterMuseum' },
      { key: 'historic_site', labelKey: 'poiAdvancedFilterHistoricSite' },
      { key: 'place_of_worship', labelKey: 'poiAdvancedFilterPlaceOfWorship' },
      { key: 'memorial', labelKey: 'poiAdvancedFilterMemorial' },
      { key: 'monuments_other', labelKey: 'poiAdvancedFilterMonumentsOther' },
    ],
  },
]

const filterGroupByCategory = new Map(
  poiAdvancedFilterGroups.map((group) => [group.key, group] as const),
)

const allFilterKeys = new Set<string>(
  poiAdvancedFilterGroups.flatMap((group) => group.options.map((option) => option.key)),
)

export const createDefaultPoiAdvancedFilterSettings = (): PoiAdvancedFilterSettings =>
  Object.fromEntries(
    poiAdvancedFilterGroups.map((group) => [group.key, group.options.map((option) => option.key)]),
  ) as PoiAdvancedFilterSettings

export const defaultPoiAdvancedFilterSettings = createDefaultPoiAdvancedFilterSettings()

export const usefulBikePoiAdvancedFilterSettings: PoiAdvancedFilterSettings = {
  services: [
    'drinking_water',
    'toilets',
    'shelter',
    'bicycle_repair_station',
    'bicycle_parking',
    'pharmacy',
    'transport',
    'charging_station',
    'bank_atm',
  ],
  commerces: ['bakery', 'convenience', 'supermarket', 'market', 'cafe_restaurant', 'farm_local'],
  paysages: ['viewpoint', 'water', 'picnic'],
  monuments: [],
}

export const getPoiAdvancedFilterOptionKeys = (groupKey: PoiAdvancedFilterGroupKey) =>
  filterGroupByCategory.get(groupKey)?.options.map((option) => option.key) ?? []

export const getPoiAdvancedFilterSelectedCount = (settings: PoiAdvancedFilterSettings) =>
  categoryOrder.reduce((count, groupKey) => count + (settings[groupKey]?.length ?? 0), 0)

export const normalizePoiAdvancedFilterSettings = (value: unknown): PoiAdvancedFilterSettings => {
  if (!value || typeof value !== 'object') {
    return createDefaultPoiAdvancedFilterSettings()
  }

  const source = value as Partial<Record<PoiAdvancedFilterGroupKey, unknown>>
  return Object.fromEntries(
    poiAdvancedFilterGroups.map((group) => {
      const allowed = new Set<string>(group.options.map((option) => option.key))
      const rawValues = source[group.key]
      if (!Array.isArray(rawValues)) {
        return [group.key, group.options.map((option) => option.key)]
      }

      const selected = Array.from(
        new Set(
          rawValues.filter(
            (option): option is PoiAdvancedFilterOptionKey =>
              typeof option === 'string' && allFilterKeys.has(option) && allowed.has(option),
          ),
        ),
      )
      return [group.key, selected]
    }),
  ) as PoiAdvancedFilterSettings
}

const getTagValue = (poi: PoiItem, key: string) => normalizeValue(poi.tags?.[key])

const hasTagValue = (poi: PoiItem, key: string, values: string[]) => {
  const value = getTagValue(poi, key)
  return value.length > 0 && values.includes(value)
}

const kindMatches = (poi: PoiItem, key: string, values: string[]) => {
  const kind = normalizeValue(poi.kind)
  return values.some((value) => kind === `${key}:${value}` || kind.endsWith(`:${value}`))
}

const addIf = (
  keys: Set<PoiAdvancedFilterOptionKey>,
  condition: boolean,
  key: PoiAdvancedFilterOptionKey,
) => {
  if (condition) {
    keys.add(key)
  }
}

export const getPoiFilterKeys = (poi: PoiItem): PoiAdvancedFilterOptionKey[] => {
  const keys = new Set<PoiAdvancedFilterOptionKey>()

  if (poi.category === 'services') {
    const amenity = getTagValue(poi, 'amenity')
    const bicycleParking = getTagValue(poi, 'bicycle_parking')

    addIf(
      keys,
      amenity === 'drinking_water' || getTagValue(poi, 'drinking_water') === 'yes',
      'drinking_water',
    )
    addIf(keys, amenity === 'toilets', 'toilets')
    addIf(keys, amenity === 'shelter' || getTagValue(poi, 'shelter') === 'yes', 'shelter')
    addIf(keys, amenity === 'bicycle_repair_station', 'bicycle_repair_station')
    addIf(keys, amenity === 'bicycle_parking' || bicycleParking.length > 0, 'bicycle_parking')
    addIf(keys, amenity === 'pharmacy', 'pharmacy')
    addIf(
      keys,
      ['bus_station', 'ferry_terminal', 'taxi'].includes(amenity) ||
        hasTagValue(poi, 'railway', ['station', 'halt', 'tram_stop']) ||
        hasTagValue(poi, 'public_transport', ['station', 'stop_position', 'platform']) ||
        hasTagValue(poi, 'highway', ['bus_stop']),
      'transport',
    )
    addIf(
      keys,
      amenity === 'charging_station' || getTagValue(poi, 'charging_station') === 'yes',
      'charging_station',
    )
    addIf(keys, ['atm', 'bank'].includes(amenity), 'bank_atm')
    addIf(keys, amenity === 'parking', 'car_parking')

    return keys.size > 0 ? Array.from(keys) : ['services_other']
  }

  if (poi.category === 'commerces') {
    const shop = getTagValue(poi, 'shop')
    const amenity = getTagValue(poi, 'amenity')

    addIf(keys, shop === 'bakery', 'bakery')
    addIf(keys, shop === 'convenience', 'convenience')
    addIf(keys, shop === 'supermarket', 'supermarket')
    addIf(
      keys,
      shop === 'farm' || shop === 'farm_shop' || hasTagValue(poi, 'craft', ['beekeeper', 'winery']),
      'farm_local',
    )
    addIf(
      keys,
      shop === 'marketplace' || amenity === 'marketplace' || getTagValue(poi, 'market') === 'yes',
      'market',
    )
    addIf(
      keys,
      [
        'bar',
        'biergarten',
        'cafe',
        'fast_food',
        'food_court',
        'ice_cream',
        'pub',
        'restaurant',
      ].includes(amenity),
      'cafe_restaurant',
    )

    return keys.size > 0 ? Array.from(keys) : ['shops_other']
  }

  if (poi.category === 'paysages') {
    addIf(
      keys,
      hasTagValue(poi, 'tourism', ['viewpoint']) || kindMatches(poi, 'tourism', ['viewpoint']),
      'viewpoint',
    )
    addIf(
      keys,
      hasTagValue(poi, 'natural', ['spring', 'water', 'waterfall']) ||
        hasTagValue(poi, 'waterway', ['waterfall']) ||
        kindMatches(poi, 'natural', ['spring', 'water', 'waterfall']),
      'water',
    )
    addIf(
      keys,
      hasTagValue(poi, 'natural', ['bay', 'beach']) ||
        hasTagValue(poi, 'tourism', ['beach']) ||
        kindMatches(poi, 'natural', ['bay', 'beach']),
      'beach_bay',
    )
    addIf(
      keys,
      hasTagValue(poi, 'natural', ['peak']) || kindMatches(poi, 'natural', ['peak']),
      'peak',
    )
    addIf(
      keys,
      hasTagValue(poi, 'leisure', ['picnic_table', 'picnic_site']) ||
        hasTagValue(poi, 'tourism', ['picnic_site']) ||
        kindMatches(poi, 'tourism', ['picnic_site']),
      'picnic',
    )

    return keys.size > 0 ? Array.from(keys) : ['landscapes_other']
  }

  const historic = getTagValue(poi, 'historic')
  const tourism = getTagValue(poi, 'tourism')
  const amenity = getTagValue(poi, 'amenity')

  addIf(keys, historic === 'monument' || kindMatches(poi, 'historic', ['monument']), 'monument')
  addIf(
    keys,
    historic === 'castle' || tourism === 'castle' || kindMatches(poi, 'historic', ['castle']),
    'castle',
  )
  addIf(keys, tourism === 'museum' || kindMatches(poi, 'tourism', ['museum']), 'museum')
  addIf(
    keys,
    ['archaeological_site', 'heritage', 'ruins'].includes(historic) ||
      kindMatches(poi, 'historic', ['archaeological_site', 'heritage', 'ruins']),
    'historic_site',
  )
  addIf(
    keys,
    amenity === 'place_of_worship' || kindMatches(poi, 'amenity', ['place_of_worship']),
    'place_of_worship',
  )
  addIf(keys, historic === 'memorial' || kindMatches(poi, 'historic', ['memorial']), 'memorial')

  return keys.size > 0 ? Array.from(keys) : ['monuments_other']
}

export const classifyPoiSubtype = getPoiFilterKeys

export const shouldDisplayPoiByAdvancedFilters = (
  poi: PoiItem,
  settings: PoiAdvancedFilterSettings,
) => {
  const selectedKeys = new Set(
    settings[poi.category] ?? getPoiAdvancedFilterOptionKeys(poi.category),
  )
  if (selectedKeys.size === 0) {
    return false
  }

  return getPoiFilterKeys(poi).some((key) => selectedKeys.has(key))
}
