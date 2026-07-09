import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import MapSummaryPanel from '../ui/pages/MapSummaryPanel'
import { renderWithProviders } from './test-utils'

type MapSummaryPanelProps = ComponentProps<typeof MapSummaryPanel>

const baseRoute: MapSummaryPanelProps['routeResult'] = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.36, 48.86],
    ],
  },
  distance_m: 1200,
  duration_s_engine: 300,
  eta_s: 300,
  turn_by_turn: [],
  elevation_profile: [],
}

const baseProps: MapSummaryPanelProps = {
  isCompact: false,
  routeResult: baseRoute,
  distanceLabel: '1.2 km',
  etaLabel: '5 min',
  overlapLabel: null,
  overlapHint: null,
  elevationGainLabel: '—',
  elevationLossLabel: '—',
  elevationRangeLabel: '—',
  maxSlopeLabel: null,
  routeDifficultyLabel: null,
  routeDifficultyHint: null,
  elevationHint: 'Altimétrie indisponible sur ce trajet.',
  elevationProfile: [],
  detourSummary: null,
  hasRoute: true,
  isRouteLoading: false,
  alternativeRouteLabel: 'Proposer un autre trajet',
  isExporting: false,
  exportError: null,
  routeErrorMessage: null,
  onRecalculateAlternative: vi.fn(),
  onOpenNavigationSetup: vi.fn(),
  onExportGpx: vi.fn(),
  onOpenSaveTripDialog: vi.fn(),
}

const renderPanel = (props: Partial<MapSummaryPanelProps> = {}) =>
  renderWithProviders(<MapSummaryPanel {...baseProps} {...props} />)

describe('MapSummaryPanel roadbook', () => {
  it('affiche les instructions dans le bon ordre avec distance et durée', () => {
    renderPanel({
      routeResult: {
        ...baseRoute,
        turn_by_turn: [
          {
            instruction: 'Tourner à droite sur Rue X',
            distance_m: 120,
            duration_s: 60,
            type: 10,
          },
          {
            instruction: 'Continuer sur Avenue Y',
            distance_m: 850,
            duration_s: 240,
            type: 8,
          },
        ],
      },
    })

    expect(screen.getByRole('button', { name: 'Feuille de route' })).toBeInTheDocument()

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Tourner à droite sur Rue X')).toBeInTheDocument()
    expect(within(items[0]).getByText('120 m')).toBeInTheDocument()
    expect(within(items[0]).getByText('1 min')).toBeInTheDocument()
    expect(within(items[1]).getByText('Continuer sur Avenue Y')).toBeInTheDocument()
    expect(within(items[1]).getByText('850 m')).toBeInTheDocument()
    expect(within(items[1]).getByText('4 min')).toBeInTheDocument()
  })

  it('masque la feuille de route quand la route ne contient aucune instruction', () => {
    renderPanel()

    expect(screen.queryByRole('button', { name: 'Feuille de route' })).not.toBeInTheDocument()
    expect(screen.queryByText('Étapes du trajet')).not.toBeInTheDocument()
  })

  it('affiche un fallback si les instructions présentes ne sont pas exploitables', () => {
    renderPanel({
      routeResult: {
        ...baseRoute,
        turn_by_turn: [{} as never],
      },
    })

    expect(screen.getByRole('button', { name: 'Feuille de route' })).toBeInTheDocument()
    expect(screen.getByText('Aucune instruction disponible.')).toBeInTheDocument()
  })

  it('ne crée pas d’étapes pour une boucle', () => {
    renderPanel({
      routeResult: {
        kind: 'loop',
        geometry: {
          type: 'LineString',
          coordinates: [
            [2.3522, 48.8566],
            [2.36, 48.86],
            [2.3522, 48.8566],
          ],
        },
        distance_m: 4000,
        eta_s: 900,
        overlapScore: 'faible',
        segmentsCount: 3,
        elevation_profile: [],
      },
      overlapLabel: 'faible',
    })

    expect(screen.queryByRole('button', { name: 'Feuille de route' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('Feuille de route indisponible pour cette boucle.')).toBeInTheDocument()
  })
})
