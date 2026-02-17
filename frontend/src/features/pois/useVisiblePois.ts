import { useMemo } from 'react'
import type { PoiCategory, PoiItem } from '../routing/domain'
import { deduplicatePoiItems } from './poiDeduplication'

type UseVisiblePoisParams = {
  poiCategories: PoiCategory[]
  poiItems: PoiItem[]
}

export const useVisiblePois = ({ poiCategories, poiItems }: UseVisiblePoisParams) => {
  const hasPoiCategories = poiCategories.length > 0

  const visiblePoiItems = useMemo(() => {
    if (poiCategories.length === 0 || poiItems.length === 0) {
      return [] as PoiItem[]
    }

    const selectedCategories = new Set<PoiCategory>(poiCategories)
    const filteredPois = poiItems.filter((poi) => selectedCategories.has(poi.category))
    return deduplicatePoiItems(filteredPois)
  }, [poiCategories, poiItems])

  return {
    hasPoiCategories,
    visiblePoiItems,
  }
}
