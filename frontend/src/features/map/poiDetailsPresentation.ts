import {
  osmValueLabels,
  poiPreferredTagOrder,
  type OsmLabel,
  type PoiItem,
} from '../routing/domain'

type PoiLocaleOptions = {
  isFrench: boolean
}

export type PoiDisplayRow = {
  key: string
  labelKey: string
  value: string
}

export type PoiExternalLink = {
  key: 'website' | 'wikipedia' | 'wikidata' | 'openstreetmap'
  labelKey: string
  url: string
}

const usefulPoiTagLabelKeys: Record<string, string> = {
  opening_hours: 'poiDetailsLabelOpeningHours',
  fee: 'poiDetailsLabelFee',
  access: 'poiDetailsLabelAccess',
  surface: 'poiDetailsLabelSurface',
  lit: 'poiDetailsLabelLit',
  wheelchair: 'poiDetailsLabelWheelchair',
  capacity: 'poiDetailsLabelCapacity',
  'capacity:disabled': 'poiDetailsLabelCapacityDisabled',
  'capacity:parent': 'poiDetailsLabelCapacityParent',
  'capacity:women': 'poiDetailsLabelCapacityWomen',
  bicycle_parking: 'poiDetailsLabelBicycleParking',
  drinking_water: 'poiDetailsLabelDrinkingWater',
  toilets: 'poiDetailsLabelToilets',
  shelter: 'poiDetailsLabelShelter',
  internet_access: 'poiDetailsLabelInternetAccess',
  phone: 'poiDetailsLabelPhone',
  'contact:phone': 'poiDetailsLabelPhone',
  email: 'poiDetailsLabelEmail',
  description: 'poiDetailsLabelDescription',
}

const externalLinkLabelKeys: Record<PoiExternalLink['key'], string> = {
  website: 'poiDetailsWebsite',
  wikipedia: 'poiDetailsWikipedia',
  wikidata: 'poiDetailsWikidata',
  openstreetmap: 'poiDetailsOpenStreetMap',
}

const usefulPoiTagOrder = [
  'opening_hours',
  'fee',
  'access',
  'capacity',
  'capacity:disabled',
  'capacity:parent',
  'capacity:women',
  'lit',
  'surface',
  'wheelchair',
  'bicycle_parking',
  'drinking_water',
  'toilets',
  'shelter',
  'internet_access',
  'phone',
  'contact:phone',
  'email',
  'description',
]

const externalLinkTagKeys = new Set(['website', 'contact:website', 'wikipedia', 'wikidata'])

const normalizeTagKey = (key: string) => key.trim().toLowerCase()
const normalizeTagValue = (value: string) => value.trim()

const parsePositiveInteger = (value: string) => {
  const normalized = normalizeTagValue(value)
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)
  return parsed > 0 ? parsed : null
}

const formatRawOsmToken = (value: string) => value.trim().replaceAll('_', ' ')

const formatLocalizedValue = (value: string, { isFrench }: PoiLocaleOptions) => {
  const tokens = value
    .split(';')
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return ''
  }

  const localized = tokens.map((token) => {
    const mapped: OsmLabel | undefined = osmValueLabels[token.toLowerCase()]
    if (mapped) {
      return isFrench ? mapped.fr : mapped.en
    }

    return formatRawOsmToken(token)
  })

  return localized.join(' ; ')
}

const isEmptyOrNonInformativeValue = (value: string) => {
  const normalized = normalizeTagValue(value).toLowerCase()
  return (
    normalized.length === 0 ||
    normalized === '0' ||
    normalized === 'none' ||
    normalized === 'unknown' ||
    normalized === 'n/a' ||
    normalized === 'null'
  )
}

const isReadableDescription = (value: string, poi: PoiItem | null | undefined) => {
  const trimmed = normalizeTagValue(value)
  if (trimmed.length < 8 || trimmed.length > 180) {
    return false
  }

  if (/^https?:\/\//i.test(trimmed) || /[{}[\]<>]/.test(trimmed)) {
    return false
  }

  return trimmed.toLowerCase() !== poi?.name?.trim().toLowerCase()
}

const isKnownUsefulPoiTag = (key: string) =>
  Object.prototype.hasOwnProperty.call(usefulPoiTagLabelKeys, normalizeTagKey(key))

const isUsefulCapacityTag = (key: string) =>
  ['capacity', 'capacity:disabled', 'capacity:parent', 'capacity:women'].includes(
    normalizeTagKey(key),
  )

export const formatUsefulPoiTagLabel = (key: string) =>
  usefulPoiTagLabelKeys[normalizeTagKey(key)] ?? null

export const shouldDisplayUsefulPoiTag = (key: string, value: string, poi?: PoiItem | null) => {
  const normalizedKey = normalizeTagKey(key)
  const normalizedValue = normalizeTagValue(value)

  if (!isKnownUsefulPoiTag(normalizedKey) || isEmptyOrNonInformativeValue(normalizedValue)) {
    return false
  }

  if (isUsefulCapacityTag(normalizedKey)) {
    return parsePositiveInteger(normalizedValue) !== null
  }

  if (normalizedKey === 'description') {
    return isReadableDescription(normalizedValue, poi)
  }

  return true
}

export const formatUsefulPoiTagValue = (key: string, value: string, options: PoiLocaleOptions) => {
  const normalizedKey = normalizeTagKey(key)
  const normalizedValue = normalizeTagValue(value)

  if (isUsefulCapacityTag(normalizedKey)) {
    const capacity = parsePositiveInteger(normalizedValue)
    if (capacity === null) {
      return ''
    }

    return options.isFrench
      ? `${capacity} place${capacity > 1 ? 's' : ''}`
      : `${capacity} space${capacity > 1 ? 's' : ''}`
  }

  if (normalizedKey === 'phone' || normalizedKey === 'contact:phone' || normalizedKey === 'email') {
    return normalizedValue
  }

  return formatLocalizedValue(normalizedValue, options)
}

export const buildPoiDisplayRows = (
  poi: PoiItem | null | undefined,
  options: PoiLocaleOptions,
): PoiDisplayRow[] => {
  if (!poi?.tags) {
    return []
  }

  return Object.entries(poi.tags)
    .filter(([key, value]) => shouldDisplayUsefulPoiTag(key, value, poi))
    .map(([key, value]) => ({
      key,
      labelKey: formatUsefulPoiTagLabel(key) ?? key,
      value: formatUsefulPoiTagValue(key, value, options),
    }))
    .filter((row) => row.value.length > 0)
    .sort((left, right) => {
      const leftIndex = usefulPoiTagOrder.indexOf(normalizeTagKey(left.key))
      const rightIndex = usefulPoiTagOrder.indexOf(normalizeTagKey(right.key))
      return leftIndex - rightIndex
    })
}

const normalizeExternalUrl = (value: string) => {
  const trimmed = normalizeTagValue(value)
  if (!trimmed) {
    return null
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const buildWikipediaUrl = (value: string) => {
  const trimmed = normalizeTagValue(value)
  if (!trimmed) {
    return null
  }

  const directUrl = normalizeExternalUrl(trimmed)
  if (directUrl) {
    return directUrl
  }

  const match = /^([a-z]{2,3}):(.+)$/i.exec(trimmed)
  if (!match) {
    return null
  }

  const [, language, page] = match
  return `https://${language.toLowerCase()}.wikipedia.org/wiki/${encodeURIComponent(page)}`
}

const buildWikidataUrl = (value: string) => {
  const trimmed = normalizeTagValue(value)
  return /^Q\d+$/i.test(trimmed) ? `https://www.wikidata.org/wiki/${trimmed.toUpperCase()}` : null
}

const buildOpenStreetMapUrl = (poi: PoiItem) => {
  const osmType = poi.osm_type?.trim().toLowerCase()
  if (
    !osmType ||
    !['node', 'way', 'relation'].includes(osmType) ||
    typeof poi.osm_id !== 'number'
  ) {
    return null
  }

  return `https://www.openstreetmap.org/${osmType}/${poi.osm_id}`
}

export const buildPoiExternalLinks = (poi: PoiItem | null | undefined): PoiExternalLink[] => {
  if (!poi) {
    return []
  }

  const tags = poi.tags ?? {}
  const links: PoiExternalLink[] = []
  const website = normalizeExternalUrl(tags.website ?? tags['contact:website'] ?? '')
  const wikipedia = buildWikipediaUrl(tags.wikipedia ?? '')
  const wikidata = buildWikidataUrl(tags.wikidata ?? '')
  const openstreetmap = buildOpenStreetMapUrl(poi)

  if (website) {
    links.push({ key: 'website', labelKey: externalLinkLabelKeys.website, url: website })
  }
  if (wikipedia) {
    links.push({ key: 'wikipedia', labelKey: externalLinkLabelKeys.wikipedia, url: wikipedia })
  }
  if (wikidata) {
    links.push({ key: 'wikidata', labelKey: externalLinkLabelKeys.wikidata, url: wikidata })
  }
  if (openstreetmap) {
    links.push({
      key: 'openstreetmap',
      labelKey: externalLinkLabelKeys.openstreetmap,
      url: openstreetmap,
    })
  }

  return links
}

export const buildPoiTechnicalRows = (poi: PoiItem | null | undefined): PoiDisplayRow[] => {
  if (!poi) {
    return []
  }

  const rows: PoiDisplayRow[] = []

  if (poi.osm_type && typeof poi.osm_id === 'number') {
    rows.push({
      key: 'osm_source',
      labelKey: 'poiDetailsSource',
      value: `${poi.osm_type}/${poi.osm_id}`,
    })
  }

  const tagRows = Object.entries(poi.tags ?? {})
    .filter(([key, value]) => {
      const normalizedKey = normalizeTagKey(key)
      return (
        Boolean(normalizedKey) &&
        Boolean(normalizeTagValue(value)) &&
        !shouldDisplayUsefulPoiTag(key, value, poi) &&
        !externalLinkTagKeys.has(normalizedKey)
      )
    })
    .map(([key, value]) => ({
      key,
      labelKey: key,
      value: normalizeTagValue(value),
    }))
    .sort((left, right) => {
      const leftIndex = poiPreferredTagOrder.indexOf(normalizeTagKey(left.key))
      const rightIndex = poiPreferredTagOrder.indexOf(normalizeTagKey(right.key))
      if (leftIndex !== -1 && rightIndex !== -1) {
        return leftIndex - rightIndex
      }
      if (leftIndex !== -1) {
        return -1
      }
      if (rightIndex !== -1) {
        return 1
      }
      return left.key.localeCompare(right.key)
    })

  return rows.concat(tagRows)
}
