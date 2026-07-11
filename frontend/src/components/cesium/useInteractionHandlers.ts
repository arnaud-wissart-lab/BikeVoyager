import { useEffect, type MutableRefObject } from 'react'
import { isHandlerUsable, isViewerUsable, type CesiumInteractionLifecycleRef } from './lifecycle'
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
  interactionLifecycleRef: CesiumInteractionLifecycleRef
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
  interactionLifecycleRef,
}: UseInteractionHandlersParams) {
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !isViewerUsable(viewer) || !Cesium) {
      return
    }

    const previousHandler = poiClickHandlerRef.current
    const previousLifecycle = interactionLifecycleRef.current
    if (previousLifecycle?.handler === previousHandler) {
      previousLifecycle.cleanup()
    } else if (isHandlerUsable(previousHandler)) {
      previousHandler.destroy()
    }

    const canvas = viewer.scene.canvas
    const handler = new Cesium.ScreenSpaceEventHandler(canvas)
    const preventNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    const removeCameraMoveStartListener = onMapStateChange
      ? viewer.camera.moveStart.addEventListener(onMapStateChange)
      : undefined

    if (onStreetViewContextMenu) {
      canvas.addEventListener('contextmenu', preventNativeContextMenu)
    }

    handler.setInputAction((movement: { position: import('cesium').Cartesian2 }) => {
      if (!onPoiSelect || !isViewerUsable(viewer) || !isHandlerUsable(handler)) {
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
        if (!isViewerUsable(viewer) || !isHandlerUsable(handler)) {
          return
        }

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
    let isCleanedUp = false

    const cleanup = () => {
      if (isCleanedUp) {
        return
      }
      isCleanedUp = true

      if (onStreetViewContextMenu) {
        canvas.removeEventListener('contextmenu', preventNativeContextMenu)
      }
      removeCameraMoveStartListener?.()
      if (isHandlerUsable(handler)) {
        handler.destroy()
      }
      if (poiClickHandlerRef.current === handler) {
        poiClickHandlerRef.current = null
      }
      if (interactionLifecycleRef.current?.cleanup === cleanup) {
        interactionLifecycleRef.current = null
      }
    }

    interactionLifecycleRef.current = {
      viewer,
      handler,
      cleanup,
    }

    return cleanup
  }, [
    cesiumRef,
    interactionLifecycleRef,
    onMapStateChange,
    onPoiSelect,
    onStreetViewContextMenu,
    poiClickHandlerRef,
    status,
    viewerRef,
  ])
}
