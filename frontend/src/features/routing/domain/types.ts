import type { PlaceCandidate } from '../../../components/PlaceSearchInput'

export type { PlaceCandidate } from '../../../components/PlaceSearchInput'

export type RouteKey = 'planifier' | 'carte' | 'profils' | 'donnees' | 'aide'

export type Mode = 'walk' | 'bike' | 'ebike'

export type TripType = 'oneway' | 'loop'

export type AssistLevel = 'low' | 'medium' | 'high'

export type MapViewMode = '2d' | '3d'
export type MapCommand = 'zoomInPoi' | 'zoomOutPoi' | 'resetRoute'
export type NavigationMode = 'gps' | 'simulation'
export type NavigationCameraMode = 'follow_3d' | 'panoramic_3d' | 'overview_2d'

export type NavigationProgress = {
  distance_m: number
  lat: number
  lon: number
  heading_deg: number
  source: NavigationMode
  speed_mps: number | null
  distance_to_route_m?: number
}

export type ProfileSettings = {
  speeds: Record<Mode, number>
  ebikeAssist: AssistLevel
}

export type ApiRouteMode = 'walking' | 'bicycle' | 'ebike'

export type RouteOptions = {
  preferCycleways: boolean
  avoidHills: boolean
}

export type RouteLocation = {
  lat: number
  lon: number
  label: string
}

export type DetourPoint = RouteLocation & {
  id: string
  source: 'poi' | 'custom'
  poiId?: string
}

export type RouteRequestPayload = {
  from: RouteLocation
  to: RouteLocation
  waypoints?: RouteLocation[]
  optimizeWaypoints?: boolean
  mode: ApiRouteMode
  options: RouteOptions
  speedKmh: number
  ebikeAssist?: AssistLevel
}

export type LoopRequestPayload = {
  start: RouteLocation
  targetDistanceKm: number
  mode: ApiRouteMode
  speedKmh: number
  ebikeAssist?: AssistLevel
  variation?: number
  waypoints?: RouteLocation[]
}

export type RouteGeometry = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type RouteStep = {
  instruction: string
  distance_m: number
  duration_s: number
  type: number
}

export type RouteElevationPoint = {
  distance_m: number
  elevation_m: number
}

export type RouteResult = {
  kind: 'route'
  geometry: RouteGeometry
  distance_m: number
  duration_s_engine: number
  eta_s: number
  turn_by_turn: RouteStep[]
  elevation_profile: RouteElevationPoint[]
}

export type LoopResult = {
  kind: 'loop'
  geometry: RouteGeometry
  distance_m: number
  eta_s: number
  overlapScore: 'faible' | 'moyen' | 'élevé'
  segmentsCount: number
  elevation_profile: RouteElevationPoint[]
}

export type TripResult = RouteResult | LoopResult

export type PoiCategory = 'monuments' | 'paysages' | 'commerces' | 'services'

export type PoiItem = {
  id: string
  name: string
  lat: number
  lon: number
  category: PoiCategory
  kind: string | null
  distance_m: number
  distance_to_route_m?: number | null
  osm_type?: string | null
  osm_id?: number | null
  tags?: Record<string, string> | null
}

export type RouteBounds = {
  minLat: number
  minLon: number
  maxLat: number
  maxLon: number
}

export type ValhallaStatus = {
  ready: boolean
  reason: string | null
  marker_exists: boolean
  service_reachable: boolean
  service_error: string | null
  message: string
  build?: {
    state: string
    phase: string
    progress_pct: number
    message: string
    updated_at: string | null
  }
  update?: {
    state: string
    update_available: boolean
    reason: string | null
    message: string
    checked_at: string | null
    next_check_at: string | null
    marker_exists: boolean
    remote?: {
      available: boolean
      error: string | null
    }
  }
}

export type PlannerDraft = {
  mode: Mode | null
  tripType: TripType | null
  onewayStartValue: string
  onewayStartPlace: PlaceCandidate | null
  loopStartValue: string
  loopStartPlace: PlaceCandidate | null
  endValue: string
  endPlace: PlaceCandidate | null
  targetDistanceKm: number | ''
}
