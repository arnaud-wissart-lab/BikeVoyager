import { buildGpxFileName, downloadBlob, sanitizeFileName } from '../../../routing/domain'

const savedTripGpxNameMaxLength = 80

const buildDateStamp = () => new Date().toISOString().slice(0, 10)

const truncateSavedTripNameSegment = (segment: string) => {
  if (segment.length <= savedTripGpxNameMaxLength) {
    return segment
  }

  return segment.slice(0, savedTripGpxNameMaxLength).replace(/[-_. ]+$/g, '') || 'trip'
}

export const buildSavedTripGpxFileName = (tripName?: string | null) => {
  const normalizedName = sanitizeFileName(tripName ?? '', 'trip').toLowerCase()
  const nameSegment = truncateSavedTripNameSegment(normalizedName)
  return `bikevoyager-${nameSegment}-${buildDateStamp()}.gpx`
}

export { buildGpxFileName, downloadBlob }
