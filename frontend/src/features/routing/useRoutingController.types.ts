import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import type { RouteKey, TripType } from './domain'

export type MapContext = {
  mapTripType: TripType | null
  mapStartCoordinate: [number, number] | null
  mapEndCoordinate: [number, number] | null
  startLabel: string
  endLabel: string
  mapHeaderTitle: string
}

export type UseRoutingControllerParams = {
  store: AppStore
  route: RouteKey
  t: TFunction
  map: MapContext
  onNavigate: (next: RouteKey, force?: boolean) => void
}
