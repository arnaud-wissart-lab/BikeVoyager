import { useMemo } from 'react'
import { addressBookFilterAll } from './addressBookUtils'
import type { AddressBookEntry } from './dataPortability'

type UseAddressBookSliceParams = {
  addressBook: AddressBookEntry[]
  filterTag: string
}

export const useAddressBookSlice = ({ addressBook, filterTag }: UseAddressBookSliceParams) => {
  const addressBookById = useMemo(() => {
    const map = new Map<string, AddressBookEntry>()
    for (const entry of addressBook) {
      map.set(entry.id, entry)
    }
    return map
  }, [addressBook])

  const addressBookTagOptions = useMemo(() => {
    const tags = new Set<string>()
    for (const entry of addressBook) {
      for (const tag of entry.tags) {
        tags.add(tag)
      }
    }

    return Array.from(tags).sort((left, right) =>
      left.localeCompare(right, 'fr', { sensitivity: 'base' }),
    )
  }, [addressBook])

  const visibleAddressBookEntries = useMemo(() => {
    if (filterTag === addressBookFilterAll) {
      return addressBook
    }

    return addressBook.filter((entry) => entry.tags.includes(filterTag))
  }, [addressBook, filterTag])

  return {
    addressBookById,
    addressBookTagOptions,
    visibleAddressBookEntries,
    visibleAddressBookCount: visibleAddressBookEntries.length,
  }
}
