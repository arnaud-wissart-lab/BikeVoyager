import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { sortAndLimitAddressBook, type AddressBookEntry } from './dataPortability'
import {
  apiModeByUi,
  isMode,
  routeOptionVariants,
  type DetourPoint,
  type PlaceCandidate,
  type RouteLocation,
  type RouteRequestPayload,
} from '../routing/domain'

type ToastHandler = (message: string, options?: { title?: string; durationMs?: number }) => void

export type DeliveryActionsStoreSlice = Pick<
  AppStore,
  | 'deliveryStartAddressId'
  | 'deliveryReturnToStart'
  | 'deliveryOptimizeStops'
  | 'deliveryMode'
  | 'profileSettings'
  | 'setAddressBook'
  | 'setDeliveryMode'
  | 'setDeliveryStartAddressId'
  | 'setDeliveryStopAddressIds'
  | 'setDeliveryDraggedStopId'
  | 'setMode'
  | 'setTripType'
  | 'setOnewayStartValue'
  | 'setOnewayStartPlace'
  | 'setLoopStartValue'
  | 'setLoopStartPlace'
  | 'setEndValue'
  | 'setEndPlace'
  | 'setTargetDistanceKm'
  | 'setRouteAlternativeIndex'
  | 'setLoopAlternativeIndex'
>

type CreateDeliveryActionsParams = {
  store: DeliveryActionsStoreSlice
  t: TFunction
  deliveryStartAddress: AddressBookEntry | null
  deliveryStopAddresses: AddressBookEntry[]
  requestRoute: (payload: RouteRequestPayload, nextDetours?: DetourPoint[]) => Promise<boolean>
  showSuccessToast: ToastHandler
  showErrorToast: ToastHandler
}

export const createDeliveryActions = ({
  store,
  t,
  deliveryStartAddress,
  deliveryStopAddresses,
  requestRoute,
  showSuccessToast,
  showErrorToast,
}: CreateDeliveryActionsParams) => {
  const {
    deliveryStartAddressId,
    deliveryReturnToStart,
    deliveryOptimizeStops,
    deliveryMode,
    profileSettings,
    setAddressBook,
    setDeliveryMode,
    setDeliveryStartAddressId,
    setDeliveryStopAddressIds,
    setDeliveryDraggedStopId,
    setMode,
    setTripType,
    setOnewayStartValue,
    setOnewayStartPlace,
    setLoopStartValue,
    setLoopStartPlace,
    setEndValue,
    setEndPlace,
    setTargetDistanceKm,
    setRouteAlternativeIndex,
    setLoopAlternativeIndex,
  } = store

  const toAddressBookRouteLocation = (entry: AddressBookEntry): RouteLocation => ({
    lat: entry.lat,
    lon: entry.lon,
    label: entry.label,
  })

  const toAddressBookPlaceCandidate = (entry: AddressBookEntry): PlaceCandidate => ({
    label: entry.label,
    lat: entry.lat,
    lon: entry.lon,
    score: 1,
    source: 'address-book',
  })

  const toAddressBookDetourPoint = (entry: AddressBookEntry): DetourPoint => ({
    id: `address-book:${entry.id}`,
    source: 'custom',
    lat: entry.lat,
    lon: entry.lon,
    label: entry.name,
  })

  const handleDeliveryModeChange = (value: string) => {
    if (!isMode(value)) {
      return
    }

    setDeliveryMode(value)
  }

  const handleSelectDeliveryStart = (entryId: string) => {
    setDeliveryStartAddressId(entryId)
    setDeliveryStopAddressIds((current) => current.filter((id) => id !== entryId))
    setDeliveryDraggedStopId((current) => (current === entryId ? null : current))
  }

  const handleToggleDeliveryStop = (entryId: string) => {
    if (entryId === deliveryStartAddressId) {
      return
    }

    setDeliveryStopAddressIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    )
    setDeliveryDraggedStopId((current) => (current === entryId ? null : current))
  }

  const handleClearDeliverySelection = () => {
    setDeliveryStartAddressId(null)
    setDeliveryStopAddressIds([])
    setDeliveryDraggedStopId(null)
    showSuccessToast(t('deliverySelectionCleared'))
  }

  const handleBuildDeliveryRoute = async () => {
    if (!deliveryStartAddress) {
      showErrorToast(t('deliveryRouteMissingStart'))
      return
    }

    if (deliveryStopAddresses.length === 0) {
      showErrorToast(t('deliveryRouteMissingStops'))
      return
    }

    const startLocation = toAddressBookRouteLocation(deliveryStartAddress)
    let endAddress = deliveryStartAddress
    let waypointAddresses = deliveryStopAddresses
    if (!deliveryReturnToStart) {
      endAddress = deliveryStopAddresses[deliveryStopAddresses.length - 1]
      waypointAddresses = deliveryStopAddresses.slice(0, -1)
    }

    const requestBody: RouteRequestPayload = {
      from: startLocation,
      to: toAddressBookRouteLocation(endAddress),
      ...(waypointAddresses.length > 0
        ? {
            waypoints: waypointAddresses.map(toAddressBookRouteLocation),
          }
        : {}),
      optimizeWaypoints: deliveryOptimizeStops,
      mode: apiModeByUi[deliveryMode],
      options: routeOptionVariants[0],
      speedKmh: profileSettings.speeds[deliveryMode],
      ...(deliveryMode === 'ebike'
        ? {
            ebikeAssist: profileSettings.ebikeAssist,
          }
        : {}),
    }

    setMode(deliveryMode)
    setTripType('oneway')
    setOnewayStartValue(deliveryStartAddress.label)
    setOnewayStartPlace(toAddressBookPlaceCandidate(deliveryStartAddress))
    setLoopStartValue('')
    setLoopStartPlace(null)
    setEndValue(endAddress.label)
    setEndPlace(toAddressBookPlaceCandidate(endAddress))
    setTargetDistanceKm('')
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)

    const nextDetours = waypointAddresses.map(toAddressBookDetourPoint)
    const success = await requestRoute(requestBody, nextDetours)
    if (!success) {
      showErrorToast(t('deliveryRouteBuildFailed'))
      return
    }

    const usedIds = new Set<string>([
      deliveryStartAddress.id,
      ...deliveryStopAddresses.map((entry) => entry.id),
    ])
    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) => (usedIds.has(entry.id) ? { ...entry, updatedAt: now } : entry)),
      ),
    )

    showSuccessToast(
      t(
        deliveryOptimizeStops
          ? 'deliveryRouteBuiltSuccessOptimized'
          : 'deliveryRouteBuiltSuccessOrdered',
        {
          count: deliveryStopAddresses.length,
        },
      ),
    )
  }

  return {
    handleDeliveryModeChange,
    handleSelectDeliveryStart,
    handleToggleDeliveryStop,
    handleClearDeliverySelection,
    handleBuildDeliveryRoute,
  }
}
