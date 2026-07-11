import type { MutableRefObject } from 'react'

export type CesiumInteractionLifecycle = {
  viewer: import('cesium').Viewer
  handler: import('cesium').ScreenSpaceEventHandler
  cleanup: () => void
}

export type CesiumInteractionLifecycleRef = MutableRefObject<CesiumInteractionLifecycle | null>

export const isViewerUsable = (
  viewer: import('cesium').Viewer | null,
): viewer is import('cesium').Viewer => Boolean(viewer && !viewer.isDestroyed())

export const isHandlerUsable = (
  handler: import('cesium').ScreenSpaceEventHandler | null,
): handler is import('cesium').ScreenSpaceEventHandler => Boolean(handler && !handler.isDestroyed())
