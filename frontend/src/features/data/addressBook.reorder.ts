import type { AppStore } from '../../state/appStore'
import { moveIdByDirection, reorderIdsByDragAndDrop } from './addressBookUtils'

export type AddressBookReorderStoreSlice = Pick<AppStore, 'setDeliveryStopAddressIds'>

type CreateAddressBookReorderActionsParams = {
  store: AddressBookReorderStoreSlice
}

export const createAddressBookReorderActions = ({
  store,
}: CreateAddressBookReorderActionsParams) => {
  const { setDeliveryStopAddressIds } = store

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

  return {
    reorderDeliveryStops,
    handleMoveDeliveryStop,
  }
}
