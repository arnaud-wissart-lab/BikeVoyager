import { useEffect, type MutableRefObject } from 'react'
import type { MapViewMode } from '../../features/routing/domain'
import type { CesiumModule, CesiumStatus } from './types'

type UseMapLayersParams = {
  status: CesiumStatus
  viewMode: MapViewMode
  navigationActive: boolean
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
}

export default function useMapLayers({
  status,
  viewMode,
  navigationActive,
  viewerRef,
  cesiumRef,
}: UseMapLayersParams) {
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    if (navigationActive) {
      return
    }

    if (viewMode === '2d') {
      viewer.scene.morphTo2D(0)
    } else {
      viewer.scene.morphTo3D(0)
    }
    viewer.scene.requestRender()
  }, [cesiumRef, navigationActive, status, viewMode, viewerRef])
}
