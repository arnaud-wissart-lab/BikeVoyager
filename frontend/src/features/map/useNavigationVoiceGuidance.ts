import { useCallback, useEffect, useRef, useState } from 'react'
import i18n from '../../i18n'
import {
  createNavigationVoiceAnnouncement,
  type NavigationGuidance,
  type NavigationVoiceLanguage,
} from '../routing/domain'

export type VoiceGuidanceSupportStatus = 'supported' | 'unsupported' | 'error'

export type UseNavigationVoiceGuidanceParams = {
  enabled: boolean
  isNavigationActive: boolean
  guidance: NavigationGuidance | null
  routeSessionKey: string | number | null
  language: NavigationVoiceLanguage
  suspended: boolean
}

export type UseNavigationVoiceGuidanceResult = {
  supportStatus: VoiceGuidanceSupportStatus
  isSpeaking: boolean
  error: string | null
}

type VoiceGuidanceApi = {
  synthesis: SpeechSynthesis
  Utterance: typeof SpeechSynthesisUtterance
}

type VoiceGuidanceDetection = {
  status: VoiceGuidanceSupportStatus
  api: VoiceGuidanceApi | null
}

const resolveVoiceGuidanceApi = (): VoiceGuidanceDetection => {
  if (typeof window === 'undefined') {
    return { status: 'unsupported', api: null }
  }

  try {
    const synthesis = window.speechSynthesis
    const Utterance = window.SpeechSynthesisUtterance
    if (
      !synthesis ||
      typeof synthesis.speak !== 'function' ||
      typeof synthesis.cancel !== 'function' ||
      typeof Utterance !== 'function'
    ) {
      return { status: 'unsupported', api: null }
    }

    new Utterance()
    return { status: 'supported', api: { synthesis, Utterance } }
  } catch {
    return { status: 'error', api: null }
  }
}

export const detectVoiceGuidanceSupport = (): VoiceGuidanceSupportStatus =>
  resolveVoiceGuidanceApi().status

const getErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Échec de la synthèse vocale.'
}

const isDocumentVisible = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible'

export const useNavigationVoiceGuidance = ({
  enabled,
  isNavigationActive,
  guidance,
  routeSessionKey,
  language,
  suspended,
}: UseNavigationVoiceGuidanceParams): UseNavigationVoiceGuidanceResult => {
  const [detection] = useState(resolveVoiceGuidanceApi)
  const [result, setResult] = useState<UseNavigationVoiceGuidanceResult>({
    supportStatus: detection.status,
    isSpeaking: false,
    error: null,
  })
  const [pageVisible, setPageVisible] = useState(isDocumentVisible)
  const mountedRef = useRef(false)
  const announcedKeysRef = useRef(new Set<string>())
  const previousGuidanceRef = useRef<NavigationGuidance | null>(null)
  const routeSessionKeyRef = useRef<string | number | null>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const utteranceGenerationRef = useRef(0)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const resumeSuppressionRef = useRef(false)
  const pendingSessionAnnouncementRef = useRef(false)

  const updateResult = useCallback((next: Partial<UseNavigationVoiceGuidanceResult>) => {
    if (mountedRef.current) {
      setResult((current) => ({ ...current, ...next }))
    }
  }, [])

  const cancelCurrentAnnouncement = useCallback(() => {
    const utterance = currentUtteranceRef.current
    if (!utterance) {
      return
    }

    utteranceGenerationRef.current += 1
    currentUtteranceRef.current = null
    try {
      detection.api?.synthesis.cancel()
    } catch {
      // L’échec de l’annulation ne doit jamais interrompre la navigation.
    }
    updateResult({ isSpeaking: false })
  }, [detection.api, updateResult])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      utteranceGenerationRef.current += 1
      const hasCurrentAnnouncement = currentUtteranceRef.current !== null
      currentUtteranceRef.current = null
      if (hasCurrentAnnouncement) {
        try {
          detection.api?.synthesis.cancel()
        } catch {
          // Le navigateur peut déjà avoir détruit le moteur vocal.
        }
      }
    }
  }, [detection.api])

  useEffect(() => {
    const synthesis = detection.api?.synthesis
    if (!synthesis) {
      return
    }

    const readVoices = () => {
      try {
        voicesRef.current = synthesis.getVoices()
      } catch {
        voicesRef.current = []
      }
    }

    readVoices()
    if (voicesRef.current.length > 0) {
      return
    }

    const handleVoicesChanged = () => {
      readVoices()
      if (voicesRef.current.length > 0) {
        synthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      }
    }

    synthesis.addEventListener('voiceschanged', handleVoicesChanged)
    return () => {
      synthesis.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [detection.api])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleVisibilityChange = () => {
      const visible = isDocumentVisible()
      if (!visible) {
        cancelCurrentAnnouncement()
      }
      setPageVisible(visible)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [cancelCurrentAnnouncement])

  useEffect(() => {
    const sessionChanged = routeSessionKeyRef.current !== routeSessionKey
    if (sessionChanged) {
      cancelCurrentAnnouncement()
      announcedKeysRef.current.clear()
      previousGuidanceRef.current = null
      routeSessionKeyRef.current = routeSessionKey
      resumeSuppressionRef.current = false
      pendingSessionAnnouncementRef.current = routeSessionKey !== null
    }

    const shouldSuspend = !enabled || !isNavigationActive || suspended || !pageVisible
    if (shouldSuspend) {
      cancelCurrentAnnouncement()
      previousGuidanceRef.current = guidance
      if (!sessionChanged) {
        resumeSuppressionRef.current = true
      }
      return
    }

    if (!guidance || routeSessionKey === null || result.supportStatus !== 'supported') {
      cancelCurrentAnnouncement()
      previousGuidanceRef.current = null
      return
    }

    if (resumeSuppressionRef.current && !pendingSessionAnnouncementRef.current) {
      resumeSuppressionRef.current = false
      previousGuidanceRef.current = guidance
      return
    }

    const fixedTranslate = i18n.getFixedT(language)
    const announcement = createNavigationVoiceAnnouncement({
      guidance,
      previousGuidance: pendingSessionAnnouncementRef.current ? null : previousGuidanceRef.current,
      language,
      translate: (key, values) => fixedTranslate(key, values),
    })
    pendingSessionAnnouncementRef.current = false
    previousGuidanceRef.current = guidance
    if (!announcement || announcedKeysRef.current.has(announcement.key)) {
      return
    }

    announcedKeysRef.current.add(announcement.key)
    const api = detection.api
    if (!api) {
      return
    }

    cancelCurrentAnnouncement()
    const generation = ++utteranceGenerationRef.current
    try {
      const utterance = new api.Utterance(announcement.text)
      utterance.lang = language === 'fr' ? 'fr-FR' : 'en-US'
      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1
      utterance.voice =
        voicesRef.current.find((voice) => voice.lang.toLowerCase().startsWith(language)) ?? null

      utterance.onstart = () => {
        if (
          currentUtteranceRef.current === utterance &&
          utteranceGenerationRef.current === generation
        ) {
          updateResult({ isSpeaking: true })
        }
      }
      utterance.onend = () => {
        if (
          currentUtteranceRef.current === utterance &&
          utteranceGenerationRef.current === generation
        ) {
          currentUtteranceRef.current = null
          updateResult({ isSpeaking: false })
        }
      }
      utterance.onerror = (event) => {
        if (
          currentUtteranceRef.current !== utterance ||
          utteranceGenerationRef.current !== generation
        ) {
          return
        }

        currentUtteranceRef.current = null
        if (event.error === 'canceled' || event.error === 'interrupted') {
          updateResult({ isSpeaking: false })
          return
        }

        updateResult({
          supportStatus: 'error',
          isSpeaking: false,
          error: event.error || 'speech-synthesis-error',
        })
      }

      currentUtteranceRef.current = utterance
      api.synthesis.speak(utterance)
    } catch (error: unknown) {
      currentUtteranceRef.current = null
      updateResult({
        supportStatus: 'error',
        isSpeaking: false,
        error: getErrorMessage(error),
      })
    }
  }, [
    cancelCurrentAnnouncement,
    detection.api,
    enabled,
    guidance,
    isNavigationActive,
    language,
    pageVisible,
    result.supportStatus,
    routeSessionKey,
    suspended,
    updateResult,
  ])

  return result
}
