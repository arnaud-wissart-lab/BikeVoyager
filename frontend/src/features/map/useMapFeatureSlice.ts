import type { MapViewMode, PoiItem } from '../routing/domain'
import useMapPageController from './useMapPageController'

type UseMapFeatureSliceParams = {
  initialMapViewMode: MapViewMode
  isDesktop: boolean
  visiblePoiItems: PoiItem[]
  poiItems: PoiItem[]
  activePoiAlertId: string | null
}

export const useMapFeatureSlice = (params: UseMapFeatureSliceParams) =>
  useMapPageController(params)
