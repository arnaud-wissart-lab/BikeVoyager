import { act, cleanup, renderHook } from '@testing-library/react'
import type { NavigationGuidance } from '../features/routing/domain'
import {
  useNavigationVoiceGuidance,
  type UseNavigationVoiceGuidanceParams,
} from '../features/map/useNavigationVoiceGuidance'

class FakeSpeechSynthesisUtterance extends EventTarget {
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

const voice = (lang: string, name = lang): SpeechSynthesisVoice => ({
  default: false,
  lang,
  localService: true,
  name,
  voiceURI: name,
})

const originalSynthesisDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
const originalUtteranceDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'SpeechSynthesisUtterance',
)
const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')

const restoreProperty = (
  target: Window | Document,
  property: 'speechSynthesis' | 'SpeechSynthesisUtterance' | 'visibilityState',
  descriptor: PropertyDescriptor | undefined,
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    Reflect.deleteProperty(target, property)
  }
}

const installSpeechSynthesis = (initialVoices: SpeechSynthesisVoice[] = []) => {
  let voices = initialVoices
  const spoken: FakeSpeechSynthesisUtterance[] = []
  const synthesis = Object.assign(new EventTarget(), {
    paused: false,
    pending: false,
    speaking: false,
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance as FakeSpeechSynthesisUtterance)
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices),
    onvoiceschanged: null,
  })

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synthesis,
  })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeSpeechSynthesisUtterance,
  })

  return {
    synthesis,
    spoken,
    setVoices(nextVoices: SpeechSynthesisVoice[]) {
      voices = nextVoices
      synthesis.dispatchEvent(new Event('voiceschanged'))
    },
  }
}

const guidance = (distanceToManeuverMeters: number, activeStepIndex = 0): NavigationGuidance => ({
  activeStepIndex,
  activeInstruction: `Instruction ${activeStepIndex}`,
  distanceToManeuverMeters,
  nextInstruction: null,
  isArrival: false,
})

const defaultParams: UseNavigationVoiceGuidanceParams = {
  enabled: true,
  isNavigationActive: true,
  guidance: guidance(200),
  routeSessionKey: 1,
  language: 'fr',
  suspended: false,
}

const renderVoiceHook = (params: Partial<UseNavigationVoiceGuidanceParams> = {}) =>
  renderHook((props: UseNavigationVoiceGuidanceParams) => useNavigationVoiceGuidance(props), {
    initialProps: { ...defaultParams, ...params },
  })

afterEach(() => {
  cleanup()
  restoreProperty(window, 'speechSynthesis', originalSynthesisDescriptor)
  restoreProperty(window, 'SpeechSynthesisUtterance', originalUtteranceDescriptor)
  restoreProperty(document, 'visibilityState', originalVisibilityDescriptor)
  vi.restoreAllMocks()
})

describe('useNavigationVoiceGuidance', () => {
  it('signale une API absente sans lever d’exception', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    Reflect.deleteProperty(window, 'SpeechSynthesisUtterance')

    const { result } = renderVoiceHook()

    expect(result.current.supportStatus).toBe('unsupported')
    expect(result.current.error).toBeNull()
  })

  it('signale une API incomplète ou un constructeur défaillant', () => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: vi.fn() },
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FakeSpeechSynthesisUtterance,
    })
    const incomplete = renderVoiceHook()
    expect(incomplete.result.current.supportStatus).toBe('unsupported')
    incomplete.unmount()

    const speech = installSpeechSynthesis()
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        constructor() {
          throw new Error('Constructeur indisponible')
        }
      },
    })
    const broken = renderVoiceHook()
    expect(broken.result.current.supportStatus).toBe('error')
    expect(speech.synthesis.speak).not.toHaveBeenCalled()
  })

  it('reste silencieux si l’option est désactivée ou la navigation inactive', () => {
    const { synthesis } = installSpeechSynthesis()
    const disabled = renderVoiceHook({ enabled: false })
    expect(synthesis.speak).not.toHaveBeenCalled()
    disabled.unmount()

    renderVoiceHook({ isNavigationActive: false, routeSessionKey: null })
    expect(synthesis.speak).not.toHaveBeenCalled()
  })

  it('annonce la première instruction sans répéter la même bande', () => {
    const { synthesis, spoken } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0].text).toBe('Dans 200 mètres, Instruction 0')

    rerender({ ...defaultParams, guidance: guidance(190) })
    rerender({ ...defaultParams, guidance: guidance(150) })
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
  })

  it('suit les événements start et end de l’utterance courante', () => {
    const { spoken } = installSpeechSynthesis()
    const { result } = renderVoiceHook()

    act(() => spoken[0].onstart?.({} as SpeechSynthesisEvent))
    expect(result.current.isSpeaking).toBe(true)

    act(() => spoken[0].onend?.({} as SpeechSynthesisEvent))
    expect(result.current.isSpeaking).toBe(false)
  })

  it('annonce near puis uniquement immediate lors d’un saut de bandes', () => {
    const { synthesis, spoken } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, guidance: guidance(75) })
    expect(spoken.at(-1)?.text).toBe('Dans 75 mètres, Instruction 0')

    rerender({ ...defaultParams, guidance: guidance(10) })
    expect(spoken.at(-1)?.text).toBe('Instruction 0')
    expect(synthesis.speak).toHaveBeenCalledTimes(3)
  })

  it('saute directement vers immediate sans annoncer near rétroactivement', () => {
    const { synthesis, spoken } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, guidance: guidance(10) })

    expect(synthesis.speak).toHaveBeenCalledTimes(2)
    expect(spoken.map((utterance) => utterance.text)).toEqual([
      'Dans 200 mètres, Instruction 0',
      'Instruction 0',
    ])
  })

  it('annonce une nouvelle étape et l’arrivée une seule fois', () => {
    const { synthesis, spoken } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, guidance: guidance(120, 1) })
    const arrival = { ...guidance(0, 1), isArrival: true }
    rerender({ ...defaultParams, guidance: arrival })
    rerender({ ...defaultParams, guidance: arrival })

    expect(synthesis.speak).toHaveBeenCalledTimes(3)
    expect(spoken.at(-1)?.text).toBe('Vous êtes arrivé.')
  })

  it('annule immédiatement à la désactivation et à la sortie', () => {
    const { synthesis } = installSpeechSynthesis()
    const { rerender, unmount } = renderVoiceHook()

    rerender({ ...defaultParams, enabled: false })
    expect(synthesis.cancel).toHaveBeenCalledTimes(1)

    rerender({ ...defaultParams, routeSessionKey: 2 })
    expect(synthesis.speak).toHaveBeenCalledTimes(2)

    rerender({ ...defaultParams, isNavigationActive: false, routeSessionKey: null })
    expect(synthesis.cancel).toHaveBeenCalledTimes(2)

    unmount()
    expect(synthesis.cancel).toHaveBeenCalledTimes(2)
  })

  it('annule une annonce active au démontage', () => {
    const { synthesis } = installSpeechSynthesis()
    const { unmount } = renderVoiceHook()

    unmount()

    expect(synthesis.cancel).toHaveBeenCalledTimes(1)
  })

  it('reste silencieux hors itinéraire, en dismissed et pendant un recalcul', () => {
    const { synthesis } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, guidance: guidance(75), suspended: true })
    rerender({ ...defaultParams, guidance: guidance(50), suspended: true })
    rerender({ ...defaultParams, guidance: guidance(30), suspended: true })

    expect(synthesis.speak).toHaveBeenCalledTimes(1)
    expect(synthesis.cancel).toHaveBeenCalledTimes(1)
  })

  it('reprend sans rejouer les annonces accumulées pendant la suspension', () => {
    const { synthesis, spoken } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, guidance: guidance(60), suspended: true })
    rerender({ ...defaultParams, guidance: guidance(50), suspended: false })
    expect(synthesis.speak).toHaveBeenCalledTimes(1)

    rerender({ ...defaultParams, guidance: guidance(10), suspended: false })
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
    expect(spoken.at(-1)?.text).toBe('Instruction 0')
  })

  it('réinitialise la déduplication pour un nouveau trajet', () => {
    const { synthesis } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, routeSessionKey: 2 })

    expect(synthesis.speak).toHaveBeenCalledTimes(2)
    expect(synthesis.cancel).toHaveBeenCalledTimes(1)
  })

  it('annonce le nouveau trajet apparu pendant un recalcul suspendu', () => {
    const { synthesis } = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    rerender({ ...defaultParams, routeSessionKey: 2, guidance: guidance(150, 0), suspended: true })
    expect(synthesis.speak).toHaveBeenCalledTimes(1)

    rerender({ ...defaultParams, routeSessionKey: 2, guidance: guidance(150, 0) })
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
  })

  it('ignore les événements d’une ancienne utterance', () => {
    const { spoken } = installSpeechSynthesis()
    const { result, rerender } = renderVoiceHook()
    const oldUtterance = spoken[0]

    rerender({ ...defaultParams, guidance: guidance(120, 1) })
    act(() => {
      oldUtterance.onerror?.({ error: 'network' } as SpeechSynthesisErrorEvent)
    })

    expect(result.current.supportStatus).toBe('supported')
    expect(result.current.error).toBeNull()
  })

  it('expose une erreur non bloquante sans nouvelle tentative en boucle', () => {
    const { synthesis } = installSpeechSynthesis()
    synthesis.speak.mockImplementation(() => {
      throw new Error('Moteur vocal indisponible')
    })

    const { result, rerender } = renderVoiceHook()
    expect(result.current.supportStatus).toBe('error')
    expect(result.current.error).toBe('Moteur vocal indisponible')

    rerender({ ...defaultParams, guidance: guidance(75) })
    expect(synthesis.speak).toHaveBeenCalledTimes(1)
  })

  it('sélectionne une voix correspondant à la langue', () => {
    const englishVoice = voice('en-US', 'English')
    const frenchVoice = voice('fr-FR', 'Français')
    const { spoken } = installSpeechSynthesis([englishVoice, frenchVoice])

    renderVoiceHook({ language: 'fr' })

    expect(spoken[0].lang).toBe('fr-FR')
    expect(spoken[0].voice).toBe(frenchVoice)
  })

  it('prend en compte voiceschanged lorsque les voix arrivent plus tard', () => {
    const frenchVoice = voice('fr-CA', 'Français Canada')
    const speech = installSpeechSynthesis()
    const { rerender } = renderVoiceHook()

    act(() => speech.setVoices([frenchVoice]))
    rerender({ ...defaultParams, guidance: guidance(120, 1) })

    expect(speech.spoken.at(-1)?.voice).toBe(frenchVoice)
  })

  it('annule la parole lorsque la page passe en arrière-plan', () => {
    const { synthesis } = installSpeechSynthesis()
    renderVoiceHook()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(synthesis.cancel).toHaveBeenCalledTimes(1)
  })
})
