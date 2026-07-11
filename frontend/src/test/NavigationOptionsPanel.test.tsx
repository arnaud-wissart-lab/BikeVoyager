import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import NavigationOptionsPanel from '../ui/pages/NavigationOptionsPanel'
import { renderWithProviders } from './test-utils'

type NavigationOptionsPanelProps = ComponentProps<typeof NavigationOptionsPanel>

const baseProps: NavigationOptionsPanelProps = {
  isCompact: false,
  navigationMode: 'gps',
  navigationCameraMode: 'follow_3d',
  simulationSpeedKmh: 16,
  automaticNavigationRecalculationEnabled: false,
  voiceGuidanceEnabled: false,
  voiceGuidanceSupportStatus: 'supported',
  poiAlertEnabled: false,
  poiAlertCategories: [],
  poiAlertDistanceMeters: 300,
  systemNotificationsEnabled: false,
  notificationsSupported: false,
  notificationsPermission: 'default',
  poiCategoryOptions: [],
  poiAlertDistanceRange: { min: 100, max: 2000, step: 100 },
  onNavigationModeChange: vi.fn(),
  onNavigationCameraModeChange: vi.fn(),
  onAutomaticNavigationRecalculationEnabledChange: vi.fn(),
  onVoiceGuidanceEnabledChange: vi.fn(),
  onPoiAlertEnabledChange: vi.fn(),
  onPoiAlertCategoryChange: vi.fn(),
  onPoiAlertDistanceMetersChange: vi.fn(),
  onSystemNotificationsChange: vi.fn().mockResolvedValue(undefined),
}

describe('NavigationOptionsPanel', () => {
  it('affiche et active l’option de guidage vocal supportée', async () => {
    const user = userEvent.setup()
    const onVoiceGuidanceEnabledChange = vi.fn()
    renderWithProviders(
      <NavigationOptionsPanel
        {...baseProps}
        onVoiceGuidanceEnabledChange={onVoiceGuidanceEnabledChange}
      />,
    )

    expect(
      screen.getByText('Annonce les prochaines instructions pendant la navigation.'),
    ).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Guidage vocal' }))
    expect(onVoiceGuidanceEnabledChange).toHaveBeenCalledWith(true)
  })

  it('désactive l’option et explique l’absence de support', () => {
    renderWithProviders(
      <NavigationOptionsPanel {...baseProps} voiceGuidanceSupportStatus="unsupported" />,
    )

    expect(screen.getByRole('checkbox', { name: 'Guidage vocal' })).toBeDisabled()
    expect(screen.getByText('Guidage vocal indisponible sur ce navigateur')).toBeVisible()
  })

  it('active le recalcul automatique en mode GPS avec une description accessible', async () => {
    const user = userEvent.setup()
    const onAutomaticNavigationRecalculationEnabledChange = vi.fn()
    renderWithProviders(
      <NavigationOptionsPanel
        {...baseProps}
        onAutomaticNavigationRecalculationEnabledChange={
          onAutomaticNavigationRecalculationEnabledChange
        }
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Recalcul automatique' })
    expect(checkbox).toBeEnabled()
    expect(checkbox).toHaveAccessibleDescription(
      'Recalcule le trajet après une sortie confirmée. Disponible uniquement en navigation GPS. Les trajets avec étapes intermédiaires ou détours restent manuels.',
    )

    await user.click(checkbox)
    expect(onAutomaticNavigationRecalculationEnabledChange).toHaveBeenCalledWith(true)
  })

  it('conserve mais désactive visuellement la préférence en simulation', () => {
    renderWithProviders(
      <NavigationOptionsPanel
        {...baseProps}
        navigationMode="simulation"
        automaticNavigationRecalculationEnabled
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Recalcul automatique' })
    expect(checkbox).toBeChecked()
    expect(checkbox).toBeDisabled()
  })
})
