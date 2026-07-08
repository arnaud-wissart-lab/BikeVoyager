import { appVersion } from './versionInfo'

export type ReleaseNoteType = 'added' | 'improved' | 'fixed'

type LocalizedText = {
  fr: string
  en: string
}

export type ReleaseNoteItem = {
  type?: ReleaseNoteType
  text: LocalizedText
}

export type ReleaseNoteSection = {
  title: LocalizedText
  items: ReleaseNoteItem[]
}

export type ReleaseNote = {
  version: string
  date: string
  sections: ReleaseNoteSection[]
}

export const releaseNotes: ReleaseNote[] = [
  {
    version: appVersion,
    date: '2026-07-08',
    sections: [
      {
        title: {
          fr: 'Nouveautés récentes',
          en: 'Recent additions',
        },
        items: [
          {
            type: 'added',
            text: {
              fr: 'Ouverture de Street View depuis un clic droit sur la carte.',
              en: 'Open Street View from a right-click on the map.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Profil d’altitude avec D+, D-, pente maximale et difficulté vélo/VAE.',
              en: 'Elevation profile with ascent, descent, maximum slope, and bike/e-bike difficulty.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Filtres POI avancés avec sauvegarde des préférences.',
              en: 'Advanced POI filters with saved preferences.',
            },
          },
        ],
      },
      {
        title: {
          fr: 'Améliorations visibles',
          en: 'Visible improvements',
        },
        items: [
          {
            type: 'improved',
            text: {
              fr: 'Détails POI plus lisibles, avec les informations utiles mises en avant.',
              en: 'More readable POI details, with useful information highlighted.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Mise à jour des dépendances frontend pour garder l’interface saine et maintenable.',
              en: 'Frontend dependencies updated to keep the interface healthy and maintainable.',
            },
          },
        ],
      },
      {
        title: {
          fr: 'Corrections importantes',
          en: 'Important fixes',
        },
        items: [
          {
            type: 'fixed',
            text: {
              fr: 'Les POI masqués par les filtres sont correctement désélectionnés.',
              en: 'POI hidden by filters are now properly deselected.',
            },
          },
        ],
      },
    ],
  },
]
