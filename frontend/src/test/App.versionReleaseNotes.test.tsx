import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { releaseNotes } from '../features/app/releaseNotes'
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

  it('conserve un historique de versions cohérent et ordonné', () => {
    const versions = releaseNotes.map((note) => note.version)

    expect(appVersion).toBe('0.2.0')
    expect(releaseNotes[0]).toMatchObject({ version: appVersion, date: '2026-07-11' })
    expect(releaseNotes[1]).toMatchObject({ version: '0.1.0', date: '2026-07-08' })
    expect(versions).toEqual(['0.2.0', '0.1.0'])
    expect(new Set(versions).size).toBe(versions.length)
  })

  it('affiche la version et ouvre les nouveautés depuis le badge', async () => {
    const user = userEvent.setup()

    renderWithProviders(<App />)

    expect(await screen.findByText(appDisplayName)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voir les nouveautés' }))

    const dialog = await screen.findByRole('dialog', { name: 'Nouveautés' })

    expect(within(dialog).getByText('v0.2.0')).toBeInTheDocument()
    expect(within(dialog).getByText('11 juillet 2026')).toBeInTheDocument()
    expect(within(dialog).getByText('v0.1.0')).toBeInTheDocument()
    expect(within(dialog).getByText('8 juillet 2026')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Feuille de route détaillée avec les différentes étapes du trajet.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Ouverture de Street View depuis un clic droit sur la carte.'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer les nouveautés' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Nouveautés' })).not.toBeInTheDocument()
    })
  })

  it('affiche les notes de la version 0.2.0 en anglais', () => {
    renderWithProviders(<ReleaseNotesDialog opened onClose={() => {}} isDesktop isFrench={false} />)

    const dialog = screen.getByRole('dialog', { name: 'Nouveautés' })

    expect(within(dialog).getByText('On-the-road navigation')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Detailed roadbook with each step of the journey.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('July 11, 2026')).toBeInTheDocument()
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
