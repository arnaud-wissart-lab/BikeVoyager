import type { AddressBookEntry } from './dataPortability'
import { useAddressBookSlice } from './useAddressBookSlice'

type UseDataFeatureSliceParams = {
  addressBook: AddressBookEntry[]
  filterTag: string
}

export const useDataFeatureSlice = (params: UseDataFeatureSliceParams) =>
  useAddressBookSlice(params)
