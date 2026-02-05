import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import '../i18n'
import App from '../App'
import { theme } from '../theme'

describe('App', () => {
  it('affiche le nom du produit', () => {
    render(
      <MantineProvider theme={theme} defaultColorScheme="light">
        <App />
      </MantineProvider>,
    )

    expect(screen.getByText('BikeVoyager')).toBeInTheDocument()
  })
})
