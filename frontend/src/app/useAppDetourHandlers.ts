import type { DragEvent } from 'react'
import type { AppStore } from '../state/appStore'
import { useDataController } from '../features/data/useDataController'
import { useMapController } from '../features/map/useMapController'
import { useRoutingController } from '../features/routing/useRoutingController'

type UseAppDetourHandlersParams = {
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
}

export const useAppDetourHandlers = ({
  store,
  mapController,
  routingController,
  dataController,
}: UseAppDetourHandlersParams) => {
  const handleAddPoiWaypoint = async (poi: (typeof store.poiItems)[number]) => {
    if (!mapController.poiEnabled || !mapController.mapTripType) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `poi:${poi.id}`,
      source: 'poi',
      poiId: poi.id,
      lat: poi.lat,
      lon: poi.lon,
      label: mapController.getPoiDisplayName(poi),
    })

    if (result.status === 'success' || result.status === 'unchanged') {
      mapController.setSelectedPoiId(poi.id)
      mapController.setIsPoiModalOpen(true)
      mapController.setIsMobilePoiDetailsExpanded(true)
    }
  }

  const handleAddCustomDetourFromAddress = async () => {
    if (!store.customDetourPlace) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `custom-address:${store.customDetourPlace.lat.toFixed(6)}:${store.customDetourPlace.lon.toFixed(6)}`,
      source: 'custom',
      lat: store.customDetourPlace.lat,
      lon: store.customDetourPlace.lon,
      label: store.customDetourPlace.label,
    })

    if (result.status !== 'success') {
      return
    }

    store.setCustomDetourValue('')
    store.setCustomDetourPlace(null)
    store.setCustomDetourLat('')
    store.setCustomDetourLon('')
  }

  const handleAddAddressBookDetour = async (entryId: string) => {
    const entry = dataController.addressBookById.get(entryId)
    if (!entry) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `address-book:${entry.id}`,
      source: 'custom',
      lat: entry.lat,
      lon: entry.lon,
      label: entry.name,
    })

    if (result.status !== 'success') {
      return
    }

    const now = new Date().toISOString()
    store.setAddressBook((current) =>
      current.map((item) => (item.id === entryId ? { ...item, updatedAt: now } : item)),
    )
  }

  const handleAddCustomDetourFromCoordinates = async () => {
    if (typeof store.customDetourLat !== 'number' || typeof store.customDetourLon !== 'number') {
      return
    }
    if (
      store.customDetourLat < -90 ||
      store.customDetourLat > 90 ||
      store.customDetourLon < -180 ||
      store.customDetourLon > 180
    ) {
      return
    }

    const label = `${store.customDetourLat.toFixed(5)}, ${store.customDetourLon.toFixed(5)}`
    const result = await routingController.addDetourPointAndRecalculate({
      id: `custom-gps:${store.customDetourLat.toFixed(6)}:${store.customDetourLon.toFixed(6)}`,
      source: 'custom',
      lat: store.customDetourLat,
      lon: store.customDetourLon,
      label,
    })

    if (result.status !== 'success') {
      return
    }

    store.setCustomDetourValue('')
    store.setCustomDetourPlace(null)
    store.setCustomDetourLat('')
    store.setCustomDetourLon('')
  }

  const handleRemoveDetourPoint = async (detourId: string) => {
    const result = await routingController.removeDetourPointAndRecalculate(detourId)
    if (
      result.success &&
      mapController.selectedPoiId &&
      !result.nextDetours.some((point) => point.poiId === mapController.selectedPoiId)
    ) {
      mapController.setSelectedPoiId(null)
    }
  }

  const handleAddActivePoiAlertWaypoint = async () => {
    if (!mapController.activePoiAlert) {
      return
    }

    await handleAddPoiWaypoint(mapController.activePoiAlert)
    store.setActivePoiAlertId(null)
  }

  const handleDeliveryStopDragStart = (event: DragEvent<HTMLDivElement>, entryId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', entryId)
    dataController.setDeliveryDraggedStopId(entryId)
  }

  const handleDeliveryStopDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleDeliveryStopDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = store.deliveryDraggedStopId ?? event.dataTransfer.getData('text/plain')
    if (!sourceId) {
      return
    }

    dataController.reorderDeliveryStops(sourceId, targetId)
    dataController.setDeliveryDraggedStopId(null)
  }

  const handleDeliveryStopDragEnd = () => {
    dataController.setDeliveryDraggedStopId(null)
  }

  return {
    handleAddPoiWaypoint,
    handleAddCustomDetourFromAddress,
    handleAddAddressBookDetour,
    handleAddCustomDetourFromCoordinates,
    handleRemoveDetourPoint,
    handleAddActivePoiAlertWaypoint,
    handleDeliveryStopDragStart,
    handleDeliveryStopDragOver,
    handleDeliveryStopDrop,
    handleDeliveryStopDragEnd,
  }
}
