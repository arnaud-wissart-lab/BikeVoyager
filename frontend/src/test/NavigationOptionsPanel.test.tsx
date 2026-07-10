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
})
