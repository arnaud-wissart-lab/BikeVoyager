import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { hasWebglSupport } from './math'
import { isHandlerUsable, isViewerUsable, type CesiumInteractionLifecycleRef } from './lifecycle'
import type { CesiumModule, CesiumStatus } from './types'

declare const CESIUM_BASE_URL: string

type UseCesiumViewerParams = {
  containerRef: MutableRefObject<HTMLDivElement | null>
  viewerRef: MutableRefObject<import('cesium').Viewer | null>
  routeEntityRef: MutableRefObject<import('cesium').Entity | null>
  alternativeRouteEntityRef: MutableRefObject<import('cesium').Entity | null>
  poiEntitiesRef: MutableRefObject<import('cesium').Entity[]>
  navigationEntityRef: MutableRefObject<import('cesium').Entity | null>
  smoothedHeadingRef: MutableRefObject<number | null>
  lastRouteSignatureRef: MutableRefObject<string | null>
  lastAlternativeRouteSignatureRef: MutableRefObject<string | null>
  cesiumRef: MutableRefObject<CesiumModule | null>
  poiClickHandlerRef: MutableRefObject<import('cesium').ScreenSpaceEventHandler | null>
  interactionLifecycleRef: CesiumInteractionLifecycleRef
}

const cleanupViewerInteractions = (
  viewer: import('cesium').Viewer,
  ownsCurrentViewer: boolean,
  interactionLifecycleRef: CesiumInteractionLifecycleRef,
  poiClickHandlerRef: MutableRefObject<import('cesium').ScreenSpaceEventHandler | null>,
) => {
  const interactionLifecycle = interactionLifecycleRef.current
  if (interactionLifecycle?.viewer === viewer) {
    interactionLifecycle.cleanup()
    return
  }

  if (!ownsCurrentViewer) {
    return
  }

  const handler = poiClickHandlerRef.current
  if (isHandlerUsable(handler)) {
    handler.destroy()
  }
  if (poiClickHandlerRef.current === handler) {
    poiClickHandlerRef.current = null
  }
}

export default function useCesiumViewer({
  containerRef,
  viewerRef,
  routeEntityRef,
  alternativeRouteEntityRef,
  poiEntitiesRef,
  navigationEntityRef,
  smoothedHeadingRef,
  lastRouteSignatureRef,
  lastAlternativeRouteSignatureRef,
  cesiumRef,
  poiClickHandlerRef,
  interactionLifecycleRef,
}: UseCesiumViewerParams): CesiumStatus {
  const [status, setStatus] = useState<CesiumStatus>('loading')
  const initializationGenerationRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (!hasWebglSupport()) {
      console.warn('[Cesium] WebGL indisponible, bascule en affichage de secours.')
      setStatus('fallback')
      return
    }

    let isActive = true
    const generation = initializationGenerationRef.current + 1
    initializationGenerationRef.current = generation
    let createdViewer: import('cesium').Viewer | null = null
    let createdCesium: CesiumModule | null = null

    const isCurrentInitialization = () =>
      isActive &&
      initializationGenerationRef.current === generation &&
      containerRef.current === container

    const initializeViewer = async () => {
      try {
        const cesiumModule = await import('cesium')
        if (!isCurrentInitialization()) {
          return
        }
        createdCesium = cesiumModule

        const baseUrl =
          typeof CESIUM_BASE_URL !== 'undefined'
            ? CESIUM_BASE_URL
            : `${import.meta.env.BASE_URL ?? '/'}cesium/`
        if (typeof window !== 'undefined') {
          ;(window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = baseUrl
        }

        const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN
        if (ionToken) {
          cesiumModule.Ion.defaultAccessToken = ionToken
        }

        const terrainProvider = ionToken
          ? await cesiumModule.createWorldTerrainAsync({
              requestVertexNormals: true,
              requestWaterMask: true,
            })
          : new cesiumModule.EllipsoidTerrainProvider()

        if (!isCurrentInitialization()) {
          return
        }

        const viewer = new cesiumModule.Viewer(container, {
          terrainProvider,
          baseLayer: new cesiumModule.ImageryLayer(
            new cesiumModule.OpenStreetMapImageryProvider({
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
        createdViewer = viewer

        if (!isCurrentInitialization()) {
          if (isViewerUsable(viewer)) {
            viewer.destroy()
          }
          return
        }

        viewer.scene.globe.depthTestAgainstTerrain = false
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true
        viewer.scene.postProcessStages.fxaa.enabled = true
        viewer.scene.globe.maximumScreenSpaceError = 1.4
        viewer.resolutionScale = Math.min(
          2,
          Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
        )

        if (!isCurrentInitialization()) {
          if (isViewerUsable(viewer)) {
            viewer.destroy()
          }
          return
        }

        cesiumRef.current = cesiumModule
        viewerRef.current = viewer
        setStatus('ready')
      } catch (error) {
        if (isViewerUsable(createdViewer)) {
          createdViewer.destroy()
        }
        if (!isCurrentInitialization()) {
          return
        }
        console.error("[Cesium] Echec d'initialisation du viewer.", error)
        setStatus('fallback')
      }
    }

    void initializeViewer()

    return () => {
      isActive = false
      if (initializationGenerationRef.current === generation) {
        initializationGenerationRef.current += 1
      }

      const ownsCurrentViewer = createdViewer !== null && viewerRef.current === createdViewer
      if (createdViewer) {
        cleanupViewerInteractions(
          createdViewer,
          ownsCurrentViewer,
          interactionLifecycleRef,
          poiClickHandlerRef,
        )
      }

      if (isViewerUsable(createdViewer)) {
        createdViewer.destroy()
      }

      if (ownsCurrentViewer) {
        viewerRef.current = null
        routeEntityRef.current = null
        alternativeRouteEntityRef.current = null
        poiEntitiesRef.current = []
        navigationEntityRef.current = null
        smoothedHeadingRef.current = null
        lastRouteSignatureRef.current = null
        lastAlternativeRouteSignatureRef.current = null
        if (cesiumRef.current === createdCesium) {
          cesiumRef.current = null
        }
      }
    }
  }, [
    alternativeRouteEntityRef,
    cesiumRef,
    containerRef,
    interactionLifecycleRef,
    lastAlternativeRouteSignatureRef,
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
