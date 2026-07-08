import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MapPoiDetailsOverlay from '../ui/pages/map/MapPoiDetailsOverlay'
import { renderWithProviders } from './test-utils'
import type { PoiItem } from '../features/routing/domain'

const selectedPoi: PoiItem = {
  id: 'poi-1',
  name: 'Parking de la gare',
  lat: 48.8566,
  lon: 2.3522,
  category: 'services',
  kind: 'amenity:parking',
  distance_m: 1200,
  distance_to_route_m: 80,
  osm_type: 'way',
  osm_id: 123,
  tags: {
    capacity: '60',
    'capacity:disabled': '0',
    lit: 'yes',
    surface: 'asphalt',
    unknown_tag: 'valeur brute',
  },
}

const renderOverlay = () =>
  renderWithProviders(
    <MapPoiDetailsOverlay
      isOpen
      selectedPoi={selectedPoi}
      isNavigationActive={false}
      mapOverlayPadding={12}
      isDesktop
      surfaceColor="#fff"
      selectedPoiDisplayName="Parking de la gare"
      selectedPoiCategoryLabel="Services"
      selectedPoiKind="Service • parking"
      onZoomOutPoi={vi.fn()}
      onZoomInPoi={vi.fn()}
      isRouteLoading={false}
      isMobilePoiDetailsExpanded
      onToggleMobilePoiDetails={vi.fn()}
      onClosePoiModal={vi.fn()}
      poiDetourIds={new Set()}
      onAddSelectedPoiWaypoint={vi.fn()}
      formatDistance={(distance) => (distance === null ? '—' : `${distance} m`)}
      formatCoordinate={(coordinate) => coordinate.toFixed(4)}
      selectedPoiUsefulRows={[
        { key: 'capacity', labelKey: 'poiDetailsLabelCapacity', value: '60 places' },
        { key: 'lit', labelKey: 'poiDetailsLabelLit', value: 'oui' },
        { key: 'surface', labelKey: 'poiDetailsLabelSurface', value: 'asphalte' },
      ]}
      selectedPoiExternalLinks={[
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
      ]}
      selectedPoiTechnicalRows={[
        { key: 'osm_source', labelKey: 'poiDetailsSource', value: 'way/123' },
        { key: 'capacity:disabled', labelKey: 'capacity:disabled', value: '0' },
        { key: 'unknown_tag', labelKey: 'unknown_tag', value: 'valeur brute' },
      ]}
      mobilePoiPanelTransition="none"
    />,
  )

describe('MapPoiDetailsOverlay', () => {
  it('affiche les informations utiles et garde les données techniques repliées', () => {
    renderOverlay()

    expect(screen.getByText('Informations utiles')).toBeInTheDocument()
    expect(screen.getByText('Capacité')).toBeInTheDocument()
    expect(screen.getByText('60 places')).toBeInTheDocument()
    expect(screen.getByText('Éclairé')).toBeInTheDocument()
    expect(screen.getByText('oui')).toBeInTheDocument()
    expect(screen.getByText('Revêtement')).toBeInTheDocument()
    expect(screen.getByText('asphalte')).toBeInTheDocument()
    expect(screen.queryByText('Places PMR')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Site web' })).toHaveAttribute(
      'href',
      'https://example.org/',
    )
    expect(screen.getByRole('link', { name: 'Wikipédia' })).toHaveAttribute(
      'href',
      'https://fr.wikipedia.org/wiki/Quelque_chose',
    )
    expect(screen.getByRole('link', { name: 'Wikidata' })).toHaveAttribute(
      'href',
      'https://www.wikidata.org/wiki/Q123',
    )
    expect(screen.getByRole('link', { name: 'Voir sur OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/way/123',
    )

    const summary = screen.getByText('Données techniques OSM')
    const details = summary.closest('details')
    expect(details).not.toHaveAttribute('open')

    fireEvent.click(summary)

    expect(details).toHaveAttribute('open')
    expect(screen.getByText('capacity:disabled')).toBeInTheDocument()
    expect(screen.getByText('unknown_tag')).toBeInTheDocument()
    expect(screen.getByText('valeur brute')).toBeInTheDocument()
  })
})
