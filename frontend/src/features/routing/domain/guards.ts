import type {
  AssistLevel,
  Mode,
  NavigationCameraMode,
  NavigationMode,
  TripType,
} from './types'

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
