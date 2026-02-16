import { useRef } from 'react'
import useCameraControls from './cesium/useCameraControls'
import useCesiumViewer from './cesium/useCesiumViewer'
import useInteractionHandlers from './cesium/useInteractionHandlers'
import useMapLayers from './cesium/useMapLayers'
import useRouteEntities from './cesium/useRouteEntities'
import type { CesiumRouteMapProps, CesiumModule } from './cesium/types'

export default function CesiumRouteMap({
  geometry,
  bounds,
  elevationProfile,
  viewMode,
  mapCommand,
  mapCommandSeq = 0,
  fallbackLabel,
  pois,
  activePoiId,
  onPoiSelect,
  navigationActive = false,
  navigationProgress = null,
  navigationCameraMode = 'follow_3d',
}: CesiumRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const routeEntityRef = useRef<import('cesium').Entity | null>(null)
  const poiEntitiesRef = useRef<import('cesium').Entity[]>([])
  const navigationEntityRef = useRef<import('cesium').Entity | null>(null)
  const smoothedHeadingRef = useRef<number | null>(null)
  const lastRouteSignatureRef = useRef<string | null>(null)
  const lastProcessedCommandSeqRef = useRef(0)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const poiClickHandlerRef = useRef<import('cesium').ScreenSpaceEventHandler | null>(null)

  const status = useCesiumViewer({
    containerRef,
    viewerRef,
    routeEntityRef,
    poiEntitiesRef,
    navigationEntityRef,
    smoothedHeadingRef,
    lastRouteSignatureRef,
    cesiumRef,
    poiClickHandlerRef,
  })

  useMapLayers({
    status,
    viewMode,
    navigationActive,
    viewerRef,
    cesiumRef,
  })

  useInteractionHandlers({
    status,
    onPoiSelect,
    viewerRef,
    cesiumRef,
    poiClickHandlerRef,
  })

  useRouteEntities({
    status,
    geometry,
    bounds,
    elevationProfile,
    navigationActive,
    navigationProgress,
    viewMode,
    pois,
    activePoiId,
    viewerRef,
    cesiumRef,
    routeEntityRef,
    poiEntitiesRef,
    navigationEntityRef,
    lastRouteSignatureRef,
  })

  useCameraControls({
    status,
    navigationActive,
    navigationProgress,
    navigationCameraMode,
    mapCommand: mapCommand ?? null,
    mapCommandSeq,
    bounds,
    activePoiId: activePoiId ?? null,
    pois,
    viewMode,
    viewerRef,
    cesiumRef,
    routeEntityRef,
    smoothedHeadingRef,
    lastProcessedCommandSeqRef,
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {status === 'fallback' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '24px',
            backgroundColor: 'rgba(12, 14, 18, 0.35)',
            color: 'inherit',
          }}
        >
          <span>{fallbackLabel}</span>
        </div>
      )}
    </div>
  )
}
