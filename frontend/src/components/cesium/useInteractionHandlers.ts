import { useEffect, type MutableRefObject } from 'react'
import { normalizeHeadingDegrees } from './math'
import type {
  CesiumModule,
  CesiumStatus,
  StreetViewContextMenuRequest,
  StreetViewTarget,
} from './types'

type UseInteractionHandlersParams = {
  status: CesiumStatus
  onPoiSelect?: (poiId: string) => void
  onStreetViewContextMenu?: (request: StreetViewContextMenuRequest) => void
  onMapStateChange?: () => void
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  poiClickHandlerRef: MutableRefObject<import('cesium').ScreenSpaceEventHandler | null>
}

const getCameraHeadingDegrees = (Cesium: CesiumModule, viewer: import('cesium').Viewer) => {
  const heading = Cesium.Math.toDegrees(viewer.camera.heading)
  return Number.isFinite(heading) ? normalizeHeadingDegrees(heading) : undefined
}

const pickStreetViewTarget = (
  Cesium: CesiumModule,
  viewer: import('cesium').Viewer,
  position: import('cesium').Cartesian2,
): StreetViewTarget | null => {
  let cartesian: import('cesium').Cartesian3 | undefined

  if (viewer.scene.pickPositionSupported) {
    cartesian = viewer.scene.pickPosition(position)
  }

  if (!cartesian) {
    cartesian = viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid)
  }

  if (!cartesian) {
    return null
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
  const lat = Cesium.Math.toDegrees(cartographic.latitude)
  const lon = Cesium.Math.toDegrees(cartographic.longitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  return {
    lat,
    lon,
    heading: getCameraHeadingDegrees(Cesium, viewer),
  }
}

export default function useInteractionHandlers({
  status,
  onPoiSelect,
  onStreetViewContextMenu,
  onMapStateChange,
  viewerRef,
  cesiumRef,
  poiClickHandlerRef,
}: UseInteractionHandlersParams) {
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !viewer || !Cesium) {
      return
    }

    if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
      poiClickHandlerRef.current.destroy()
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    const preventNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    const removeCameraMoveStartListener = onMapStateChange
      ? viewer.camera.moveStart.addEventListener(onMapStateChange)
      : undefined

    if (onStreetViewContextMenu) {
      viewer.scene.canvas.addEventListener('contextmenu', preventNativeContextMenu)
    }

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

    if (onStreetViewContextMenu) {
      handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
        const target = pickStreetViewTarget(Cesium, viewer, movement.position)
        if (target) {
          onStreetViewContextMenu({
            x: movement.position.x,
            y: movement.position.y,
            target,
          })
        } else {
          onMapStateChange?.()
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    }

    poiClickHandlerRef.current = handler

    return () => {
      if (onStreetViewContextMenu) {
        viewer.scene.canvas.removeEventListener('contextmenu', preventNativeContextMenu)
      }
      removeCameraMoveStartListener?.()
      if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
        poiClickHandlerRef.current.destroy()
      }
      poiClickHandlerRef.current = null
    }
  }, [
    cesiumRef,
    onMapStateChange,
    onPoiSelect,
    onStreetViewContextMenu,
    poiClickHandlerRef,
    status,
    viewerRef,
  ])
}
