import {
  ActionIcon,
  AppShell,
  Container,
  Group,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconMoon, IconSun, type TablerIcon } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { MapViewMode, RouteKey } from '../../features/routing/domain'

export type ShellNavItem = {
  key: RouteKey
  label: string
  icon: TablerIcon
  disabled: boolean
}

type ShellLayoutProps = {
  isDesktop: boolean
  route: RouteKey
  navItems: ShellNavItem[]
  onNavigate: (next: RouteKey) => void
  showShellHeader: boolean
  showShellFooter: boolean
  showMobileCompactHeader: boolean
  showDesktopMapHeader: boolean
  headerHeight: number
  footerHeight: number
  viewportHeightUnit: '100vh' | '100dvh'
  availableViewportHeight: string
  contentSize: string
  borderColor: string
  shellChromeBackground: string
  shellChromeFilter: string
  shellMainBackground: string
  isMapRoute: boolean
  mobileHeaderTitle: string
  mapHeaderTitle: string
  appNameLabel: string
  appTaglineLabel: string
  language: 'fr' | 'en'
  onLanguageChange: (language: 'fr' | 'en') => void
  mapViewMode: MapViewMode
  onMapViewModeChange: (value: MapViewMode) => void
  mapViewLabel: string
  mapView2dLabel: string
  mapView3dLabel: string
  themeMode: 'light' | 'dark' | 'auto'
  onThemeModeChange: (value: 'light' | 'dark' | 'auto') => void
  isDarkTheme: boolean
  nextThemeMode: 'light' | 'dark' | 'auto'
  mobileThemeActionLabel: string
  settingsLanguageLabel: string
  themeAutoLabel: string
  themeLightLabel: string
  themeDarkLabel: string
  mainContent: ReactNode
  surfaceGrayDisabled: string
  surfaceGrayDefault: string
  activeRouteColor: string
}

export default function ShellLayout({
  isDesktop,
  route,
  navItems,
  onNavigate,
  showShellHeader,
  showShellFooter,
  showMobileCompactHeader,
  showDesktopMapHeader,
  headerHeight,
  footerHeight,
  viewportHeightUnit,
  availableViewportHeight,
  contentSize,
  borderColor,
  shellChromeBackground,
  shellChromeFilter,
  shellMainBackground,
  isMapRoute,
  mobileHeaderTitle,
  mapHeaderTitle,
  appNameLabel,
  appTaglineLabel,
  language,
  onLanguageChange,
  mapViewMode,
  onMapViewModeChange,
  mapViewLabel,
  mapView2dLabel,
  mapView3dLabel,
  themeMode,
  onThemeModeChange,
  isDarkTheme,
  nextThemeMode,
  mobileThemeActionLabel,
  settingsLanguageLabel,
  themeAutoLabel,
  themeLightLabel,
  themeDarkLabel,
  mainContent,
  surfaceGrayDisabled,
  surfaceGrayDefault,
  activeRouteColor,
}: ShellLayoutProps) {
  return (
    <AppShell
      padding={0}
      header={showShellHeader ? { height: headerHeight } : undefined}
      footer={showShellFooter && !isDesktop ? { height: footerHeight } : undefined}
      style={{ minHeight: viewportHeightUnit }}
    >
      {showShellHeader && (
        <AppShell.Header
          style={{
            borderBottom: `1px solid ${borderColor}`,
            background: shellChromeBackground,
            backdropFilter: shellChromeFilter,
            WebkitBackdropFilter: shellChromeFilter,
          }}
        >
          <Container size={contentSize} h="100%">
            <Group justify="space-between" align="center" h="100%" wrap="nowrap">
              {showMobileCompactHeader ? (
                <>
                  <Text fw={600} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                    {mobileHeaderTitle}
                  </Text>
                  <Group gap={6} align="center" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="cyan"
                      radius="xl"
                      size="lg"
                      onClick={() => onLanguageChange(language === 'fr' ? 'en' : 'fr')}
                      aria-label={settingsLanguageLabel}
                      title={settingsLanguageLabel}
                    >
                      <Text span fz={17} lh={1}>
                        {language === 'fr' ? '🇫🇷' : '🇬🇧'}
                      </Text>
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color={themeMode === 'auto' ? 'gray' : isDarkTheme ? 'indigo' : 'orange'}
                      radius="xl"
                      size="lg"
                      onClick={() => onThemeModeChange(nextThemeMode)}
                      aria-label={mobileThemeActionLabel}
                      title={mobileThemeActionLabel}
                    >
                      {isDarkTheme ? <IconMoon size={18} /> : <IconSun size={18} />}
                    </ActionIcon>
                  </Group>
                </>
              ) : (
                <>
                  <Group gap="md" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    {showDesktopMapHeader ? (
                      <Text fw={600} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                        {mapHeaderTitle}
                      </Text>
                    ) : (
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text fw={600}>{appNameLabel}</Text>
                        {isDesktop && (
                          <Text size="xs" c="dimmed">
                            {appTaglineLabel}
                          </Text>
                        )}
                      </Stack>
                    )}
                    {isDesktop && (
                      <Tabs
                        value={route}
                        onChange={(value) => (value ? onNavigate(value as RouteKey) : null)}
                        variant="pills"
                        radius="xl"
                      >
                        <Tabs.List>
                          {navItems.map((item) => (
                            <Tabs.Tab key={item.key} value={item.key} disabled={item.disabled}>
                              {item.label}
                            </Tabs.Tab>
                          ))}
                        </Tabs.List>
                      </Tabs>
                    )}
                  </Group>

                  <Group gap="xs" align="center" wrap="nowrap">
                    {showDesktopMapHeader && (
                      <SegmentedControl
                        size="xs"
                        radius="xl"
                        aria-label={mapViewLabel}
                        value={mapViewMode}
                        onChange={(value) => onMapViewModeChange(value as MapViewMode)}
                        data={[
                          { label: mapView2dLabel, value: '2d' },
                          { label: mapView3dLabel, value: '3d' },
                        ]}
                      />
                    )}
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      value={language}
                      onChange={(value) => onLanguageChange(value as 'fr' | 'en')}
                      data={[
                        { label: 'FR', value: 'fr' },
                        { label: 'EN', value: 'en' },
                      ]}
                    />
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      value={themeMode}
                      onChange={(value) => onThemeModeChange(value as 'light' | 'dark' | 'auto')}
                      data={[
                        { label: themeAutoLabel, value: 'auto' },
                        { label: themeLightLabel, value: 'light' },
                        { label: themeDarkLabel, value: 'dark' },
                      ]}
                    />
                  </Group>
                </>
              )}
            </Group>
          </Container>
        </AppShell.Header>
      )}

      <AppShell.Main
        style={
          isMapRoute
            ? { overflow: 'hidden' }
            : {
                minHeight: availableViewportHeight,
                background: shellMainBackground,
              }
        }
      >
        {mainContent}
      </AppShell.Main>

      {showShellFooter && !isDesktop && (
        <AppShell.Footer
          style={{
            borderTop: `1px solid ${borderColor}`,
            background: shellChromeBackground,
            backdropFilter: shellChromeFilter,
            WebkitBackdropFilter: shellChromeFilter,
          }}
        >
          <Group justify="space-between" align="center" h="100%" px="xs" gap={0} wrap="nowrap">
            {navItems.map((item) => {
              const isActive = route === item.key
              const Icon = item.icon
              const color = item.disabled
                ? surfaceGrayDisabled
                : isActive
                  ? activeRouteColor
                  : surfaceGrayDefault

              return (
                <UnstyledButton
                  key={item.key}
                  onClick={() => !item.disabled && onNavigate(item.key)}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    minWidth: 0,
                    gap: 4,
                    color,
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <Icon size={20} />
                  <Text
                    size="xs"
                    fw={isActive ? 600 : 500}
                    ta="center"
                    lineClamp={1}
                    style={{ width: '100%' }}
                  >
                    {item.label}
                  </Text>
                </UnstyledButton>
              )
            })}
          </Group>
        </AppShell.Footer>
      )}
    </AppShell>
  )
}
