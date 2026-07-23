import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  isAlternativeLoading: false,
  alternativeCount: 0,
  isAlternativeComparisonActive: false,
  isExporting: false,
  exportError: null,
  routeErrorMessage: null,
  onOpenAlternativeComparison: vi.fn(),
  onOpenNavigationSetup: vi.fn(),
  onExportRoute: vi.fn(),
  onOpenSaveTripDialog: vi.fn(),
}

const renderPanel = (props: Partial<MapSummaryPanelProps> = {}) =>
  renderWithProviders(<MapSummaryPanel {...baseProps} {...props} />)

describe('MapSummaryPanel roadbook', () => {
  it('affiche uniquement le compteur des alternatives distinctes', () => {
    renderPanel({ alternativeCount: 1 })

    const button = screen.getByRole('button', { name: 'Consulter 1 alternative' })

    expect(button).toHaveTextContent(/^1$/)
    expect(button).not.toHaveAttribute('data-unavailable')
  })

  it('conserve le compteur inactif et explique l’absence d’alternative', async () => {
    const user = userEvent.setup()
    const onOpenAlternativeComparison = vi.fn()

    renderPanel({ alternativeCount: 0, onOpenAlternativeComparison })

    const button = screen.getByRole('button', {
      name: 'Aucune alternative disponible pour ce trajet.',
    })
    expect(button).toHaveTextContent(/^0$/)
    expect(button).toHaveAttribute('data-unavailable', 'true')

    await user.click(button)

    expect(onOpenAlternativeComparison).not.toHaveBeenCalled()
    expect(await screen.findByText('Aucune alternative disponible pour ce trajet.')).toBeVisible()
  })

  it('propose les formats GPX et TCX depuis le bouton d’export', async () => {
    const user = userEvent.setup()
    const onExportRoute = vi.fn()

    renderPanel({ onExportRoute })

    await user.click(screen.getByRole('button', { name: 'Exporter le trajet' }))
    expect(await screen.findByText('Format du fichier')).toBeVisible()

    await user.click(screen.getByText('TCX'))
    expect(onExportRoute).toHaveBeenCalledWith('tcx')
  })

  it('affiche les instructions dans le bon ordre avec distance et durée', async () => {
    const user = userEvent.setup()

    renderPanel({
      alternativeCount: 1,
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

    const roadbookButton = screen.getByRole('button', { name: 'Feuille de route' })
    expect(roadbookButton).toBeInTheDocument()
    expect(roadbookButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(roadbookButton)

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

  it('affiche un fallback si les instructions présentes ne sont pas exploitables', async () => {
    const user = userEvent.setup()

    renderPanel({
      routeResult: {
        ...baseRoute,
        turn_by_turn: [{} as never],
      },
    })

    await user.click(screen.getByRole('button', { name: 'Feuille de route' }))

    expect(screen.getByText('Aucune instruction disponible.')).toBeInTheDocument()
  })

  it('borne une longue feuille de route et garde les actions accessibles', async () => {
    const user = userEvent.setup()
    const steps = Array.from({ length: 40 }, (_, index) => ({
      instruction: `Instruction longue ${index + 1}`,
      distance_m: 100 + index,
      duration_s: 60 + index,
      type: 8,
    }))

    renderPanel({
      alternativeCount: 1,
      routeResult: {
        ...baseRoute,
        turn_by_turn: steps,
      },
    })

    const roadbookButton = screen.getByRole('button', { name: 'Feuille de route' })
    expect(roadbookButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Consulter 1 alternative' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suivi / Simu GPS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter le trajet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder ce trajet' })).toBeInTheDocument()

    await user.click(roadbookButton)

    expect(roadbookButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Instruction longue 1')).toBeInTheDocument()
    expect(screen.getByText('Instruction longue 40')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(40)
    expect(screen.getByTestId('roadbook-steps-scroll')).toHaveStyle({
      maxHeight: 'min(32dvh, 280px)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    })
    expect(screen.getByRole('button', { name: 'Consulter 1 alternative' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suivi / Simu GPS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter le trajet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder ce trajet' })).toBeInTheDocument()

    await user.click(roadbookButton)

    expect(roadbookButton).toHaveAttribute('aria-expanded', 'false')
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
