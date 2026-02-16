import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enTranslations from './locales/en.json'
import frTranslations from './locales/fr.json'

const resources = {
  fr: {
    translation: frTranslations,
  },
  en: {
    translation: enTranslations,
  },
} as const

const storedLanguage = localStorage.getItem('bv_lang')

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage ?? 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (language) => {
  localStorage.setItem('bv_lang', language)
})

export default i18n
