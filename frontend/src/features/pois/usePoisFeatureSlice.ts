import type { PoiCategory, PoiItem } from '../routing/domain'
import { useVisiblePois } from './useVisiblePois'

type UsePoisFeatureSliceParams = {
  poiCategories: PoiCategory[]
  poiItems: PoiItem[]
}

export const usePoisFeatureSlice = (params: UsePoisFeatureSliceParams) => useVisiblePois(params)
