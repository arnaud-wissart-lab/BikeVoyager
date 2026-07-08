import { useMemo } from 'react'
import { osmTagLabels, osmValueLabels, type PoiCategory, type PoiItem } from '../routing/domain'
import type { TFunction } from 'i18next'
import {
  buildPoiDisplayRows,
  buildPoiExternalLinks,
  buildPoiTechnicalRows,
} from './poiDetailsPresentation'

type UseMapPoiFormattingParams = {
  selectedPoi: PoiItem | null
  t: TFunction
  isFrench: boolean
}

export const useMapPoiFormatting = ({ selectedPoi, t, isFrench }: UseMapPoiFormattingParams) => {
  const toTitleCase = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return trimmed
    }

    return trimmed[0].toLocaleUpperCase(isFrench ? 'fr-FR' : 'en-US') + trimmed.slice(1)
  }

  const formatRawOsmToken = (value: string) => value.trim().replaceAll('_', ' ')
  const normalizeOsmToken = (value: string) => value.trim().toLowerCase()

  const formatPoiTagLabel = (tagKey: string) => {
    const normalized = normalizeOsmToken(tagKey)
    const mapped = osmTagLabels[normalized]
    if (mapped) {
      return isFrench ? mapped.fr : mapped.en
    }

    return toTitleCase(tagKey.replaceAll(':', ' • ').replaceAll('_', ' '))
  }

  const formatPoiTagValue = (tagValue: string) => {
    const tokens = tagValue
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean)

    if (tokens.length === 0) {
      return ''
    }

    const localized = tokens.map((token) => {
      const mapped = osmValueLabels[normalizeOsmToken(token)]
      if (mapped) {
        return isFrench ? mapped.fr : mapped.en
      }

      return formatRawOsmToken(token)
    })

    return localized.join(' ; ')
  }

  const formatPoiKind = (kind: string | null | undefined) => {
    if (!kind) {
      return null
    }

    const separatorIndex = kind.indexOf(':')
    if (separatorIndex <= 0) {
      return toTitleCase(formatPoiTagValue(kind))
    }

    const kindKey = kind.slice(0, separatorIndex)
    const kindValue = kind.slice(separatorIndex + 1)
    return `${formatPoiTagLabel(kindKey)} • ${formatPoiTagValue(kindValue)}`
  }

  const getPoiDisplayName = (poi: PoiItem | null) => {
    if (!poi) {
      return t('poiDetailsTitle')
    }

    const hasExplicitName = Object.keys(poi.tags ?? {}).some((key) => {
      const normalized = key.toLowerCase()
      return (
        normalized === 'name' ||
        normalized === 'name:fr' ||
        normalized === 'name:en' ||
        normalized === 'brand' ||
        normalized === 'operator' ||
        normalized === 'official_name' ||
        normalized === 'int_name'
      )
    })

    if (hasExplicitName && poi.name.trim()) {
      return poi.name
    }

    const kindLabel = formatPoiKind(poi.kind)
    if (kindLabel && kindLabel.includes(' • ')) {
      const parts = kindLabel.split(' • ')
      return toTitleCase(parts[parts.length - 1])
    }

    if (kindLabel) {
      return toTitleCase(kindLabel)
    }

    return poi.name
  }

  const selectedPoiDisplayName = getPoiDisplayName(selectedPoi)
  const selectedPoiKind = formatPoiKind(selectedPoi?.kind)
  const poiCategoryLabels = useMemo<Record<PoiCategory, string>>(
    () => ({
      monuments: t('poiCategoryMonuments'),
      paysages: t('poiCategoryLandscapes'),
      commerces: t('poiCategoryShops'),
      services: t('poiCategoryServices'),
    }),
    [t],
  )
  const selectedPoiCategoryLabel = selectedPoi ? poiCategoryLabels[selectedPoi.category] : null
  const selectedPoiUsefulRows = useMemo(
    () => buildPoiDisplayRows(selectedPoi, { isFrench }),
    [isFrench, selectedPoi],
  )
  const selectedPoiExternalLinks = useMemo(() => buildPoiExternalLinks(selectedPoi), [selectedPoi])
  const selectedPoiTechnicalRows = useMemo(() => buildPoiTechnicalRows(selectedPoi), [selectedPoi])

  return {
    formatPoiTagLabel,
    formatPoiTagValue,
    formatPoiKind,
    getPoiDisplayName,
    selectedPoiDisplayName,
    selectedPoiKind,
    poiCategoryLabels,
    selectedPoiCategoryLabel,
    selectedPoiUsefulRows,
    selectedPoiExternalLinks,
    selectedPoiTechnicalRows,
  }
}
