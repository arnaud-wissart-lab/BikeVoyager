import type {
  ApiRouteMode,
  Mode,
  PlannerDraft,
  PoiCategory,
  ProfileSettings,
  RouteKey,
  RouteOptions,
} from './types'

export const minimumMapSpan = 0.02
export const mapPaddingRatio = 0.18

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

export const speedRanges: Record<
  Mode,
  { min: number; max: number; step: number; precision: number }
> = {
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
