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
    date: '2026-07-23',
    sections: [
      {
        title: {
          fr: 'Choix et actions du trajet',
          en: 'Route selection and actions',
        },
        items: [
          {
            type: 'improved',
            text: {
              fr: 'Catalogue limité aux alternatives réellement distinctes, avec comparaison de la distance et du profil d’altitude.',
              en: 'Catalog limited to genuinely distinct alternatives, with distance and elevation profile comparison.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Tri des alternatives par pertinence, distance ou dénivelé.',
              en: 'Sort alternatives by relevance, distance, or elevation gain.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Actions du trajet plus compactes sur téléphone, avec compteur d’alternatives et pictogramme GPS.',
              en: 'More compact route actions on phones, with an alternative counter and GPS icon.',
            },
          },
        ],
      },
      {
        title: {
          fr: 'Exports et interface',
          en: 'Exports and interface',
        },
        items: [
          {
            type: 'added',
            text: {
              fr: 'Choix entre les formats GPX et TCX pour exporter le trajet courant.',
              en: 'Choose between GPX and TCX when exporting the current route.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Accès à la version et à son historique depuis l’en-tête de chaque page.',
              en: 'Access the version and its history from every page header.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Sélecteurs de langue et de thème remplacés par des pictogrammes accessibles.',
              en: 'Language and theme selectors replaced with accessible icons.',
            },
          },
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-11',
    sections: [
      {
        title: {
          fr: 'Navigation sur le terrain',
          en: 'On-the-road navigation',
        },
        items: [
          {
            type: 'added',
            text: {
              fr: 'Feuille de route détaillée avec les différentes étapes du trajet.',
              en: 'Detailed roadbook with each step of the journey.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Guidage actif avec prochaine manœuvre, distance et instructions vocales optionnelles sans service externe.',
              en: 'Active guidance with the next maneuver, its distance, and optional voice instructions without an external service.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Maintien de l’écran allumé pendant la navigation lorsque le navigateur le permet.',
              en: 'Keep the screen awake during navigation when supported by the browser.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Détection des sorties d’itinéraire avec recalcul manuel ou automatique optionnel depuis la position GPS réelle.',
              en: 'Off-route detection with manual or optional automatic recalculation from your actual GPS position.',
            },
          },
        ],
      },
      {
        title: {
          fr: 'Préparation et choix du trajet',
          en: 'Route planning and selection',
        },
        items: [
          {
            type: 'improved',
            text: {
              fr: 'Comparaison des trajets avec leur distance, leur durée et leur dénivelé.',
              en: 'Compare routes by distance, duration, and elevation gain.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Affichage simultané du trajet actuel et de l’alternative sur la carte.',
              en: 'View the current route and its alternative together on the map.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Préréglages adaptés au vélo et au VAE.',
              en: 'Ready-to-use presets for bikes and e-bikes.',
            },
          },
          {
            type: 'added',
            text: {
              fr: 'Carnet de trajets sauvegardés avec export GPX direct.',
              en: 'Saved route library with direct GPX export.',
            },
          },
        ],
      },
      {
        title: {
          fr: 'Fiabilité et confort',
          en: 'Reliability and comfort',
        },
        items: [
          {
            type: 'fixed',
            text: {
              fr: 'Conservation du trajet courant lorsqu’un recalcul échoue.',
              en: 'Keep the current route when recalculation fails.',
            },
          },
          {
            type: 'fixed',
            text: {
              fr: 'Protection contre les résultats de recalcul devenus obsolètes.',
              en: 'Protection against recalculation results that are no longer relevant.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Gestion plus fiable des segments sans instruction et des distances avant la prochaine manœuvre.',
              en: 'More reliable handling of segments without instructions and distances to the next maneuver.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Préférences de navigation sauvegardées et restaurables.',
              en: 'Navigation preferences can be saved and restored.',
            },
          },
          {
            type: 'improved',
            text: {
              fr: 'Fonctionnement adapté lorsque le maintien de l’écran ou la synthèse vocale ne sont pas disponibles.',
              en: 'Graceful operation when screen wake or speech synthesis is unavailable.',
            },
          },
        ],
      },
    ],
  },
  {
    version: '0.1.0',
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
