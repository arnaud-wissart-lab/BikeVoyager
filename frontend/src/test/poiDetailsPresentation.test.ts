import { describe, expect, it } from 'vitest'
import {
  buildPoiDisplayRows,
  buildPoiExternalLinks,
  buildPoiTechnicalRows,
} from '../features/map/poiDetailsPresentation'
import type { PoiItem } from '../features/routing/domain'

const buildPoi = (tags: Record<string, string>): PoiItem => ({
  id: 'poi-1',
  name: 'Parking de la gare',
  lat: 48.8566,
  lon: 2.3522,
  category: 'services',
  kind: 'amenity:parking',
  distance_m: 1200,
  osm_type: 'way',
  osm_id: 123,
  tags,
})

describe('poiDetailsPresentation', () => {
  it('affiche seulement les informations utiles du parking', () => {
    const rows = buildPoiDisplayRows(
      buildPoi({
        amenity: 'parking',
        capacity: '60',
        'capacity:disabled': '0',
        'capacity:parent': '0',
        'capacity:women': '0',
        lit: 'yes',
        surface: 'asphalt',
        unexpected_raw_tag: 'visible seulement en technique',
      }),
      { isFrench: true },
    )

    expect(rows).toEqual([
      { key: 'capacity', labelKey: 'poiDetailsLabelCapacity', value: '60 places' },
      { key: 'lit', labelKey: 'poiDetailsLabelLit', value: 'oui' },
      { key: 'surface', labelKey: 'poiDetailsLabelSurface', value: 'asphalte' },
    ])
  })

  it('masque les capacités nulles dans les informations utiles', () => {
    const rows = buildPoiDisplayRows(
      buildPoi({
        capacity: '0',
        'capacity:disabled': '0',
        'capacity:parent': '0',
        'capacity:women': '0',
      }),
      { isFrench: true },
    )

    expect(rows).toHaveLength(0)
  })

  it('génère les liens externes utiles sans les exposer comme texte brut', () => {
    const links = buildPoiExternalLinks(
      buildPoi({
        website: 'example.org',
        wikipedia: 'fr:Quelque_chose',
        wikidata: 'Q123',
      }),
    )

    expect(links).toEqual([
      {
        key: 'website',
        labelKey: 'poiDetailsWebsite',
        url: 'https://example.org/',
      },
      {
        key: 'wikipedia',
        labelKey: 'poiDetailsWikipedia',
        url: 'https://fr.wikipedia.org/wiki/Quelque_chose',
      },
      {
        key: 'wikidata',
        labelKey: 'poiDetailsWikidata',
        url: 'https://www.wikidata.org/wiki/Q123',
      },
      {
        key: 'openstreetmap',
        labelKey: 'poiDetailsOpenStreetMap',
        url: 'https://www.openstreetmap.org/way/123',
      },
    ])
  })

  it('conserve les tags inconnus dans les données techniques', () => {
    const rows = buildPoiTechnicalRows(
      buildPoi({
        capacity: '60',
        'capacity:disabled': '0',
        unknown_tag: 'valeur brute',
        website: 'https://example.org',
      }),
    )

    expect(rows).toContainEqual({
      key: 'osm_source',
      labelKey: 'poiDetailsSource',
      value: 'way/123',
    })
    expect(rows).toContainEqual({
      key: 'capacity:disabled',
      labelKey: 'capacity:disabled',
      value: '0',
    })
    expect(rows).toContainEqual({
      key: 'unknown_tag',
      labelKey: 'unknown_tag',
      value: 'valeur brute',
    })
    expect(rows).not.toContainEqual({
      key: 'website',
      labelKey: 'website',
      value: 'https://example.org',
    })
  })
})
