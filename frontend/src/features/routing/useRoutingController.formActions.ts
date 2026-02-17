import type { AppStore } from '../../state/appStore'
import { isMode, speedRanges, type PlaceCandidate, type TripType } from './domain'

type RoutingControllerFormStoreSlice = Pick<
  AppStore,
  | 'setMode'
  | 'setTripType'
  | 'setEndValue'
  | 'setEndPlace'
  | 'setTargetDistanceKm'
  | 'setDetourPoints'
  | 'setRouteAlternativeIndex'
  | 'setLoopAlternativeIndex'
  | 'setRouteErrorKey'
  | 'setRouteErrorMessage'
  | 'setOnewayStartValue'
  | 'setOnewayStartPlace'
  | 'setLoopStartValue'
  | 'setLoopStartPlace'
  | 'setProfileSettings'
>

type CreateRoutingControllerFormActionsParams = {
  store: RoutingControllerFormStoreSlice
  markDirty: () => void
}

export const createRoutingControllerFormActions = ({
  store,
  markDirty,
}: CreateRoutingControllerFormActionsParams) => {
  const {
    setMode,
    setTripType,
    setEndValue,
    setEndPlace,
    setTargetDistanceKm,
    setDetourPoints,
    setRouteAlternativeIndex,
    setLoopAlternativeIndex,
    setRouteErrorKey,
    setRouteErrorMessage,
    setOnewayStartValue,
    setOnewayStartPlace,
    setLoopStartValue,
    setLoopStartPlace,
    setProfileSettings,
  } = store

  const handleModeChange = (value: string) => {
    if (!isMode(value)) {
      return
    }

    setMode(value)
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    markDirty()
  }

  const handleTypeChange = (value: string) => {
    setTripType(value as TripType)
    setEndValue('')
    setEndPlace(null)
    setTargetDistanceKm('')
    setDetourPoints([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    markDirty()
  }

  const handleOnewayStartValueChange = (value: string) => {
    setOnewayStartValue(value)
    markDirty()
  }

  const handleOnewayStartPlaceSelect = (place: PlaceCandidate | null) => {
    setOnewayStartPlace(place)
    markDirty()
  }

  const handleLoopStartValueChange = (value: string) => {
    setLoopStartValue(value)
    markDirty()
  }

  const handleLoopStartPlaceSelect = (place: PlaceCandidate | null) => {
    setLoopStartPlace(place)
    markDirty()
  }

  const handleEndValueChange = (value: string) => {
    setEndValue(value)
    markDirty()
  }

  const handleEndPlaceSelect = (place: PlaceCandidate | null) => {
    setEndPlace(place)
    markDirty()
  }

  const handleTargetDistanceChange = (value: number | string) => {
    setTargetDistanceKm(typeof value === 'number' ? value : '')
    markDirty()
  }

  const handleSpeedChange = (targetMode: 'walk' | 'bike' | 'ebike', value: number | '') => {
    if (typeof value !== 'number') {
      return
    }

    const range = speedRanges[targetMode]
    setProfileSettings((current) => ({
      ...current,
      speeds: {
        ...current.speeds,
        [targetMode]: Math.max(range.min, Math.min(range.max, value)),
      },
    }))
  }

  return {
    handleModeChange,
    handleTypeChange,
    handleOnewayStartValueChange,
    handleOnewayStartPlaceSelect,
    handleLoopStartValueChange,
    handleLoopStartPlaceSelect,
    handleEndValueChange,
    handleEndPlaceSelect,
    handleTargetDistanceChange,
    handleSpeedChange,
  }
}
