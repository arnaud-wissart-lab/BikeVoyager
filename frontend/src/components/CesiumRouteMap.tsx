import { useCallback, useEffect, useRef, useState } from 'react'
import { buildGoogleStreetViewUrl } from './cesium/googleStreetView'
import useCameraControls from './cesium/useCameraControls'
import useCesiumViewer from './cesium/useCesiumViewer'
import useInteractionHandlers from './cesium/useInteractionHandlers'
import useMapLayers from './cesium/useMapLayers'
import useRouteEntities from './cesium/useRouteEntities'
import { isViewerUsable, type CesiumInteractionLifecycle } from './cesium/lifecycle'
import type {
  CesiumRouteMapProps,
  CesiumModule,
  StreetViewContextMenuRequest,
  StreetViewTarget,
} from './cesium/types'

const openGoogleStreetView = ({ lat, lon, heading }: StreetViewTarget) => {
  window.open(buildGoogleStreetViewUrl(lat, lon, heading), '_blank', 'noopener,noreferrer')
}

const hasRenderableRouteGeometry = (geometry: CesiumRouteMapProps['geometry']) =>
  Boolean(
    geometry &&
    geometry.type === 'LineString' &&
    geometry.coordinates.filter(
      (coordinate) =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1]),
    ).length >= 2,
  )

export default function CesiumRouteMap({
  geometry,
  alternativeGeometry = null,
  bounds,
  elevationProfile,
  alternativeElevationProfile = null,
  viewMode,
  mapCommand,
  mapCommandSeq = 0,
  fallbackLabel,
  pois,
  activePoiId,
  onPoiSelect,
  onOpenStreetView = openGoogleStreetView,
  navigationActive = false,
  navigationProgress = null,
  navigationCameraMode = 'follow_3d',
}: CesiumRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<import('cesium').Viewer | null>(null)
  const routeEntityRef = useRef<import('cesium').Entity | null>(null)
  const alternativeRouteEntityRef = useRef<import('cesium').Entity | null>(null)
  const poiEntitiesRef = useRef<import('cesium').Entity[]>([])
  const navigationEntityRef = useRef<import('cesium').Entity | null>(null)
  const smoothedHeadingRef = useRef<number | null>(null)
  const lastRouteSignatureRef = useRef<string | null>(null)
  const lastAlternativeRouteSignatureRef = useRef<string | null>(null)
  const lastProcessedCommandSeqRef = useRef(0)
  const cesiumRef = useRef<CesiumModule | null>(null)
  const poiClickHandlerRef = useRef<import('cesium').ScreenSpaceEventHandler | null>(null)
  const interactionLifecycleRef = useRef<CesiumInteractionLifecycle | null>(null)
  const streetViewMenuRef = useRef<HTMLDivElement | null>(null)
  const [streetViewMenu, setStreetViewMenu] = useState<StreetViewContextMenuRequest | null>(null)
  const routeLayerCount =
    (hasRenderableRouteGeometry(geometry) ? 1 : 0) +
    (hasRenderableRouteGeometry(alternativeGeometry) ? 1 : 0)
  const hasAlternativeRouteLayer = hasRenderableRouteGeometry(alternativeGeometry)

  const closeStreetViewMenu = useCallback(() => {
    setStreetViewMenu(null)
  }, [])

  const requestStreetViewContextMenu = useCallback((request: StreetViewContextMenuRequest) => {
    setStreetViewMenu(request)
  }, [])

  const status = useCesiumViewer({
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
  })

  useEffect(() => {
    const container = containerRef.current
    const viewer = viewerRef.current
    if (status !== 'ready' || !container || !isViewerUsable(viewer)) {
      return
    }

    let animationFrameId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        if (!isViewerUsable(viewer)) {
          return
        }

        viewer.resize()
        viewer.scene.requestRender()
      })
    })

    resizeObserver.observe(container)
    return () => {
      resizeObserver.disconnect()
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [status, viewerRef])

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
    onStreetViewContextMenu: requestStreetViewContextMenu,
    onMapStateChange: closeStreetViewMenu,
    viewerRef,
    cesiumRef,
    poiClickHandlerRef,
    interactionLifecycleRef,
  })
  const visibleStreetViewMenu = status === 'ready' ? streetViewMenu : null

  const handleOpenStreetView = useCallback(() => {
    if (!visibleStreetViewMenu) {
      return
    }

    onOpenStreetView(visibleStreetViewMenu.target)
    closeStreetViewMenu()
  }, [closeStreetViewMenu, onOpenStreetView, visibleStreetViewMenu])

  useEffect(() => {
    if (!visibleStreetViewMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && streetViewMenuRef.current?.contains(event.target)) {
        return
      }

      closeStreetViewMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeStreetViewMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeStreetViewMenu, visibleStreetViewMenu])

  useRouteEntities({
    status,
    geometry,
    alternativeGeometry,
    bounds,
    elevationProfile,
    alternativeElevationProfile,
    navigationActive,
    navigationProgress,
    viewMode,
    pois,
    activePoiId,
    viewerRef,
    cesiumRef,
    routeEntityRef,
    alternativeRouteEntityRef,
    poiEntitiesRef,
    navigationEntityRef,
    lastRouteSignatureRef,
    lastAlternativeRouteSignatureRef,
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
    <div
      data-testid="cesium-route-map"
      data-route-layer-count={routeLayerCount}
      data-alternative-route-visible={hasAlternativeRouteLayer ? 'true' : 'false'}
      data-map-command={mapCommand ?? ''}
      data-map-command-seq={mapCommandSeq}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
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
      {visibleStreetViewMenu && (
        <div
          ref={streetViewMenuRef}
          role="menu"
          aria-label="Actions de carte"
          data-testid="street-view-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          style={{
            position: 'absolute',
            left: Math.max(8, visibleStreetViewMenu.x),
            top: Math.max(8, visibleStreetViewMenu.y),
            zIndex: 20,
            minWidth: '214px',
            padding: '4px',
            border: '1px solid rgba(15, 23, 42, 0.16)',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
            transform: 'translate(6px, 6px)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleOpenStreetView}
            style={{
              width: '100%',
              border: 0,
              borderRadius: '6px',
              padding: '8px 10px',
              backgroundColor: 'transparent',
              color: '#111827',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: '0.875rem',
              textAlign: 'left',
            }}
          >
            Voir dans Google Street View
          </button>
        </div>
      )}
    </div>
  )
}
