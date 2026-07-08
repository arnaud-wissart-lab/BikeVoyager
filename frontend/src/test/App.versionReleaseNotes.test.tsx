import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { appDisplayName, appVersion } from '../features/app/versionInfo'
import ReleaseNotesDialog from '../ui/app/ReleaseNotesDialog'
import { createAppFetchMock, resetAppTestEnvironment } from './app-test-utils'
import { renderWithProviders } from './test-utils'

describe('App version et nouveautés', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    window.location.hash = '/aide'
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  it('affiche la version et ouvre les nouveautés depuis le badge', async () => {
    const user = userEvent.setup()

    renderWithProviders(<App />)

    expect(await screen.findByText(appDisplayName)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voir les nouveautés' }))

    const dialog = await screen.findByRole('dialog', { name: 'Nouveautés' })

    expect(within(dialog).getByText(`v${appVersion}`)).toBeInTheDocument()
    expect(
      within(dialog).getByText('Ouverture de Street View depuis un clic droit sur la carte.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Profil d’altitude avec D\+, D-, pente maximale/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Filtres POI avancés avec sauvegarde des préférences.'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer les nouveautés' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nouveautés' })).not.toBeInTheDocument()
    })
  })

  it('affiche un état vide quand aucune note de version n’est fournie', () => {
    renderWithProviders(
      <ReleaseNotesDialog opened onClose={() => {}} isDesktop isFrench releaseNotes={[]} />,
    )

    expect(screen.getByRole('dialog', { name: 'Nouveautés' })).toBeInTheDocument()
    expect(
      screen.getByText('Aucune note de version n’est disponible pour le moment.'),
    ).toBeInTheDocument()
  })
})
