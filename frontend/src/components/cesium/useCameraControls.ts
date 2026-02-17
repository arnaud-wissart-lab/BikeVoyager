import { useEffect, type MutableRefObject } from 'react'
import type {
  MapCommand,
  MapViewMode,
  NavigationCameraMode,
  RouteBounds,
} from '../../features/routing/domain'
import {
  destinationPointByBearing,
  getNavigationCameraPreset,
  normalizeHeadingDegrees,
} from './math'
import type { CesiumModule, CesiumStatus, NavigationProgress, PoiMarker } from './types'

type UseCameraControlsParams = {
  status: CesiumStatus
  navigationActive: boolean
  navigationProgress: NavigationProgress | null
  navigationCameraMode: NavigationCameraMode
  mapCommand: MapCommand | null
  mapCommandSeq: number
  bounds: RouteBounds | null
  activePoiId: string | null
  pois?: PoiMarker[]
  viewMode: MapViewMode
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  routeEntityRef: MutableRefObject<import('cesium').Entity | null>
  smoothedHeadingRef: MutableRefObject<number | null>
  lastProcessedCommandSeqRef: MutableRefObject<number>
}

export default function useCameraControls({
  status,
  navigationActive,
  navigationProgress,
  navigationCameraMode,
  mapCommand,
  mapCommandSeq,
  bounds,
  activePoiId,
  pois,
  viewMode,
  viewerRef,
  cesiumRef,
  routeEntityRef,
  smoothedHeadingRef,
  lastProcessedCommandSeqRef,
}: UseCameraControlsParams) {
  useEffect(() => {
    if (!navigationActive) {
      smoothedHeadingRef.current = null
    }
  }, [navigationActive, smoothedHeadingRef])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (status !== 'ready' || !viewer || !Cesium || !navigationActive || !navigationProgress) {
      return
    }

    const targetHeadingDeg = normalizeHeadingDegrees(navigationProgress.headingDeg)
    const previousHeadingDeg = smoothedHeadingRef.current
    let headingDeg = targetHeadingDeg
    if (previousHeadingDeg !== null) {
      const shortestDelta = ((targetHeadingDeg - previousHeadingDeg + 540) % 360) - 180
      const smoothingFactor = navigationProgress.source === 'gps' ? 0.28 : 0.45
      headingDeg = normalizeHeadingDegrees(previousHeadingDeg + shortestDelta * smoothingFactor)
    }
    smoothedHeadingRef.current = headingDeg
    const heading = Cesium.Math.toRadians(headingDeg)

    if (navigationCameraMode === 'overview_2d') {
      if (viewer.scene.mode !== Cesium.SceneMode.SCENE2D) {
        viewer.scene.morphTo2D(0)
      }

      const preset = getNavigationCameraPreset(navigationCameraMode)
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          navigationProgress.lon,
          navigationProgress.lat,
          preset.height_m,
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(preset.pitchDeg),
          roll: 0,
        },
      })
      viewer.scene.requestRender()
      return
    }

    if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) {
      viewer.scene.morphTo3D(0)
    }

    const preset = getNavigationCameraPreset(navigationCameraMode)
    const [cameraLon, cameraLat] = destinationPointByBearing(
      [navigationProgress.lon, navigationProgress.lat],
      headingDeg + 180,
      preset.backDistance_m,
    )

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(cameraLon, cameraLat, preset.height_m),
      orientation: {
        heading,
        pitch: Cesium.Math.toRadians(preset.pitchDeg),
        roll: 0,
      },
    })
    viewer.scene.requestRender()
  }, [
    cesiumRef,
    navigationActive,
    navigationCameraMode,
    navigationProgress,
    smoothedHeadingRef,
    status,
    viewerRef,
  ])

  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = cesiumRef.current
    if (
      status !== 'ready' ||
      !viewer ||
      !Cesium ||
      navigationActive ||
      mapCommandSeq === 0 ||
      mapCommandSeq === lastProcessedCommandSeqRef.current ||
      !mapCommand
    ) {
      return
    }
    lastProcessedCommandSeqRef.current = mapCommandSeq

    if (mapCommand === 'resetRoute') {
      if (bounds) {
        const rectangle = Cesium.Rectangle.fromDegrees(
          bounds.minLon,
          bounds.minLat,
          bounds.maxLon,
          bounds.maxLat,
        )
        viewer.camera.flyTo({
          destination: rectangle,
          duration: 1.05,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        })
      } else if (routeEntityRef.current) {
        void viewer.flyTo(routeEntityRef.current, {
          duration: 1.05,
        })
      }

      viewer.scene.requestRender()
      return
    }

    if (!activePoiId || !pois || pois.length === 0) {
      return
    }

    const activePoi = pois.find((poi) => poi.id === activePoiId)
    if (!activePoi) {
      return
    }

    if (!Number.isFinite(activePoi.lat) || !Number.isFinite(activePoi.lon)) {
      return
    }

    const currentHeight = viewer.camera.positionCartographic.height
    const fallbackHeight = viewMode === '3d' ? 950 : 1350
    const safeCurrentHeight =
      Number.isFinite(currentHeight) && currentHeight > 0 ? currentHeight : fallbackHeight
    const heightFactor = mapCommand === 'zoomInPoi' ? 0.68 : 1.45
    const minHeight = viewMode === '3d' ? 120 : 220
    const maxHeight = 18000
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, safeCurrentHeight * heightFactor))

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(activePoi.lon, activePoi.lat, nextHeight),
      duration: 0.55,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
      orientation: {
        heading: viewMode === '3d' ? viewer.camera.heading : 0,
        pitch: viewMode === '3d' ? viewer.camera.pitch : Cesium.Math.toRadians(-89.5),
        roll: 0,
      },
    })
    viewer.scene.requestRender()
  }, [
    activePoiId,
    bounds,
    cesiumRef,
    lastProcessedCommandSeqRef,
    mapCommand,
    mapCommandSeq,
    navigationActive,
    pois,
    routeEntityRef,
    status,
    viewMode,
    viewerRef,
  ])
}
