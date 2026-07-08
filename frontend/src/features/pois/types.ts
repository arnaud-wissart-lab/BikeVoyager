import type { PoiCategory } from '../routing/domain'

export type PoiCategoryOption = {
  value: PoiCategory
  label: string
}

export type PoiAdvancedFilterGroupKey = PoiCategory

export type PoiAdvancedFilterOptionKey =
  | 'drinking_water'
  | 'toilets'
  | 'shelter'
  | 'bicycle_repair_station'
  | 'bicycle_parking'
  | 'pharmacy'
  | 'transport'
  | 'charging_station'
  | 'bank_atm'
  | 'car_parking'
  | 'services_other'
  | 'bakery'
  | 'convenience'
  | 'supermarket'
  | 'market'
  | 'cafe_restaurant'
  | 'farm_local'
  | 'shops_other'
  | 'viewpoint'
  | 'water'
  | 'beach_bay'
  | 'peak'
  | 'picnic'
  | 'landscapes_other'
  | 'monument'
  | 'castle'
  | 'museum'
  | 'historic_site'
  | 'place_of_worship'
  | 'memorial'
  | 'monuments_other'

export type PoiAdvancedFilterOption = {
  key: PoiAdvancedFilterOptionKey
  labelKey: string
}

export type PoiAdvancedFilterGroup = {
  key: PoiAdvancedFilterGroupKey
  labelKey: string
  options: PoiAdvancedFilterOption[]
}

export type PoiAdvancedFilterSettings = Record<
  PoiAdvancedFilterGroupKey,
  PoiAdvancedFilterOptionKey[]
>
