import { useMemo } from 'react'
import {
  osmTagLabels,
  osmValueLabels,
  poiPreferredTagOrder,
  type PoiCategory,
  type PoiItem,
} from '../routing/domain'
import type { TFunction } from 'i18next'

type UseMapPoiFormattingParams = {
  selectedPoi: PoiItem | null
  t: TFunction
  isFrench: boolean
}

export const useMapPoiFormatting = ({
  selectedPoi,
  t,
  isFrench,
}: UseMapPoiFormattingParams) => {
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
  const selectedPoiCategoryLabel = selectedPoi
    ? poiCategoryLabels[selectedPoi.category]
    : null
  const selectedPoiTags = useMemo(() => {
    if (!selectedPoi?.tags) {
      return [] as Array<[string, string]>
    }

    return Object.entries(selectedPoi.tags)
      .filter(([key, value]) => Boolean(key?.trim()) && Boolean(value?.trim()))
      .sort(([leftKey], [rightKey]) => {
        const leftIndex = poiPreferredTagOrder.indexOf(leftKey.toLowerCase())
        const rightIndex = poiPreferredTagOrder.indexOf(rightKey.toLowerCase())
        if (leftIndex !== -1 && rightIndex !== -1) {
          return leftIndex - rightIndex
        }
        if (leftIndex !== -1) {
          return -1
        }
        if (rightIndex !== -1) {
          return 1
        }
        return leftKey.localeCompare(rightKey)
      })
  }, [selectedPoi])
  const selectedPoiWebsite =
    selectedPoi?.tags?.website ?? selectedPoi?.tags?.['contact:website'] ?? null

  return {
    formatPoiTagLabel,
    formatPoiTagValue,
    formatPoiKind,
    getPoiDisplayName,
    selectedPoiDisplayName,
    selectedPoiKind,
    poiCategoryLabels,
    selectedPoiCategoryLabel,
    selectedPoiTags,
    selectedPoiWebsite,
  }
}
