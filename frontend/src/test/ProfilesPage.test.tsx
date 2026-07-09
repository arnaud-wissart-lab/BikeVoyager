import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ProfilesPage from '../ui/pages/ProfilesPage'
import {
  defaultProfileSettings,
  type AssistLevel,
  type Mode,
  type ProfileSettings,
} from '../features/routing/domain'
import { renderWithProviders } from './test-utils'

type ProfilesPageHarnessProps = {
  initialSettings?: ProfileSettings
}

function ProfilesPageHarness({
  initialSettings = defaultProfileSettings,
}: ProfilesPageHarnessProps) {
  const [profileSettings, setProfileSettings] = useState(initialSettings)

  const handleSpeedChange = (targetMode: Mode, value: number | '') => {
    if (value === '') {
      return
    }

    setProfileSettings((current) => ({
      ...current,
      speeds: {
        ...current.speeds,
        [targetMode]: value,
      },
    }))
  }

  const handleAssistChange = (value: AssistLevel) => {
    setProfileSettings((current) => ({
      ...current,
      ebikeAssist: value,
    }))
  }

  return (
    <ProfilesPage
      contentSize="xl"
      isDesktop
      profileSettings={profileSettings}
      onSpeedChange={handleSpeedChange}
      onAssistChange={handleAssistChange}
      onPresetApply={setProfileSettings}
      onReset={() => setProfileSettings(defaultProfileSettings)}
    />
  )
}

describe('ProfilesPage', () => {
  it('affiche les préréglages de profils', () => {
    renderWithProviders(<ProfilesPageHarness />)

    expect(screen.getByText('Préréglages')).toBeInTheDocument()
    expect(screen.getByText('Balade tranquille')).toBeInTheDocument()
    expect(screen.getByText('Vélo équilibré')).toBeInTheDocument()
    expect(screen.getByText('Vélo efficace')).toBeInTheDocument()
    expect(screen.getByText('Vélo sportif')).toBeInTheDocument()
    expect(screen.getByText('VAE autonomie')).toBeInTheDocument()
    expect(screen.getByText('VAE confort')).toBeInTheDocument()
    expect(screen.getByText('VAE assistance forte')).toBeInTheDocument()
  })

  it('applique le préréglage VAE autonomie', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(
      within(screen.getByTestId('profile-preset-ebikeEco')).getByRole('button', {
        name: 'Appliquer',
      }),
    )

    expect(screen.getByLabelText('Vitesse VAE')).toHaveValue('20')
    expect(screen.getByText('Préréglage actif')).toBeInTheDocument()
    expect(screen.getByLabelText('Faible')).toBeChecked()
  })

  it('applique le préréglage Vélo efficace', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(
      within(screen.getByTestId('profile-preset-efficient')).getByRole('button', {
        name: 'Appliquer',
      }),
    )

    expect(screen.getByLabelText('Vitesse marche')).toHaveValue('5.5')
    expect(screen.getByLabelText('Vitesse vélo')).toHaveValue('20')
    expect(screen.getByLabelText('Vitesse VAE')).toHaveValue('25')
    expect(screen.getByLabelText('Moyen')).toBeChecked()
  })

  it('retire le badge actif après une modification manuelle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(
      within(screen.getByTestId('profile-preset-ebikeEco')).getByRole('button', {
        name: 'Appliquer',
      }),
    )
    expect(screen.getByText('Préréglage actif')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Vitesse VAE'))
    await user.type(screen.getByLabelText('Vitesse VAE'), '21')

    expect(screen.queryByText('Préréglage actif')).not.toBeInTheDocument()
  })
})
