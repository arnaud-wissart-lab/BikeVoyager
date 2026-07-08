import { useMemo } from 'react'
import type { PoiCategory, PoiItem } from '../routing/domain'
import type { PoiAdvancedFilterSettings } from './types'
import { shouldDisplayPoiByAdvancedFilters } from './advancedFilters'
import { deduplicatePoiItems } from './poiDeduplication'

type UseVisiblePoisParams = {
  poiAdvancedFilterSettings: PoiAdvancedFilterSettings
  poiCategories: PoiCategory[]
  poiItems: PoiItem[]
}

export const useVisiblePois = ({
  poiAdvancedFilterSettings,
  poiCategories,
  poiItems,
}: UseVisiblePoisParams) => {
  const hasPoiCategories = poiCategories.length > 0

  const visiblePoiItems = useMemo(() => {
    if (poiCategories.length === 0 || poiItems.length === 0) {
      return [] as PoiItem[]
    }

    const selectedCategories = new Set<PoiCategory>(poiCategories)
    const filteredPois = poiItems.filter(
      (poi) =>
        selectedCategories.has(poi.category) &&
        shouldDisplayPoiByAdvancedFilters(poi, poiAdvancedFilterSettings),
    )
    return deduplicatePoiItems(filteredPois)
  }, [poiAdvancedFilterSettings, poiCategories, poiItems])

  return {
    hasPoiCategories,
    visiblePoiItems,
  }
}
