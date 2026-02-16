import type { PlaceCandidate } from '../../components/PlaceSearchInput'
export type { PlaceCandidate } from '../../components/PlaceSearchInput'

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

export const minimumMapSpan = 0.02
export const mapPaddingRatio = 0.18

export const loopTelemetryEvents = {
  requested: 'LoopGenerateRequested',
  succeeded: 'LoopGenerateSucceeded',
  failed: 'LoopGenerateFailed',
} as const

export type LoopTelemetryEvent =
  (typeof loopTelemetryEvents)[keyof typeof loopTelemetryEvents]

export const trackLoopEvent = (
  event: LoopTelemetryEvent,
  payload?: Record<string, unknown>,
) => {
  void event
  void payload
  // TODO: wire loop telemetry events into the analytics pipeline.
}

export const buildLoopRequest = (
  startPlace: PlaceCandidate | null,
  targetDistanceKm: number | '',
  mode: Mode,
  speedKmh: number,
  ebikeAssist?: AssistLevel,
  variation = 0,
): LoopRequestPayload | null => {
  if (!startPlace || typeof targetDistanceKm !== 'number' || targetDistanceKm <= 0) {
    return null
  }

  return {
    start: {
      label: startPlace.label,
      lat: startPlace.lat,
      lon: startPlace.lon,
    },
    targetDistanceKm,
    mode: apiModeByUi[mode],
    speedKmh,
    ...(mode === 'ebike' && ebikeAssist
      ? {
          ebikeAssist,
        }
      : {}),
    variation,
  }
}

export const routeValues: RouteKey[] = ['planifier', 'carte', 'profils', 'donnees', 'aide']
export const profileStorageKey = 'bv_profile_settings'
export const routeStorageKey = 'bv_last_route'
export const plannerDraftStorageKey = 'bv_planner_draft'
export const emptyPlannerDraft: PlannerDraft = {
  mode: null,
  tripType: null,
  onewayStartValue: '',
  onewayStartPlace: null,
  loopStartValue: '',
  loopStartPlace: null,
  endValue: '',
  endPlace: null,
  targetDistanceKm: '',
}
export const routeOptionVariants: RouteOptions[] = [
  { preferCycleways: true, avoidHills: false },
  { preferCycleways: false, avoidHills: false },
  { preferCycleways: true, avoidHills: true },
  { preferCycleways: false, avoidHills: true },
]
export const defaultPoiCategories: PoiCategory[] = [
  'monuments',
  'paysages',
  'commerces',
  'services',
]
export const poiCorridorRange = { min: 200, max: 2000, step: 100 }
export const poiAlertDistanceRange = { min: 50, max: 2000, step: 50 }
export const defaultPoiAlertCategories: PoiCategory[] = ['paysages']
export const simulationTickMs = 600
export const poiPreferredTagOrder = [
  'name',
  'name:fr',
  'name:en',
  'brand',
  'operator',
  'tourism',
  'historic',
  'amenity',
  'shop',
  'opening_hours',
  'website',
  'contact:website',
  'phone',
  'contact:phone',
  'email',
  'wheelchair',
  'addr:street',
  'addr:housenumber',
  'addr:postcode',
  'addr:city',
]

export type OsmLabel = {
  fr: string
  en: string
}

export const osmTagLabels: Record<string, OsmLabel> = {
  name: { fr: 'Nom', en: 'Name' },
  'name:fr': { fr: 'Nom (FR)', en: 'Name (FR)' },
  'name:en': { fr: 'Nom (EN)', en: 'Name (EN)' },
  brand: { fr: 'Marque', en: 'Brand' },
  operator: { fr: 'Exploitant', en: 'Operator' },
  tourism: { fr: 'Tourisme', en: 'Tourism' },
  historic: { fr: 'Historique', en: 'Historic' },
  natural: { fr: 'Nature', en: 'Natural' },
  leisure: { fr: 'Loisir', en: 'Leisure' },
  sport: { fr: 'Sport', en: 'Sport' },
  cuisine: { fr: 'Cuisine', en: 'Cuisine' },
  amenity: { fr: 'Service', en: 'Amenity' },
  shop: { fr: 'Commerce', en: 'Shop' },
  access: { fr: 'Accès', en: 'Access' },
  surface: { fr: 'Revêtement', en: 'Surface' },
  fee: { fr: 'Payant', en: 'Fee' },
  capacity: { fr: 'Capacité', en: 'Capacity' },
  internet_access: { fr: 'Accès internet', en: 'Internet access' },
  bicycle_parking: { fr: 'Stationnement vélo', en: 'Bicycle parking' },
  description: { fr: 'Description', en: 'Description' },
  wikipedia: { fr: 'Wikipédia', en: 'Wikipedia' },
  wikidata: { fr: 'Wikidata', en: 'Wikidata' },
  opening_hours: { fr: 'Horaires', en: 'Opening hours' },
  website: { fr: 'Site web', en: 'Website' },
  'contact:website': { fr: 'Site web', en: 'Website' },
  phone: { fr: 'Téléphone', en: 'Phone' },
  'contact:phone': { fr: 'Téléphone', en: 'Phone' },
  email: { fr: 'Email', en: 'Email' },
  wheelchair: { fr: 'Accessibilité PMR', en: 'Wheelchair access' },
  leaf_cycle: { fr: 'Cycle foliaire', en: 'Leaf cycle' },
  leaf_type: { fr: 'Type de feuilles', en: 'Leaf type' },
  'addr:street': { fr: 'Rue', en: 'Street' },
  'addr:housenumber': { fr: 'Numéro', en: 'House number' },
  'addr:postcode': { fr: 'Code postal', en: 'Postal code' },
  'addr:city': { fr: 'Ville', en: 'City' },
}

export const osmValueLabels: Record<string, OsmLabel> = {
  wood: { fr: 'bois', en: 'wood' },
  forest: { fr: 'forêt', en: 'forest' },
  deciduous: { fr: 'caduc', en: 'deciduous' },
  evergreen: { fr: 'persistant', en: 'evergreen' },
  mixed: { fr: 'mixte', en: 'mixed' },
  broadleaved: { fr: 'feuillu', en: 'broadleaved' },
  needleleaved: { fr: 'résineux', en: 'needleleaved' },
  meadow: { fr: 'prairie', en: 'meadow' },
  scrub: { fr: 'broussailles', en: 'scrub' },
  grassland: { fr: 'pelouse', en: 'grassland' },
  heath: { fr: 'lande', en: 'heath' },
  wetland: { fr: 'zone humide', en: 'wetland' },
  attraction: { fr: 'attraction', en: 'attraction' },
  museum: { fr: 'musée', en: 'museum' },
  monument: { fr: 'monument', en: 'monument' },
  memorial: { fr: 'mémorial', en: 'memorial' },
  castle: { fr: 'château', en: 'castle' },
  ruins: { fr: 'ruines', en: 'ruins' },
  archaeological_site: { fr: 'site archéologique', en: 'archaeological site' },
  fort: { fr: 'fort', en: 'fort' },
  place_of_worship: { fr: 'lieu de culte', en: 'place of worship' },
  viewpoint: { fr: 'point de vue', en: 'viewpoint' },
  peak: { fr: 'sommet', en: 'peak' },
  waterfall: { fr: 'cascade', en: 'waterfall' },
  beach: { fr: 'plage', en: 'beach' },
  bay: { fr: 'baie', en: 'bay' },
  spring: { fr: 'source', en: 'spring' },
  cave: { fr: 'grotte', en: 'cave' },
  cliff: { fr: 'falaise', en: 'cliff' },
  information: { fr: 'information', en: 'information' },
  hostel: { fr: 'auberge', en: 'hostel' },
  hotel: { fr: 'hôtel', en: 'hotel' },
  guest_house: { fr: 'chambre d’hôtes', en: 'guest house' },
  picnic_site: { fr: 'aire de pique-nique', en: 'picnic site' },
  camp_site: { fr: 'camping', en: 'camp site' },
  bicycle: { fr: 'vélo', en: 'bicycle' },
  supermarket: { fr: 'supermarché', en: 'supermarket' },
  bakery: { fr: 'boulangerie', en: 'bakery' },
  convenience: { fr: 'supérette', en: 'convenience store' },
  farm: { fr: 'ferme', en: 'farm' },
  outdoor: { fr: 'plein air', en: 'outdoor' },
  sports: { fr: 'sport', en: 'sports' },
  marketplace: { fr: 'marché', en: 'marketplace' },
  bicycle_repair_station: { fr: 'station de réparation vélo', en: 'bicycle repair station' },
  bicycle_parking: { fr: 'parking vélo', en: 'bicycle parking' },
  rental: { fr: 'location', en: 'rental' },
  cafe: { fr: 'café', en: 'cafe' },
  restaurant: { fr: 'restaurant', en: 'restaurant' },
  fast_food: { fr: 'restauration rapide', en: 'fast food' },
  pub: { fr: 'pub', en: 'pub' },
  bar: { fr: 'bar', en: 'bar' },
  toilets: { fr: 'toilettes', en: 'toilets' },
  pharmacy: { fr: 'pharmacie', en: 'pharmacy' },
  drinking_water: { fr: 'eau potable', en: 'drinking water' },
  shelter: { fr: 'abri', en: 'shelter' },
  fuel: { fr: 'carburant', en: 'fuel' },
  bank: { fr: 'banque', en: 'bank' },
  atm: { fr: 'distributeur', en: 'ATM' },
  parking: { fr: 'parking', en: 'parking' },
  charging_station: { fr: 'borne de recharge', en: 'charging station' },
  public: { fr: 'public', en: 'public' },
  private: { fr: 'privé', en: 'private' },
  designated: { fr: 'aménagé', en: 'designated' },
  permissive: { fr: 'toléré', en: 'permissive' },
  customers: { fr: 'clients', en: 'customers' },
  residents: { fr: 'résidents', en: 'residents' },
  paved: { fr: 'revêtu', en: 'paved' },
  unpaved: { fr: 'non revêtu', en: 'unpaved' },
  asphalt: { fr: 'asphalte', en: 'asphalt' },
  concrete: { fr: 'béton', en: 'concrete' },
  gravel: { fr: 'gravier', en: 'gravel' },
  compacted: { fr: 'compacté', en: 'compacted' },
  ground: { fr: 'terre', en: 'ground' },
  dirt: { fr: 'terre battue', en: 'dirt' },
  sand: { fr: 'sable', en: 'sand' },
  cobblestone: { fr: 'pavés', en: 'cobblestone' },
  pebbles: { fr: 'galets', en: 'pebbles' },
  grass: { fr: 'herbe', en: 'grass' },
  unknown: { fr: 'inconnu', en: 'unknown' },
  yes: { fr: 'oui', en: 'yes' },
  no: { fr: 'non', en: 'no' },
  limited: { fr: 'limité', en: 'limited' },
  customers_only: { fr: 'clients uniquement', en: 'customers only' },
}

export const speedRanges: Record<Mode, { min: number; max: number; step: number; precision: number }> = {
  walk: { min: 3, max: 7, step: 0.5, precision: 1 },
  bike: { min: 10, max: 30, step: 1, precision: 0 },
  ebike: { min: 15, max: 25, step: 1, precision: 0 },
}
export const apiModeByUi: Record<Mode, ApiRouteMode> = {
  walk: 'walking',
  bike: 'bicycle',
  ebike: 'ebike',
}

export const defaultProfileSettings: ProfileSettings = {
  speeds: {
    walk: 5,
    bike: 15,
    ebike: 25,
  },
  ebikeAssist: 'medium',
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const normalizeNumericInput = (value: number | string): number | '' => {
  if (value === '') {
    return ''
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed)) {
    return ''
  }

  return parsed
}

export const toRadians = (value: number) => (value * Math.PI) / 180

export const haversineDistanceMeters = (
  left: [number, number],
  right: [number, number],
) => {
  const [leftLon, leftLat] = left
  const [rightLon, rightLat] = right
  const earthRadius = 6371000
  const dLat = toRadians(rightLat - leftLat)
  const dLon = toRadians(rightLon - leftLon)
  const leftLatRad = toRadians(leftLat)
  const rightLatRad = toRadians(rightLat)

  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h =
    sinLat * sinLat +
    Math.cos(leftLatRad) * Math.cos(rightLatRad) * sinLon * sinLon

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const buildCumulativeDistances = (coordinates: [number, number][]) => {
  if (coordinates.length === 0) {
    return []
  }

  const distances = [0]
  for (let index = 1; index < coordinates.length; index += 1) {
    const segmentDistance = haversineDistanceMeters(
      coordinates[index - 1],
      coordinates[index],
    )
    distances.push(distances[index - 1] + segmentDistance)
  }
  return distances
}

export const normalizeHeadingDegrees = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0
  }

  const wrapped = value % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

export const computeHeadingDegrees = (
  start: [number, number],
  end: [number, number],
) => {
  const [startLon, startLat] = start
  const [endLon, endLat] = end
  const startLatRad = toRadians(startLat)
  const endLatRad = toRadians(endLat)
  const lonDeltaRad = toRadians(endLon - startLon)

  const y = Math.sin(lonDeltaRad) * Math.cos(endLatRad)
  const x =
    Math.cos(startLatRad) * Math.sin(endLatRad) -
    Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(lonDeltaRad)
  const heading = (Math.atan2(y, x) * 180) / Math.PI
  return normalizeHeadingDegrees(heading)
}

export type RouteSamplePoint = {
  distance_m: number
  lat: number
  lon: number
  heading_deg: number
}

export const sampleRouteAtDistance = (
  coordinates: [number, number][],
  cumulativeDistances: number[],
  targetDistance: number,
): RouteSamplePoint | null => {
  if (coordinates.length === 0 || cumulativeDistances.length !== coordinates.length) {
    return null
  }

  if (coordinates.length === 1) {
    return {
      distance_m: 0,
      lat: coordinates[0][1],
      lon: coordinates[0][0],
      heading_deg: 0,
    }
  }

  const clampedDistance = Math.max(
    0,
    Math.min(
      targetDistance,
      cumulativeDistances[cumulativeDistances.length - 1] ?? 0,
    ),
  )

  for (let index = 1; index < cumulativeDistances.length; index += 1) {
    const segmentStartDistance = cumulativeDistances[index - 1]
    const segmentEndDistance = cumulativeDistances[index]
    if (clampedDistance > segmentEndDistance) {
      continue
    }

    const span = segmentEndDistance - segmentStartDistance
    const ratio = span <= 0 ? 0 : (clampedDistance - segmentStartDistance) / span
    const [startLon, startLat] = coordinates[index - 1]
    const [endLon, endLat] = coordinates[index]
    const lon = startLon + ratio * (endLon - startLon)
    const lat = startLat + ratio * (endLat - startLat)
    const headingDeg = computeHeadingDegrees(coordinates[index - 1], coordinates[index])

    return {
      distance_m: clampedDistance,
      lat,
      lon,
      heading_deg: headingDeg,
    }
  }

  const lastCoordinate = coordinates[coordinates.length - 1]
  const previousCoordinate = coordinates[coordinates.length - 2]
  return {
    distance_m: cumulativeDistances[cumulativeDistances.length - 1] ?? 0,
    lat: lastCoordinate[1],
    lon: lastCoordinate[0],
    heading_deg: computeHeadingDegrees(previousCoordinate, lastCoordinate),
  }
}

export type RouteProjection = {
  distance_m: number
  lat: number
  lon: number
  heading_deg: number
  distance_to_route_m: number
}

export const projectCoordinateOnRoute = (
  coordinate: [number, number],
  routeCoordinates: [number, number][],
  cumulativeDistances: number[],
): RouteProjection | null => {
  if (
    routeCoordinates.length < 2 ||
    cumulativeDistances.length !== routeCoordinates.length
  ) {
    return null
  }

  const [targetLon, targetLat] = coordinate
  const metersPerDegreeLat = 111320
  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestSegmentIndex = 0
  let bestRatio = 0
  let bestLon = routeCoordinates[0][0]
  let bestLat = routeCoordinates[0][1]

  for (let index = 1; index < routeCoordinates.length; index += 1) {
    const [startLon, startLat] = routeCoordinates[index - 1]
    const [endLon, endLat] = routeCoordinates[index]
    const meanLat = ((startLat + endLat + targetLat) / 3) * (Math.PI / 180)
    const metersPerDegreeLon = metersPerDegreeLat * Math.max(0.1, Math.cos(meanLat))

    const startX = startLon * metersPerDegreeLon
    const startY = startLat * metersPerDegreeLat
    const endX = endLon * metersPerDegreeLon
    const endY = endLat * metersPerDegreeLat
    const targetX = targetLon * metersPerDegreeLon
    const targetY = targetLat * metersPerDegreeLat

    const segmentX = endX - startX
    const segmentY = endY - startY
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY
    if (segmentLengthSquared <= 0.000001) {
      continue
    }

    const rawRatio =
      ((targetX - startX) * segmentX + (targetY - startY) * segmentY) /
      segmentLengthSquared
    const ratio = Math.max(0, Math.min(1, rawRatio))
    const projectedX = startX + ratio * segmentX
    const projectedY = startY + ratio * segmentY
    const deltaX = targetX - projectedX
    const deltaY = targetY - projectedY
    const distanceSquared = deltaX * deltaX + deltaY * deltaY

    if (distanceSquared >= bestDistanceSquared) {
      continue
    }

    bestDistanceSquared = distanceSquared
    bestSegmentIndex = index - 1
    bestRatio = ratio
    bestLon = startLon + ratio * (endLon - startLon)
    bestLat = startLat + ratio * (endLat - startLat)
  }

  if (!Number.isFinite(bestDistanceSquared)) {
    return null
  }

  const segmentDistance =
    cumulativeDistances[bestSegmentIndex + 1] - cumulativeDistances[bestSegmentIndex]
  const distanceAlong =
    cumulativeDistances[bestSegmentIndex] + segmentDistance * bestRatio
  const headingDeg = computeHeadingDegrees(
    routeCoordinates[bestSegmentIndex],
    routeCoordinates[bestSegmentIndex + 1],
  )

  return {
    distance_m: distanceAlong,
    lat: bestLat,
    lon: bestLon,
    heading_deg: headingDeg,
    distance_to_route_m: Math.sqrt(bestDistanceSquared),
  }
}

export const kmhToMps = (value: number) => (value * 1000) / 3600

export const isAssistLevel = (value: unknown): value is AssistLevel =>
  value === 'low' || value === 'medium' || value === 'high'

export const isMode = (value: unknown): value is Mode =>
  value === 'walk' || value === 'bike' || value === 'ebike'

export const isTripType = (value: unknown): value is TripType =>
  value === 'oneway' || value === 'loop'

export const isNavigationMode = (value: unknown): value is NavigationMode =>
  value === 'gps' || value === 'simulation'

export const isNavigationCameraMode = (value: unknown): value is NavigationCameraMode =>
  value === 'follow_3d' || value === 'panoramic_3d' || value === 'overview_2d'

export const normalizeProfileSettings = (
  value: Partial<ProfileSettings> | null | undefined,
): ProfileSettings => {
  const walk = value?.speeds?.walk
  const bike = value?.speeds?.bike
  const ebike = value?.speeds?.ebike

  return {
    speeds: {
      walk:
        typeof walk === 'number'
          ? clamp(walk, speedRanges.walk.min, speedRanges.walk.max)
          : defaultProfileSettings.speeds.walk,
      bike:
        typeof bike === 'number'
          ? clamp(bike, speedRanges.bike.min, speedRanges.bike.max)
          : defaultProfileSettings.speeds.bike,
      ebike:
        typeof ebike === 'number'
          ? clamp(ebike, speedRanges.ebike.min, speedRanges.ebike.max)
          : defaultProfileSettings.speeds.ebike,
    },
    ebikeAssist: isAssistLevel(value?.ebikeAssist)
      ? value.ebikeAssist
      : defaultProfileSettings.ebikeAssist,
  }
}

export const loadProfileSettings = (): ProfileSettings => {
  if (typeof window === 'undefined') {
    return defaultProfileSettings
  }

  const raw = localStorage.getItem(profileStorageKey)
  if (!raw) {
    return defaultProfileSettings
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>
    return normalizeProfileSettings(parsed)
  } catch {
    return defaultProfileSettings
  }
}

export const toStoredPlaceCandidate = (value: unknown): PlaceCandidate | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<PlaceCandidate>
  if (
    typeof candidate.label !== 'string' ||
    candidate.label.trim().length === 0 ||
    typeof candidate.lat !== 'number' ||
    !Number.isFinite(candidate.lat) ||
    typeof candidate.lon !== 'number' ||
    !Number.isFinite(candidate.lon)
  ) {
    return null
  }

  return {
    label: candidate.label,
    lat: candidate.lat,
    lon: candidate.lon,
    score:
      typeof candidate.score === 'number' && Number.isFinite(candidate.score)
        ? candidate.score
        : 1,
    source:
      typeof candidate.source === 'string' && candidate.source.trim().length > 0
        ? candidate.source
        : 'stored',
    postcode: typeof candidate.postcode === 'string' ? candidate.postcode : undefined,
    city: typeof candidate.city === 'string' ? candidate.city : undefined,
    department: typeof candidate.department === 'string' ? candidate.department : undefined,
    inseeCode: typeof candidate.inseeCode === 'string' ? candidate.inseeCode : undefined,
  }
}

export const loadPlannerDraft = (): PlannerDraft => {
  if (typeof window === 'undefined') {
    return emptyPlannerDraft
  }

  const raw = localStorage.getItem(plannerDraftStorageKey)
  if (!raw) {
    return emptyPlannerDraft
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlannerDraft>
    return normalizePlannerDraft(parsed)
  } catch {
    return emptyPlannerDraft
  }
}

export const normalizePlannerDraft = (
  value: Partial<PlannerDraft> | null | undefined,
): PlannerDraft => {
  if (!value || typeof value !== 'object') {
    return emptyPlannerDraft
  }

  const targetDistance =
    typeof value.targetDistanceKm === 'number' && Number.isFinite(value.targetDistanceKm)
      ? value.targetDistanceKm
      : ''

  return {
    mode: isMode(value.mode) ? value.mode : null,
    tripType: isTripType(value.tripType) ? value.tripType : null,
    onewayStartValue:
      typeof value.onewayStartValue === 'string' ? value.onewayStartValue : '',
    onewayStartPlace: toStoredPlaceCandidate(value.onewayStartPlace),
    loopStartValue: typeof value.loopStartValue === 'string' ? value.loopStartValue : '',
    loopStartPlace: toStoredPlaceCandidate(value.loopStartPlace),
    endValue: typeof value.endValue === 'string' ? value.endValue : '',
    endPlace: toStoredPlaceCandidate(value.endPlace),
    targetDistanceKm: targetDistance,
  }
}

export const toStoredTripResult = (value: unknown): TripResult | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as TripResult
  if (candidate?.geometry?.type !== 'LineString') {
    return null
  }

  const normalizeElevationProfile = (profile: unknown): RouteElevationPoint[] => {
    if (!Array.isArray(profile)) {
      return []
    }

    return profile
      .map((point) => {
        if (!point || typeof point !== 'object') {
          return null
        }

        const entry = point as Partial<RouteElevationPoint>
        if (
          typeof entry.distance_m !== 'number' ||
          !Number.isFinite(entry.distance_m) ||
          typeof entry.elevation_m !== 'number' ||
          !Number.isFinite(entry.elevation_m)
        ) {
          return null
        }

        return {
          distance_m: entry.distance_m,
          elevation_m: entry.elevation_m,
        }
      })
      .filter((point): point is RouteElevationPoint => point !== null)
  }

  if (candidate.kind === 'route' || candidate.kind === 'loop') {
    return {
      ...candidate,
      elevation_profile: normalizeElevationProfile(
        (candidate as Partial<TripResult>).elevation_profile,
      ),
    }
  }

  const legacy = value as Omit<RouteResult, 'kind'> & {
    elevation_profile?: unknown
  }
  return {
    ...legacy,
    kind: 'route',
    elevation_profile: normalizeElevationProfile(legacy.elevation_profile),
  }
}

export const loadStoredRoute = (): TripResult | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = localStorage.getItem(routeStorageKey)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return toStoredTripResult(parsed)
  } catch {
    return null
  }
}

export const computeRouteBounds = (geometry: RouteGeometry | null): RouteBounds | null => {
  if (!geometry || geometry.type !== 'LineString' || geometry.coordinates.length === 0) {
    return null
  }

  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const coordinate of geometry.coordinates) {
    const [lon, lat] = coordinate
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      continue
    }

    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return null
  }

  return { minLat, minLon, maxLat, maxLon }
}

export const expandBounds = (bounds: RouteBounds): RouteBounds => {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, minimumMapSpan)
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, minimumMapSpan)
  const latPadding = latSpan * mapPaddingRatio
  const lonPadding = lonSpan * mapPaddingRatio

  return {
    minLat: Math.max(-90, bounds.minLat - latPadding),
    maxLat: Math.min(90, bounds.maxLat + latPadding),
    minLon: Math.max(-180, bounds.minLon - lonPadding),
    maxLon: Math.min(180, bounds.maxLon + lonPadding),
  }
}

export const sanitizeFileName = (value: string) => {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cleaned = normalized
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return cleaned || 'bikevoyager'
}

export const buildGpxFileName = (label: string) => {
  const stamp = new Date().toISOString().slice(0, 10)
  const base = sanitizeFileName(label)
  return `${base}-${stamp}.gpx`
}

export const parseContentDispositionFileName = (header: string | null) => {
  if (!header) {
    return null
  }

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return utfMatch[1]
    }
  }

  const asciiMatch = header.match(/filename="?([^";]+)"?/i)
  return asciiMatch?.[1] ?? null
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}
