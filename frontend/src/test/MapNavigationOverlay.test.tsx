import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MapNavigationOverlay from '../ui/pages/map/MapNavigationOverlay'
import { renderWithProviders } from './test-utils'

type MapNavigationOverlayProps = ComponentProps<typeof MapNavigationOverlay>

const guidance: NonNullable<MapNavigationOverlayProps['navigationGuidance']> = {
  activeStepIndex: 0,
  activeInstruction: 'Tourner à droite sur Rue X',
  distanceToManeuverMeters: 120,
  nextInstruction: 'Continuer sur Avenue Y',
  isArrival: false,
}

const baseProps: MapNavigationOverlayProps = {
  isNavigationActive: true,
  hasRoute: true,
  mapOverlayPadding: 12,
  surfaceColor: '#fff',
  onExitNavigation: vi.fn(),
  navigationMode: 'simulation',
  distanceLabel: '1.2 km',
  etaLabel: '5 min',
  navigationProgressPct: 20,
  navigationGuidance: guidance,
  wakeLockStatus: 'idle',
  navigationCameraMode: 'follow_3d',
  onNavigationCameraModeChange: vi.fn(),
  navigationError: null,
  activePoiAlert: null,
  getPoiDisplayName: () => '',
  poiCategoryLabels: {
    monuments: 'Monuments',
    paysages: 'Paysages',
    commerces: 'Commerces',
    services: 'Services',
  },
  onAddActivePoiAlertWaypoint: vi.fn(),
  onDismissPoiAlert: vi.fn(),
  isDesktop: true,
  chromeFooterHeight: 0,
}

const renderOverlay = (props: Partial<MapNavigationOverlayProps> = {}) =>
  renderWithProviders(<MapNavigationOverlay {...baseProps} {...props} />)

describe('MapNavigationOverlay', () => {
  it('affiche l’instruction active et la distance avant la manœuvre', () => {
    renderOverlay()

    expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent(
      'Tourner à droite sur Rue X',
    )
    expect(screen.getByTestId('navigation-distance-to-maneuver')).toHaveTextContent('Dans 120 m')
  })

  it('affiche l’instruction suivante', () => {
    renderOverlay()

    expect(screen.getByTestId('navigation-next-instruction')).toHaveTextContent(
      'Puis : Continuer sur Avenue Y',
    )
  })

  it('affiche un fallback quand la distance de manœuvre est indisponible', () => {
    renderOverlay({
      navigationGuidance: {
        ...guidance,
        distanceToManeuverMeters: null,
      },
    })

    expect(screen.getByTestId('navigation-distance-to-maneuver')).toHaveTextContent('Dans —')
  })

  it('masque uniquement la zone de guidage quand le modèle est absent', () => {
    renderOverlay({ navigationGuidance: null })

    expect(screen.queryByTestId('navigation-active-instruction')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigation-distance-to-maneuver')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigation-next-instruction')).not.toBeInTheDocument()
    expect(screen.getByText('Distance restante')).toBeInTheDocument()
    expect(screen.getByTestId('nav-exit')).toBeInTheDocument()
  })

  it('affiche l’arrivée sans instruction suivante', () => {
    renderOverlay({
      navigationGuidance: {
        ...guidance,
        activeStepIndex: 2,
        distanceToManeuverMeters: 0,
        nextInstruction: null,
        isArrival: true,
      },
    })

    expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent('Arrivée')
    expect(screen.getByTestId('navigation-distance-to-maneuver')).toHaveTextContent('Dans 0 m')
    expect(screen.queryByTestId('navigation-next-instruction')).not.toBeInTheDocument()
  })

  it('conserve les contrôles de sortie et de caméra', () => {
    renderOverlay()

    expect(screen.getByRole('button', { name: 'Quitter' })).toBeInTheDocument()
    expect(screen.getByText('Suivi 3D')).toBeInTheDocument()
    expect(screen.getByText('Panoramique 3D')).toBeInTheDocument()
    expect(screen.getByText('Plan 2D')).toBeInTheDocument()
  })

  it('affiche discrètement le maintien actif de l’écran', () => {
    renderOverlay({ wakeLockStatus: 'active' })

    expect(screen.getByTestId('navigation-wake-lock-status')).toHaveTextContent(
      'Écran maintenu allumé',
    )
    expect(screen.getByTestId('navigation-active-instruction')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitter' })).toBeInTheDocument()
  })

  it('affiche le fallback lorsque le maintien de l’écran est indisponible', () => {
    renderOverlay({ wakeLockStatus: 'unsupported' })

    expect(screen.getByTestId('navigation-wake-lock-status')).toHaveTextContent(
      'Maintien de l’écran indisponible',
    )
  })

  it('affiche le fallback lorsque le maintien de l’écran échoue', () => {
    renderOverlay({ wakeLockStatus: 'error' })

    expect(screen.getByTestId('navigation-wake-lock-status')).toHaveTextContent(
      'Impossible de maintenir l’écran allumé',
    )
  })

  it('ne montre aucun statut lorsque le maintien de l’écran est inactif', () => {
    renderOverlay({ wakeLockStatus: 'idle' })

    expect(screen.queryByTestId('navigation-wake-lock-status')).not.toBeInTheDocument()
  })
})
