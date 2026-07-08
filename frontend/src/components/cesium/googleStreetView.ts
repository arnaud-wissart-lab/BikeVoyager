import { normalizeHeadingDegrees } from './math'

const GOOGLE_STREET_VIEW_URL_BASE = 'https://www.google.com/maps/@'

const assertFiniteCoordinate = (name: string, value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} doit être un nombre fini.`)
  }
}

export const buildGoogleStreetViewUrl = (lat: number, lon: number, heading?: number) => {
  assertFiniteCoordinate('lat', lat)
  assertFiniteCoordinate('lon', lon)

  const params = new URLSearchParams()
  params.set('api', '1')
  params.set('map_action', 'pano')
  params.set('viewpoint', `${lat},${lon}`)

  if (typeof heading === 'number' && Number.isFinite(heading)) {
    params.set('heading', `${normalizeHeadingDegrees(heading)}`)
  }

  params.set('pitch', '0')
  params.set('fov', '80')

  return `${GOOGLE_STREET_VIEW_URL_BASE}?${params.toString()}`
}
