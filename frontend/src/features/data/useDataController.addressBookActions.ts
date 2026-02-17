import type { TFunction } from 'i18next'
import type { AddressBookEntry } from './dataPortability'
import type { DetourPoint, RouteRequestPayload } from '../routing/domain'
import { addressBookFilterAll } from './addressBookUtils'
import {
  createAddressBookActions,
  type AddressBookActionsStoreSlice,
} from './addressBook.actions'
import {
  createAddressBookReorderActions,
  type AddressBookReorderStoreSlice,
} from './addressBook.reorder'
import { createDeliveryActions, type DeliveryActionsStoreSlice } from './delivery.actions'

type DataAddressBookStoreSlice = AddressBookActionsStoreSlice &
  DeliveryActionsStoreSlice &
  AddressBookReorderStoreSlice

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
  const addressBookActions = createAddressBookActions({
    store,
    t,
    addressBookById,
    showSuccessToast,
    showErrorToast,
  })

  const deliveryActions = createDeliveryActions({
    store,
    t,
    deliveryStartAddress,
    deliveryStopAddresses,
    requestRoute,
    showSuccessToast,
    showErrorToast,
  })

  const reorderActions = createAddressBookReorderActions({ store })

  return {
    ...addressBookActions,
    ...deliveryActions,
    ...reorderActions,
    addressBookFilterAll,
  }
}
