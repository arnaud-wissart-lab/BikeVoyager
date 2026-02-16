import { useEffect, type MutableRefObject } from 'react'
import type { CesiumModule, CesiumStatus } from './types'

type UseInteractionHandlersParams = {
  status: CesiumStatus
  onPoiSelect?: (poiId: string) => void
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  poiClickHandlerRef: MutableRefObject<import('cesium').ScreenSpaceEventHandler | null>
}

export default function useInteractionHandlers({
  status,
  onPoiSelect,
  viewerRef,
  cesiumRef,
  poiClickHandlerRef,
}: UseInteractionHandlersParams) {
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (!viewer || !Cesium) {
      return
    }

    if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
      poiClickHandlerRef.current.destroy()
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
      if (!onPoiSelect) {
        return
      }

      const picked = viewer.scene.pick(movement.position)
      if (!Cesium.defined(picked)) {
        return
      }

      const pickedEntity = (picked as { id?: import('cesium').Entity }).id
      const poiProperty = pickedEntity?.properties?.poiId
      if (!poiProperty) {
        return
      }

      const poiId =
        typeof poiProperty.getValue === 'function'
          ? poiProperty.getValue(Cesium.JulianDate.now())
          : poiProperty

      if (typeof poiId === 'string' && poiId.trim()) {
        onPoiSelect(poiId)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    poiClickHandlerRef.current = handler

    return () => {
      if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
        poiClickHandlerRef.current.destroy()
      }
      poiClickHandlerRef.current = null
    }
  }, [onPoiSelect, status])
}
