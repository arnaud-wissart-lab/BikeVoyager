import type { TFunction } from 'i18next'
import type { Mode, TripType } from './domain'
import { usePlannerSlice } from './usePlannerSlice'

type UseRoutingFeatureSliceParams = {
  mode: Mode | null
  tripType: TripType | null
  hasStartSelection: boolean
  hasEndSelection: boolean
  targetDistanceKm: number | ''
  hasResult: boolean
  isDirty: boolean
  t: TFunction
}

export const useRoutingFeatureSlice = (params: UseRoutingFeatureSliceParams) =>
  usePlannerSlice(params)
