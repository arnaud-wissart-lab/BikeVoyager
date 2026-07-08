import type { PoiCategory, PoiItem } from '../routing/domain'
import type { PoiAdvancedFilterSettings } from './types'
import { useVisiblePois } from './useVisiblePois'

type UsePoisFeatureSliceParams = {
  poiAdvancedFilterSettings: PoiAdvancedFilterSettings
  poiCategories: PoiCategory[]
  poiItems: PoiItem[]
}

export const usePoisFeatureSlice = (params: UsePoisFeatureSliceParams) => useVisiblePois(params)
