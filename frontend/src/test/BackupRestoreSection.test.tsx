import { createRef } from 'react'
import { screen } from '@testing-library/react'
import BackupRestoreSection from '../ui/pages/data/BackupRestoreSection'
import { renderWithProviders } from './test-utils'

describe('BackupRestoreSection', () => {
  it('prévient que les données restent liées au navigateur courant', () => {
    renderWithProviders(
      <BackupRestoreSection
        isDesktop
        mobileActionButtonStyles={undefined}
        onExportBackup={vi.fn()}
        onImportData={vi.fn()}
        importInputRef={createRef<HTMLInputElement>()}
        onImportFileChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Stockage local à ce navigateur')).toBeInTheDocument()
    expect(
      screen.getByText(/Sans sauvegarde cloud configurée, ils ne seront pas disponibles/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sauvegarder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer un fichier' })).toBeInTheDocument()
  })
})
