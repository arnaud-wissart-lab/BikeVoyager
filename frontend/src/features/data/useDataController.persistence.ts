import { useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  addressBookStorageKey,
  appPreferencesStorageKey,
  savedTripsStorageKey,
  type AddressBookEntry,
  type AppPreferences,
  type SavedTripRecord,
} from './dataPortability'
import { addressBookFilterAll } from './addressBookUtils'
import { profileStorageKey, type ProfileSettings } from '../routing/domain'

type UseDataControllerPersistenceParams = {
  profileSettings: ProfileSettings
  appPreferences: AppPreferences
  savedTrips: SavedTripRecord[]
  addressBook: AddressBookEntry[]
  addressBookFilterTag: string
  addressBookTagOptions: string[]
  setAddressBookFilterTag: (value: string) => void
  setDeliveryStartAddressId: Dispatch<SetStateAction<string | null>>
  setDeliveryStopAddressIds: Dispatch<SetStateAction<string[]>>
  setDeliveryDraggedStopId: Dispatch<SetStateAction<string | null>>
}

export const useDataControllerPersistence = ({
  profileSettings,
  appPreferences,
  savedTrips,
  addressBook,
  addressBookFilterTag,
  addressBookTagOptions,
  setAddressBookFilterTag,
  setDeliveryStartAddressId,
  setDeliveryStopAddressIds,
  setDeliveryDraggedStopId,
}: UseDataControllerPersistenceParams) => {
  useEffect(() => {
    localStorage.setItem(profileStorageKey, JSON.stringify(profileSettings))
  }, [profileSettings])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.setItem(appPreferencesStorageKey, JSON.stringify(appPreferences))
  }, [appPreferences])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (savedTrips.length === 0) {
      localStorage.removeItem(savedTripsStorageKey)
      return
    }
    localStorage.setItem(savedTripsStorageKey, JSON.stringify(savedTrips))
  }, [savedTrips])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (addressBook.length === 0) {
      localStorage.removeItem(addressBookStorageKey)
      return
    }
    localStorage.setItem(addressBookStorageKey, JSON.stringify(addressBook))
  }, [addressBook])

  useEffect(() => {
    const knownIds = new Set(addressBook.map((entry) => entry.id))
    setDeliveryStartAddressId((current) => {
      if (!current || knownIds.has(current)) {
        return current
      }
      return null
    })
    setDeliveryStopAddressIds((current) => current.filter((id) => knownIds.has(id)))
    setDeliveryDraggedStopId((current) => {
      if (!current || knownIds.has(current)) {
        return current
      }
      return null
    })
  }, [addressBook, setDeliveryDraggedStopId, setDeliveryStartAddressId, setDeliveryStopAddressIds])

  useEffect(() => {
    if (addressBookFilterTag === addressBookFilterAll) {
      return
    }
    if (addressBookTagOptions.includes(addressBookFilterTag)) {
      return
    }
    setAddressBookFilterTag(addressBookFilterAll)
  }, [addressBookFilterTag, addressBookTagOptions, setAddressBookFilterTag])
}
