import {
  ActionIcon,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Transition,
  useMantineTheme,
} from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconDownload, IconShare, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const dismissKey = 'bv_install_prompt_dismissed_until'
const dismissDurationMs = 1000 * 60 * 60 * 24 * 14

const isPromptTemporarilyDismissed = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const dismissedUntil = Number(localStorage.getItem(dismissKey) ?? 0)
  return Boolean(dismissedUntil && dismissedUntil > Date.now())
}

const isStandaloneDisplay = () => {
  if (typeof window === 'undefined') {
    return false
  }

  if (window.matchMedia?.('(display-mode: standalone)').matches) {
    return true
  }

  const navigatorAny = navigator as Navigator & { standalone?: boolean }
  return Boolean(navigatorAny.standalone)
}

const detectIos = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = window.navigator.userAgent ?? ''
  return /iphone|ipad|ipod/i.test(userAgent)
}

export default function InstallPrompt() {
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDesktop = useMediaQuery('(min-width: 60em)')
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos] = useState(detectIos)
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    if (isStandaloneDisplay() || isPromptTemporarilyDismissed()) {
      return false
    }

    return detectIos()
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isStandaloneDisplay() || isPromptTemporarilyDismissed()) {
      return
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    const handleInstalled = () => {
      setPromptEvent(null)
      setIsVisible(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const dismissPrompt = () => {
    setPromptEvent(null)
    setIsVisible(false)
    localStorage.setItem(
      dismissKey,
      (Date.now() + dismissDurationMs).toString(),
    )
  }

  const handleInstall = async () => {
    if (!promptEvent) {
      return
    }

    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'accepted') {
        setIsVisible(false)
        return
      }
    } catch {
      // Ignore les erreurs du prompt d'installation.
    }

    dismissPrompt()
  }

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      zIndex: 1200,
      bottom: isDesktop
        ? 24
        : 'calc(96px + env(safe-area-inset-bottom, 0px))',
      right: isDesktop ? 24 : 16,
      left: isDesktop ? 'auto' : 16,
      pointerEvents: 'auto',
    }),
    [isDesktop],
  )

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundColor:
        colorScheme === 'dark' ? theme.colors.gray[8] : theme.white,
      maxWidth: isDesktop ? 360 : '100%',
      borderColor:
        colorScheme === 'dark' ? theme.colors.gray[7] : theme.colors.gray[3],
    }),
    [colorScheme, isDesktop, theme.colors.gray, theme.white],
  )

  if (!isVisible) {
    return null
  }

  return (
    <Transition mounted={isVisible} transition="slide-up" duration={220} timingFunction="ease">
      {(styles) => (
        <Box style={{ ...containerStyle, ...styles }}>
          <Paper withBorder radius="md" p="md" shadow="md" style={cardStyle}>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Group gap="xs" align="center">
                  <IconDownload size={18} />
                  <Text fw={600}>{t('installPromptTitle')}</Text>
                </Group>
                <ActionIcon variant="subtle" onClick={dismissPrompt}>
                  <IconX size={16} />
                </ActionIcon>
              </Group>

              <Text size="sm" c="dimmed">
                {t('installPromptBody')}
              </Text>

              {isIos ? (
                <Stack gap={6}>
                  <Group gap={6} align="center">
                    <IconShare size={16} />
                    <Text size="sm">{t('installPromptIosShare')}</Text>
                  </Group>
                  <Text size="sm">{t('installPromptIosAdd')}</Text>
                  <Button variant="light" onClick={dismissPrompt}>
                    {t('installPromptDone')}
                  </Button>
                </Stack>
              ) : (
                <Group justify="space-between" align="center">
                  <Button variant="light" onClick={dismissPrompt}>
                    {t('installPromptLater')}
                  </Button>
                  <Button onClick={handleInstall} disabled={!promptEvent}>
                    {t('installPromptInstall')}
                  </Button>
                </Group>
              )}
            </Stack>
          </Paper>
        </Box>
      )}
    </Transition>
  )
}
