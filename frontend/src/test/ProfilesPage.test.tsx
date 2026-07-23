import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  areProfileSettingsEqual,
  defaultProfileCatalog,
  defaultProfileSettings,
  profilePresetId,
  profilePresets,
  type ProfileCatalog,
  type ProfilePresetKey,
  type ProfileSettings,
} from '../features/routing/domain'
import ProfilesPage from '../ui/pages/ProfilesPage'
import { renderWithProviders } from './test-utils'

type ProfilesPageHarnessProps = {
  initialSettings?: ProfileSettings
  initialCatalog?: ProfileCatalog
}

function ProfilesPageHarness({
  initialSettings = defaultProfileSettings,
  initialCatalog = defaultProfileCatalog,
}: ProfilesPageHarnessProps) {
  const [profileSettings, setProfileSettings] = useState(initialSettings)
  const [profileCatalog, setProfileCatalog] = useState<ProfileCatalog>(initialCatalog)

  const applyProfile = (profileId: string, settings: ProfileSettings) => {
    setProfileCatalog((current) => ({ ...current, activeProfileId: profileId }))
    setProfileSettings(settings)
  }

  const savePreset = (presetKey: ProfilePresetKey, settings: ProfileSettings) => {
    const preset = profilePresets.find((candidate) => candidate.key === presetKey)
    if (!preset) {
      return
    }

    setProfileCatalog((current) => {
      const presetOverrides = { ...current.presetOverrides }
      if (areProfileSettingsEqual(preset.settings, settings)) {
        delete presetOverrides[presetKey]
      } else {
        presetOverrides[presetKey] = settings
      }
      return {
        ...current,
        activeProfileId: profilePresetId(presetKey),
        presetOverrides,
      }
    })
    setProfileSettings(settings)
  }

  return (
    <ProfilesPage
      contentSize="xl"
      isDesktop
      profileSettings={profileSettings}
      profileCatalog={profileCatalog}
      onProfileApply={applyProfile}
      onPresetSave={savePreset}
      onCustomProfileCreate={(name, settings) => {
        const id = 'custom:test'
        setProfileCatalog((current) => ({
          ...current,
          activeProfileId: id,
          customProfiles: [...current.customProfiles, { id, name, settings }],
        }))
        setProfileSettings(settings)
      }}
      onCustomProfileUpdate={(profileId, name, settings) => {
        setProfileCatalog((current) => ({
          ...current,
          activeProfileId: profileId,
          customProfiles: current.customProfiles.map((profile) =>
            profile.id === profileId ? { ...profile, name, settings } : profile,
          ),
        }))
        setProfileSettings(settings)
      }}
      onCustomProfileDelete={(profileId) => {
        setProfileCatalog((current) => ({
          ...current,
          activeProfileId:
            current.activeProfileId === profileId
              ? profilePresetId('standard')
              : current.activeProfileId,
          customProfiles: current.customProfiles.filter((profile) => profile.id !== profileId),
        }))
        setProfileSettings(defaultProfileSettings)
      }}
    />
  )
}

describe('ProfilesPage', () => {
  it('affiche les profils sans exposer les réglages hors édition', () => {
    renderWithProviders(<ProfilesPageHarness />)

    expect(screen.getByText('Disponibles')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Balade tranquille')).toBeInTheDocument()
    expect(screen.getByText('Vélo équilibré')).toBeInTheDocument()
    expect(screen.getByText('Vélo efficace')).toBeInTheDocument()
    expect(screen.getByText('Vélo sportif')).toBeInTheDocument()
    expect(screen.getByText('VAE autonomie')).toBeInTheDocument()
    expect(screen.getByText('VAE confort')).toBeInTheDocument()
    expect(screen.getByText('VAE assistance forte')).toBeInTheDocument()
    expect(screen.getByText('Actuel : Standard')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer un profil' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Vitesse vélo')).not.toBeInTheDocument()
  })

  it('active un profil intégré sans ouvrir les réglages', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(
      within(screen.getByTestId('profile-preset-ebikeEco')).getByRole('button', {
        name: 'Utiliser',
      }),
    )

    expect(screen.getByText('Actuel : VAE autonomie')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('profile-preset-ebikeEco')).getByRole('button', {
        name: 'Actif',
      }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Vitesse VAE')).not.toBeInTheDocument()
  })

  it('modifie un profil intégré uniquement après validation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(screen.getByRole('button', { name: 'Modifier le profil Vélo efficace' }))

    const dialog = screen.getByRole('dialog', { name: 'Modifier Vélo efficace' })
    const bikeSpeedInput = within(dialog).getByLabelText('Vitesse vélo')
    await user.clear(bikeSpeedInput)
    await user.type(bikeSpeedInput, '21')

    expect(screen.getByText('Actuel : Standard')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('Actuel : Vélo efficace')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('profile-preset-efficient')).getByText('Modifié'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Vitesse vélo')).not.toBeInTheDocument()
  })

  it('crée puis supprime un profil personnel', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilesPageHarness />)

    await user.click(screen.getByRole('button', { name: 'Créer un profil' }))
    const editor = screen.getByRole('dialog', { name: 'Créer un profil' })
    await user.type(within(editor).getByRole('textbox', { name: /Nom du profil/ }), 'Vélotaf')
    await user.click(within(editor).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('Actuel : Vélotaf')).toBeInTheDocument()
    expect(screen.getByText('Vélotaf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer le profil Vélotaf' }))
    const confirmation = screen.getByRole('dialog', { name: 'Supprimer ce profil ?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Supprimer' }))

    expect(screen.queryByText('Vélotaf')).not.toBeInTheDocument()
    expect(screen.getByText('Actuel : Standard')).toBeInTheDocument()
  })
})
