import type {
  MapCommand,
  MapViewMode,
  NavigationCameraMode,
  RouteBounds,
  RouteElevationPoint,
  RouteGeometry,
} from '../../features/routing/domain'

export type NavigationSource = 'gps' | 'simulation'

export type NavigationProgress = {
  lat: number
  lon: number
  headingDeg: number
  source: NavigationSource
}

export type PoiMarker = {
  id: string
  name: string
  lat: number
  lon: number
  category: string
  kind?: string | null
}

export type StreetViewTarget = {
  lat: number
  lon: number
  heading?: number
}

export type StreetViewContextMenuRequest = {
  x: number
  y: number
  target: StreetViewTarget
}

export type CesiumRouteMapProps = {
  geometry: RouteGeometry | null
  alternativeGeometry?: RouteGeometry | null
  bounds: RouteBounds | null
  elevationProfile?: RouteElevationPoint[] | null
  alternativeElevationProfile?: RouteElevationPoint[] | null
  viewMode: MapViewMode
  mapCommand?: MapCommand | null
  mapCommandSeq?: number
  fallbackLabel: string
  pois?: PoiMarker[]
  activePoiId?: string | null
  onPoiSelect?: (poiId: string) => void
  onOpenStreetView?: (target: StreetViewTarget) => void
  navigationActive?: boolean
  navigationProgress?: NavigationProgress | null
  navigationCameraMode?: NavigationCameraMode
}

export type CesiumModule = typeof import('cesium')
export type CesiumStatus = 'loading' | 'ready' | 'fallback'
