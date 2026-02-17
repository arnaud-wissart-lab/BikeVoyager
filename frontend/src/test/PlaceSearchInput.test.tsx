import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import PlaceSearchInput, { type PlaceCandidate } from '../components/PlaceSearchInput'
import { createJsonResponse, renderWithProviders } from './test-utils'

function PlaceSearchInputHarness({
  onPlaceSelect,
}: {
  onPlaceSelect: (place: PlaceCandidate | null) => void
}) {
  const [value, setValue] = useState('')

  return (
    <PlaceSearchInput
      label="Detour"
      value={value}
      onValueChange={setValue}
      onPlaceSelect={onPlaceSelect}
      testId="detour"
    />
  )
}

describe('PlaceSearchInput', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('selectionne le bon candidat quand plusieurs resultats ont le meme libelle', async () => {
    const user = userEvent.setup()
    const duplicateLabel = '31 Rue de la Place 12345 Ville'
    const candidates: PlaceCandidate[] = [
      {
        label: duplicateLabel,
        lat: 48.111111,
        lon: 2.222222,
        score: 0.96,
        source: 'test',
      },
      {
        label: duplicateLabel,
        lat: 48.333333,
        lon: 2.444444,
        score: 0.95,
        source: 'test',
      },
    ]

    const fetchMock = vi.fn(async () => ({
      ...createJsonResponse(candidates),
    })) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchMock)

    let selected: PlaceCandidate | null = null

    renderWithProviders(
      <PlaceSearchInputHarness
        onPlaceSelect={(place) => {
          selected = place
        }}
      />,
    )

    await user.type(screen.getByTestId('detour-input'), '31 rue de la place')
    await user.click(await screen.findByTestId('detour-option-1'))

    expect(selected).not.toBeNull()
    expect(selected?.lat).toBeCloseTo(48.333333, 6)
    expect(selected?.lon).toBeCloseTo(2.444444, 6)
    expect(screen.getByTestId('detour-input')).toHaveValue(duplicateLabel)
  })
})
