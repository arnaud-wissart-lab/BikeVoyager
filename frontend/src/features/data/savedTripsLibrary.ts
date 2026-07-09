import type { SavedTripRecord } from './dataPortability'

export type SavedTripLibraryFilter = 'all' | 'favorites' | 'routes' | 'loops'

const normalizeSearch = (value: string) => value.trim().toLowerCase()

export const sortSavedTripsForLibrary = (savedTrips: SavedTripRecord[]) =>
  [...savedTrips].sort((left, right) => {
    if (left.favorite !== right.favorite) {
      return left.favorite ? -1 : 1
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  })

export const filterSavedTripsForLibrary = (
  savedTrips: SavedTripRecord[],
  params: { query: string; filter: SavedTripLibraryFilter },
) => {
  const query = normalizeSearch(params.query)

  return sortSavedTripsForLibrary(savedTrips).filter((trip) => {
    if (params.filter === 'favorites' && !trip.favorite) {
      return false
    }

    if (params.filter === 'routes' && trip.tripType !== 'oneway') {
      return false
    }

    if (params.filter === 'loops' && trip.tripType !== 'loop') {
      return false
    }

    if (!query) {
      return true
    }

    const searchableValues = [trip.name, trip.notes ?? '', ...trip.tags]
    return searchableValues.some((value) => value.toLowerCase().includes(query))
  })
}
