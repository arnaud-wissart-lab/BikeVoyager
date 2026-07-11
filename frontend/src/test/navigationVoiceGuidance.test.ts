import {
  buildNavigationVoiceAnnouncementKey,
  createNavigationVoiceAnnouncement,
  formatSpokenDistance,
  resolveNavigationVoiceBand,
  shouldSuspendNavigationVoiceGuidance,
  type NavigationGuidance,
} from '../features/routing/domain'

const guidance = (
  distanceToManeuverMeters: number,
  nextStepIndex = 1,
  activeStepIndex = 0,
): NavigationGuidance => ({
  activeStepIndex,
  activeInstruction: 'Continuer sur Rue A',
  distanceToManeuverMeters,
  nextStepIndex,
  nextInstruction: 'Tourner à droite sur Rue B',
  isArrival: false,
})

const translate = (key: string, values?: Record<string, string>) => {
  if (key === 'navigationVoiceArrival') {
    return 'Vous êtes arrivé.'
  }
  if (key === 'navigationVoiceImmediate') {
    return values?.instruction ?? ''
  }
  return `Dans ${values?.distance}, ${values?.instruction}`
}

describe('guidage vocal de navigation', () => {
  it('résout les bandes centralisées aux seuils attendus', () => {
    expect(resolveNavigationVoiceBand(350)).toBe('advance')
    expect(resolveNavigationVoiceBand(80)).toBe('near')
    expect(resolveNavigationVoiceBand(20)).toBe('immediate')
    expect(resolveNavigationVoiceBand(0)).toBe('immediate')
    expect(resolveNavigationVoiceBand(-1)).toBeNull()
    expect(resolveNavigationVoiceBand(Number.NaN)).toBeNull()
    expect(resolveNavigationVoiceBand(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('suspend uniquement les états de sécurité confirmés et le recalcul', () => {
    expect(shouldSuspendNavigationVoiceGuidance('on_route', 'idle')).toBe(false)
    expect(shouldSuspendNavigationVoiceGuidance('suspected', 'idle')).toBe(false)
    expect(shouldSuspendNavigationVoiceGuidance('off_route', 'idle')).toBe(true)
    expect(shouldSuspendNavigationVoiceGuidance('dismissed', 'idle')).toBe(true)
    expect(shouldSuspendNavigationVoiceGuidance('on_route', 'loading')).toBe(true)
    expect(shouldSuspendNavigationVoiceGuidance('on_route', 'success')).toBe(false)
  })

  it('annonce la prochaine manœuvre à plus de 80 mètres sans reprendre l’instruction active', () => {
    const announcement = createNavigationVoiceAnnouncement({
      guidance: guidance(200),
      previousGuidance: null,
      language: 'fr',
      translate,
    })

    expect(announcement).toEqual({
      key: 'step:1:advance',
      kind: 'advance',
      text: 'Dans 200 mètres, Tourner à droite sur Rue B',
      stepIndex: 1,
    })
    expect(announcement?.text).not.toContain('Continuer sur Rue A')
  })

  it('annonce le premier passage dans les bandes near et immediate', () => {
    const nearAnnouncement = createNavigationVoiceAnnouncement({
      guidance: guidance(79),
      previousGuidance: guidance(100),
      language: 'fr',
      translate,
    })
    expect(nearAnnouncement).toMatchObject({
      key: 'step:1:near',
      kind: 'near',
      text: 'Dans 80 mètres, Tourner à droite sur Rue B',
      stepIndex: 1,
    })
    expect(
      createNavigationVoiceAnnouncement({
        guidance: guidance(19),
        previousGuidance: guidance(50),
        language: 'fr',
        translate,
      }),
    ).toMatchObject({
      key: 'step:1:immediate',
      kind: 'immediate',
      text: 'Tourner à droite sur Rue B',
      stepIndex: 1,
    })
  })

  it('sélectionne uniquement la bande la plus urgente lors d’un saut direct', () => {
    const announcement = createNavigationVoiceAnnouncement({
      guidance: guidance(10),
      previousGuidance: guidance(200),
      language: 'fr',
      translate,
    })

    expect(announcement?.kind).toBe('immediate')
    expect(announcement?.key).toBe('step:1:immediate')
    expect(announcement?.text).toBe('Tourner à droite sur Rue B')
  })

  it('ne répète pas une bande et ne rejoue pas une bande moins urgente', () => {
    expect(
      createNavigationVoiceAnnouncement({
        guidance: guidance(60),
        previousGuidance: guidance(75),
        language: 'fr',
        translate,
      }),
    ).toBeNull()
    expect(
      createNavigationVoiceAnnouncement({
        guidance: guidance(100),
        previousGuidance: guidance(60),
        language: 'fr',
        translate,
      }),
    ).toBeNull()
  })

  it('crée une annonce pour une nouvelle étape et pour l’arrivée', () => {
    expect(
      createNavigationVoiceAnnouncement({
        guidance: guidance(150, 3, 2),
        previousGuidance: guidance(10, 2, 1),
        language: 'fr',
        translate,
      })?.key,
    ).toBe('step:3:advance')

    expect(
      createNavigationVoiceAnnouncement({
        guidance: {
          ...guidance(0, 4, 3),
          nextStepIndex: null,
          nextInstruction: null,
          isArrival: true,
        },
        previousGuidance: guidance(10, 4, 3),
        language: 'fr',
        translate,
      }),
    ).toEqual({
      key: 'arrival',
      kind: 'arrival',
      text: 'Vous êtes arrivé.',
      stepIndex: 3,
    })
  })

  it('ne produit aucune annonce de distance sans prochaine instruction complète', () => {
    expect(
      createNavigationVoiceAnnouncement({
        guidance: { ...guidance(200), nextInstruction: null },
        previousGuidance: null,
        language: 'fr',
        translate,
      }),
    ).toBeNull()
    expect(
      createNavigationVoiceAnnouncement({
        guidance: { ...guidance(200), nextStepIndex: null },
        previousGuidance: null,
        language: 'fr',
        translate,
      }),
    ).toBeNull()
  })

  it('produit des clés déterministes', () => {
    expect(buildNavigationVoiceAnnouncementKey('advance', 4)).toBe('step:4:advance')
    expect(buildNavigationVoiceAnnouncementKey('near', 4)).toBe('step:4:near')
    expect(buildNavigationVoiceAnnouncementKey('immediate', 4)).toBe('step:4:immediate')
    expect(buildNavigationVoiceAnnouncementKey('arrival', 99)).toBe('arrival')
  })

  it('formate les distances françaises pour la parole', () => {
    expect(formatSpokenDistance(22, 'fr')).toBe('20 mètres')
    expect(formatSpokenDistance(78, 'fr')).toBe('80 mètres')
    expect(formatSpokenDistance(304, 'fr')).toBe('300 mètres')
    expect(formatSpokenDistance(1000, 'fr')).toBe('1 kilomètre')
    expect(formatSpokenDistance(1500, 'fr')).toBe('1,5 kilomètre')
    expect(formatSpokenDistance(2000, 'fr')).toBe('2 kilomètres')
  })

  it('formate les distances anglaises pour la parole', () => {
    expect(formatSpokenDistance(1, 'en')).toBe('5 meters')
    expect(formatSpokenDistance(20, 'en')).toBe('20 meters')
    expect(formatSpokenDistance(1000, 'en')).toBe('1 kilometer')
    expect(formatSpokenDistance(1500, 'en')).toBe('1.5 kilometers')
  })

  it('refuse les distances négatives ou non finies', () => {
    expect(formatSpokenDistance(-1, 'fr')).toBeNull()
    expect(formatSpokenDistance(Number.NaN, 'fr')).toBeNull()
    expect(formatSpokenDistance(Number.POSITIVE_INFINITY, 'en')).toBeNull()
  })
})
