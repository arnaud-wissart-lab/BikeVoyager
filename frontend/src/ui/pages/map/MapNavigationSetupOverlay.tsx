import { ActionIcon, Box, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconPlayerPlay, IconX } from '@tabler/icons-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import NavigationOptionsPanel from '../NavigationOptionsPanel'

type MapNavigationSetupOverlayProps = {
  isOpen: boolean
  hasRoute: boolean
  isNavigationActive: boolean
  mapOverlayPadding: number
  setupOverlayColor: string
  isDesktop: boolean
  surfaceColor: string
  onCloseNavigationSetup: () => void
  navigationOptionsPanelProps: Omit<ComponentProps<typeof NavigationOptionsPanel>, 'isCompact'>
  onStartNavigation: () => void
}

export default function MapNavigationSetupOverlay({
  isOpen,
  hasRoute,
  isNavigationActive,
  mapOverlayPadding,
  setupOverlayColor,
  isDesktop,
  surfaceColor,
  onCloseNavigationSetup,
  navigationOptionsPanelProps,
  onStartNavigation,
}: MapNavigationSetupOverlayProps) {
  const { t } = useTranslation()

  if (!isOpen || !hasRoute || isNavigationActive) {
    return null
  }

  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: mapOverlayPadding,
        pointerEvents: 'auto',
        backgroundColor: setupOverlayColor,
        backdropFilter: 'blur(2px)',
      }}
    >
      <Paper
        withBorder
        radius="md"
        p="md"
        style={{
          width: isDesktop ? 460 : '100%',
          maxWidth: 560,
          maxHeight: isDesktop ? '78vh' : '82dvh',
          overflowY: 'auto',
          backgroundColor: surfaceColor,
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text fw={600}>{t('navigationSetupTitle')}</Text>
            <ActionIcon
              variant="subtle"
              onClick={onCloseNavigationSetup}
              aria-label={t('navigationSetupClose')}
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <NavigationOptionsPanel isCompact={false} {...navigationOptionsPanelProps} />
          <Group grow>
            <Button variant="default" onClick={onCloseNavigationSetup}>
              {t('navigationSetupClose')}
            </Button>
            <Button
              onClick={onStartNavigation}
              data-testid="nav-start"
              leftSection={<IconPlayerPlay size={16} />}
            >
              {t('navigationStart')}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Box>
  )
}
