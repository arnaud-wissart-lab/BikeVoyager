import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  navigationOffRouteAlert: null,
  navigationRecalculationSuccessMessage: null,
  onRecalculateFromCurrentPosition: vi.fn(),
  onDismissNavigationDeviation: vi.fn(),
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

  it('affiche un avertissement compact sans masquer le guidage et les contrôles', () => {
    renderOverlay({
      navigationMode: 'gps',
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: false,
        isRecalculating: false,
        unavailableMessage: null,
        errorMessage: null,
      },
    })

    expect(screen.getByTestId('navigation-off-route-alert')).toBeInTheDocument()
    expect(screen.getByTestId('navigation-off-route-distance')).toHaveTextContent(
      'Écart estimé : environ 75 m',
    )
    expect(screen.getByTestId('navigation-active-instruction')).toBeInTheDocument()
    expect(screen.getByTestId('nav-exit')).toBeInTheDocument()
    expect(screen.getByText('Suivi 3D')).toBeInTheDocument()
  })

  it('déclenche le recalcul et permet de continuer sans recalcul', async () => {
    const user = userEvent.setup()
    const onRecalculateFromCurrentPosition = vi.fn()
    const onDismissNavigationDeviation = vi.fn()
    renderOverlay({
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: false,
        isRecalculating: false,
        unavailableMessage: null,
        errorMessage: null,
      },
      onRecalculateFromCurrentPosition,
      onDismissNavigationDeviation,
    })

    await user.click(screen.getByTestId('navigation-recalculate-from-position'))
    await user.click(screen.getByTestId('navigation-dismiss-off-route'))

    expect(onRecalculateFromCurrentPosition).toHaveBeenCalledTimes(1)
    expect(onDismissNavigationDeviation).toHaveBeenCalledTimes(1)
  })

  it('désactive le recalcul et affiche son état de chargement', () => {
    renderOverlay({
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: true,
        isRecalculating: true,
        unavailableMessage: null,
        errorMessage: null,
      },
    })

    expect(screen.getByTestId('navigation-recalculate-from-position')).toBeDisabled()
    expect(screen.getByTestId('navigation-recalculate-from-position')).toHaveTextContent(
      'Recalcul en cours…',
    )
  })

  it('affiche une erreur de recalcul non bloquante', () => {
    renderOverlay({
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: false,
        isRecalculating: false,
        unavailableMessage: null,
        errorMessage: 'Impossible de recalculer l’itinéraire',
      },
    })

    expect(screen.getByText('Impossible de recalculer l’itinéraire')).toBeInTheDocument()
    expect(screen.getByTestId('navigation-recalculate-from-position')).toBeEnabled()
    expect(screen.getByTestId('nav-exit')).toBeEnabled()
  })

  it('masque le recalcul de boucle tout en permettant de continuer', () => {
    renderOverlay({
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: false,
        isRecalculateDisabled: true,
        isRecalculating: false,
        unavailableMessage: 'Le recalcul des boucles n’est pas encore disponible',
        errorMessage: null,
      },
    })

    expect(screen.queryByTestId('navigation-recalculate-from-position')).not.toBeInTheDocument()
    expect(screen.getByText('Le recalcul des boucles n’est pas encore disponible')).toBeVisible()
    expect(screen.getByTestId('navigation-dismiss-off-route')).toBeEnabled()
  })

  it('désactive le recalcul avec étapes sans les abandonner silencieusement', () => {
    renderOverlay({
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: true,
        isRecalculating: false,
        unavailableMessage: 'Le recalcul avec des étapes intermédiaires n’est pas disponible',
        errorMessage: null,
      },
    })

    expect(screen.getByTestId('navigation-recalculate-from-position')).toBeDisabled()
    expect(
      screen.getByText('Le recalcul avec des étapes intermédiaires n’est pas disponible'),
    ).toBeVisible()
    expect(screen.getByTestId('navigation-dismiss-off-route')).toBeEnabled()
  })

  it('n’affiche aucun avertissement lorsque la navigation est inactive', () => {
    renderOverlay({
      isNavigationActive: false,
      navigationOffRouteAlert: {
        distanceLabel: '75 m',
        showRecalculateAction: true,
        isRecalculateDisabled: false,
        isRecalculating: false,
        unavailableMessage: null,
        errorMessage: null,
      },
    })

    expect(screen.queryByTestId('navigation-off-route-alert')).not.toBeInTheDocument()
  })
})
