import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import {
  addressBookFilterAll,
  formatAddressTagFallbackLabel,
  maxAddressBookTagsPerEntry,
  moveIdByDirection,
  parseAddressTagsInput,
  reorderIdsByDragAndDrop,
} from './addressBookUtils'
import {
  createAddressBookEntry,
  sortAndLimitAddressBook,
  upsertAddressBookEntry,
  type AddressBookEntry,
} from './dataPortability'
import {
  apiModeByUi,
  isMode,
  routeOptionVariants,
  type DetourPoint,
  type PlaceCandidate,
  type RouteLocation,
  type RouteRequestPayload,
} from '../routing/domain'

type DataAddressBookStoreSlice = Pick<
  AppStore,
  | 'addressBook'
  | 'addressBookNameValue'
  | 'addressBookTagsValue'
  | 'addressBookPlaceCandidate'
  | 'deliveryStartAddressId'
  | 'deliveryReturnToStart'
  | 'deliveryOptimizeStops'
  | 'deliveryMode'
  | 'profileSettings'
  | 'setAddressBook'
  | 'setAddressBookNameValue'
  | 'setAddressBookPlaceValue'
  | 'setAddressBookTagsValue'
  | 'setAddressBookPlaceCandidate'
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

type CreateDataAddressBookActionsParams = {
  store: DataAddressBookStoreSlice
  t: TFunction
  addressBookById: Map<string, AddressBookEntry>
  deliveryStartAddress: AddressBookEntry | null
  deliveryStopAddresses: AddressBookEntry[]
  requestRoute: (
    payload: RouteRequestPayload,
    nextDetours?: DetourPoint[],
  ) => Promise<boolean>
  showSuccessToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
  showErrorToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
}

export const createDataAddressBookActions = ({
  store,
  t,
  addressBookById,
  deliveryStartAddress,
  deliveryStopAddresses,
  requestRoute,
  showSuccessToast,
  showErrorToast,
}: CreateDataAddressBookActionsParams) => {
  const {
    addressBook,
    addressBookNameValue,
    addressBookTagsValue,
    addressBookPlaceCandidate,
    deliveryStartAddressId,
    deliveryReturnToStart,
    deliveryOptimizeStops,
    deliveryMode,
    profileSettings,
    setAddressBook,
    setAddressBookNameValue,
    setAddressBookPlaceValue,
    setAddressBookTagsValue,
    setAddressBookPlaceCandidate,
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

  const isPlaceAlreadySavedInAddressBook = (place: PlaceCandidate | null) => {
    if (!place) {
      return false
    }

    return addressBook.some(
      (entry) =>
        Math.abs(entry.lat - place.lat) < 0.00001 &&
        Math.abs(entry.lon - place.lon) < 0.00001,
    )
  }

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

  const formatAddressTagLabel = (tag: string) => {
    if (tag === 'home') {
      return t('addressBookTagHome')
    }
    if (tag === 'client') {
      return t('addressBookTagClient')
    }
    if (tag === 'work') {
      return t('addressBookTagWork')
    }
    if (tag === 'delivery') {
      return t('addressBookTagDelivery')
    }

    return formatAddressTagFallbackLabel(tag)
  }

  const savePlaceInAddressBook = (
    place: PlaceCandidate,
    customName?: string,
    tags?: string[],
  ) => {
    const prepared = createAddressBookEntry({
      name: customName ?? place.label,
      place,
      tags,
    })
    const resolvedName = prepared.name
    setAddressBook((current) => upsertAddressBookEntry(current, prepared))
    showSuccessToast(
      t('addressBookSavedSuccess', {
        name: resolvedName,
      }),
    )
  }

  const handleSaveAddressBookEntry = () => {
    if (!addressBookPlaceCandidate) {
      showErrorToast(t('addressBookMissingPlace'))
      return
    }

    const customName = addressBookNameValue.trim()
    const tags = parseAddressTagsInput(addressBookTagsValue)
    savePlaceInAddressBook(
      addressBookPlaceCandidate,
      customName.length > 0 ? customName : undefined,
      tags,
    )
    setAddressBookNameValue('')
    setAddressBookPlaceValue('')
    setAddressBookTagsValue('')
    setAddressBookPlaceCandidate(null)
  }

  const handleSaveQuickAddress = (place: PlaceCandidate | null) => {
    if (!place || isPlaceAlreadySavedInAddressBook(place)) {
      return
    }

    savePlaceInAddressBook(place)
  }

  const handleDeleteAddressBookEntry = (entryId: string) => {
    const existing = addressBookById.get(entryId)
    setAddressBook((current) => current.filter((entry) => entry.id !== entryId))
    showSuccessToast(
      t('addressBookDeletedSuccess', {
        name: existing?.name ?? t('addressBookEntryFallbackName'),
      }),
    )
  }

  const handleDeleteAddressBookTag = (entryId: string, tagToDelete: string) => {
    const existing = addressBookById.get(entryId)
    if (!existing || !existing.tags.includes(tagToDelete)) {
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: entry.tags.filter((tag) => tag !== tagToDelete),
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagDeletedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(tagToDelete),
      }),
    )
  }

  const handleAddAddressBookTag = (entryId: string, tagToAdd: string) => {
    const existing = addressBookById.get(entryId)
    const [parsedTag] = parseAddressTagsInput(tagToAdd, { maxTags: 1 })
    if (!existing || !parsedTag) {
      return
    }

    if (existing.tags.includes(parsedTag)) {
      return
    }

    if (existing.tags.length >= maxAddressBookTagsPerEntry) {
      showErrorToast(
        t('addressBookTagLimitReached', {
          max: maxAddressBookTagsPerEntry,
        }),
      )
      return
    }

    const now = new Date().toISOString()
    setAddressBook((current) =>
      sortAndLimitAddressBook(
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: [...entry.tags, parsedTag],
                updatedAt: now,
              }
            : entry,
        ),
      ),
    )
    showSuccessToast(
      t('addressBookTagAddedSuccess', {
        name: existing.name,
        tag: formatAddressTagLabel(parsedTag),
      }),
    )
  }

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
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    )
    setDeliveryDraggedStopId((current) => (current === entryId ? null : current))
  }

  const reorderDeliveryStops = (sourceId: string, targetId: string) => {
    setDeliveryStopAddressIds((current) => {
      const next = reorderIdsByDragAndDrop(current, sourceId, targetId)
      if (next === current) {
        return current
      }
      return next
    })
  }

  const handleMoveDeliveryStop = (entryId: string, direction: -1 | 1) => {
    setDeliveryStopAddressIds((current) => moveIdByDirection(current, entryId, direction))
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
        current.map((entry) =>
          usedIds.has(entry.id) ? { ...entry, updatedAt: now } : entry,
        ),
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
    isPlaceAlreadySavedInAddressBook,
    formatAddressTagLabel,
    handleSaveAddressBookEntry,
    handleSaveQuickAddress,
    handleDeleteAddressBookEntry,
    handleDeleteAddressBookTag,
    handleAddAddressBookTag,
    handleDeliveryModeChange,
    handleSelectDeliveryStart,
    handleToggleDeliveryStop,
    reorderDeliveryStops,
    handleMoveDeliveryStop,
    handleClearDeliverySelection,
    handleBuildDeliveryRoute,
    addressBookFilterAll,
  }
}
