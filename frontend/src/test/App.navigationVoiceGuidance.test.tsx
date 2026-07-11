import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { appPreferencesStorageKey } from '../features/data/dataPortability'
import {
  resetAppTestEnvironment,
  saveRouteResultToStorage,
  setDesktopMatchMedia,
} from './app-test-utils'
import { renderWithProviders } from './test-utils'

const originalSynthesisDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
const originalUtteranceDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'SpeechSynthesisUtterance',
)

class AppSpeechSynthesisUtteranceMock extends EventTarget {
  text: string
  lang = ''
  voice: SpeechSynthesisVoice | null = null
  volume = 1
  rate = 1
  pitch = 1
  onstart: ((event: SpeechSynthesisEvent) => void) | null = null
  onend: ((event: SpeechSynthesisEvent) => void) | null = null
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null
  onpause: ((event: SpeechSynthesisEvent) => void) | null = null
  onresume: ((event: SpeechSynthesisEvent) => void) | null = null
  onmark: ((event: SpeechSynthesisEvent) => void) | null = null
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null

  constructor(text = '') {
    super()
    this.text = text
  }
}

const installSpeechSynthesisMock = () => {
  const spoken: AppSpeechSynthesisUtteranceMock[] = []
  const synthesis = Object.assign(new EventTarget(), {
    paused: false,
    pending: false,
    speaking: false,
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance as AppSpeechSynthesisUtteranceMock)
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    onvoiceschanged: null,
  })

  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: AppSpeechSynthesisUtteranceMock,
  })
  return { synthesis, spoken }
}

const restoreWindowProperty = (
  property: 'speechSynthesis' | 'SpeechSynthesisUtterance',
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(window, property, descriptor)
  } else {
    Reflect.deleteProperty(window, property)
  }
}

beforeEach(() => resetAppTestEnvironment())

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  restoreWindowProperty('speechSynthesis', originalSynthesisDescriptor)
  restoreWindowProperty('SpeechSynthesisUtterance', originalUtteranceDescriptor)
})

describe('guidage vocal intégré', () => {
  it('persiste et exécute les instructions pendant une navigation simulée', async () => {
    const user = userEvent.setup()
    const speech = installSpeechSynthesisMock()
    setDesktopMatchMedia()
    window.location.hash = '/carte'
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.3522, 48.862],
        ],
      },
      distance_m: 600,
      duration_s_engine: 144,
      eta_s: 144,
      turn_by_turn: [
        { instruction: 'Prendre la rue A', distance_m: 100, duration_s: 24, type: 1 },
        { instruction: 'Continuer sur la rue B', distance_m: 200, duration_s: 48, type: 2 },
        { instruction: 'Rejoindre la rue C', distance_m: 300, duration_s: 72, type: 3 },
      ],
      elevation_profile: [],
    })

    renderWithProviders(<App />)
    await user.click(await screen.findByTestId('nav-setup-open'))
    await user.click(screen.getByText('Simulation'))
    await user.click(screen.getByRole('checkbox', { name: 'Guidage vocal' }))
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(appPreferencesStorageKey) ?? '{}') as {
        voiceGuidanceEnabled?: boolean
      }
      expect(stored.voiceGuidanceEnabled).toBe(true)
    })

    vi.useFakeTimers()
    fireEvent.click(screen.getByTestId('nav-start'))
    expect(speech.spoken[0].text).toBe('Dans 100 mètres, Continuer sur la rue B')
    expect(speech.spoken[0].text).not.toContain('Prendre la rue A')
    expect(screen.getByTestId('navigation-voice-status')).toHaveTextContent('Guidage vocal actif')

    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent(
      'Continuer sur la rue B',
    )
    expect(speech.spoken.at(-1)?.text).toContain('Rejoindre la rue C')
    expect(speech.spoken.at(-1)?.text).not.toContain('Continuer sur la rue B')
    expect(
      speech.spoken.some(
        (utterance) => utterance.text === 'Dans 200 mètres, Continuer sur la rue B',
      ),
    ).toBe(false)

    fireEvent.click(screen.getByTestId('nav-exit'))
    expect(speech.synthesis.cancel).toHaveBeenCalled()
  })
})
