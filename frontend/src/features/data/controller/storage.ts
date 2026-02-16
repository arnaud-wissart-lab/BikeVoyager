import {
  sortAndLimitSavedTrips,
  upsertAddressBookEntry,
  type AddressBookEntry,
  type SavedTripRecord,
} from '../dataPortability'

export const mergeSavedTripsById = (
  current: SavedTripRecord[],
  incoming: SavedTripRecord[],
) => {
  const byId = new Map<string, SavedTripRecord>()
  for (const trip of current) {
    byId.set(trip.id, trip)
  }
  for (const trip of incoming) {
    byId.set(trip.id, trip)
  }
  return sortAndLimitSavedTrips(Array.from(byId.values()))
}

export const mergeAddressBookEntries = (
  current: AddressBookEntry[],
  incoming: AddressBookEntry[],
) => {
  let merged = current
  for (const entry of incoming) {
    merged = upsertAddressBookEntry(merged, entry)
  }
  return merged
}
