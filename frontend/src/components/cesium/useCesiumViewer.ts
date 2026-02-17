import { useEffect, useState, type MutableRefObject } from 'react'
import { hasWebglSupport } from './math'
import type { CesiumModule, CesiumStatus } from './types'

declare const CESIUM_BASE_URL: string

type UseCesiumViewerParams = {
  containerRef: MutableRefObject<HTMLDivElement | null>
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  routeEntityRef: MutableRefObject<import('cesium').Entity | null>
  poiEntitiesRef: MutableRefObject<import('cesium').Entity[]>
  navigationEntityRef: MutableRefObject<import('cesium').Entity | null>
  smoothedHeadingRef: MutableRefObject<number | null>
  lastRouteSignatureRef: MutableRefObject<string | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  poiClickHandlerRef: MutableRefObject<import('cesium').ScreenSpaceEventHandler | null>
}

export default function useCesiumViewer({
  containerRef,
  viewerRef,
  routeEntityRef,
  poiEntitiesRef,
  navigationEntityRef,
  smoothedHeadingRef,
  lastRouteSignatureRef,
  cesiumRef,
  poiClickHandlerRef,
}: UseCesiumViewerParams): CesiumStatus {
  const [status, setStatus] = useState<CesiumStatus>('loading')

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (!hasWebglSupport()) {
      setStatus('fallback')
      return
    }

    let isActive = true

    const initializeViewer = async () => {
      try {
        const Cesium = await import('cesium')
        if (!isActive || !containerRef.current) {
          return
        }

        cesiumRef.current = Cesium

        const baseUrl =
          typeof CESIUM_BASE_URL !== 'undefined'
            ? CESIUM_BASE_URL
            : `${import.meta.env.BASE_URL ?? '/'}cesium/`
        if (typeof window !== 'undefined') {
          ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = baseUrl
        }

        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN
        if (ionToken) {
          Cesium.Ion.defaultAccessToken = ionToken
        }

        const terrainProvider = ionToken
          ? await Cesium.createWorldTerrainAsync({
              requestVertexNormals: true,
              requestWaterMask: true,
            })
          : new Cesium.EllipsoidTerrainProvider()

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider,
          baseLayer: new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: 'https://tile.openstreetmap.org/',
              maximumLevel: 19,
            }),
          ),
          geocoder: false,
          homeButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          contextOptions: {
            webgl: {
              alpha: false,
              antialias: true,
            },
          },
          useBrowserRecommendedResolution: false,
          msaaSamples: 4,
          requestRenderMode: true,
          maximumRenderTimeChange: Number.POSITIVE_INFINITY,
        })

        viewer.scene.globe.depthTestAgainstTerrain = false
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
        viewer.scene.postProcessStages.fxaa.enabled = true
        viewer.scene.globe.maximumScreenSpaceError = 1.4
        viewer.resolutionScale = Math.min(
          2,
          Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
        )

        viewerRef.current = viewer
        setStatus('ready')
      } catch {
        setStatus('fallback')
      }
    }

    void initializeViewer()

    return () => {
      isActive = false
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
      }
      if (poiClickHandlerRef.current && !poiClickHandlerRef.current.isDestroyed()) {
        poiClickHandlerRef.current.destroy()
      }
      poiClickHandlerRef.current = null
      viewerRef.current = null
      routeEntityRef.current = null
      poiEntitiesRef.current = []
      navigationEntityRef.current = null
      smoothedHeadingRef.current = null
      lastRouteSignatureRef.current = null
      cesiumRef.current = null
    }
  }, [
    cesiumRef,
    containerRef,
    lastRouteSignatureRef,
    navigationEntityRef,
    poiClickHandlerRef,
    poiEntitiesRef,
    routeEntityRef,
    smoothedHeadingRef,
    viewerRef,
  ])

  return status
}
