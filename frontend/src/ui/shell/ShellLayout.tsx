import {
  ActionIcon,
  AppShell,
  Badge,
  Container,
  Group,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconDeviceDesktop,
  IconInfoCircle,
  IconMoon,
  IconSun,
  type TablerIcon,
} from '@tabler/icons-react'
import englishFlagUrl from 'flag-icons/flags/4x3/gb.svg'
import frenchFlagUrl from 'flag-icons/flags/4x3/fr.svg'
import type { ReactNode } from 'react'
import type { MapViewMode, RouteKey } from '../../features/routing/domain'

export type ShellNavItem = {
  key: RouteKey
  label: string
  icon: TablerIcon
  disabled: boolean
}

const LanguageFlag = ({ src }: { src: string }) => (
  <img
    src={src}
    alt=""
    aria-hidden
    width={20}
    height={15}
    style={{
      display: 'block',
      borderRadius: 2,
      boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.12)',
    }}
  />
)

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
  appVersionLabel: string
  appTaglineLabel: string
  releaseNotesLabel: string
  onOpenReleaseNotes: () => void
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
  languageFrenchLabel: string
  languageEnglishLabel: string
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
  appVersionLabel,
  appTaglineLabel,
  releaseNotesLabel,
  onOpenReleaseNotes,
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
  languageFrenchLabel,
  languageEnglishLabel,
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
                    <Tooltip label={releaseNotesLabel} withArrow>
                      <ActionIcon
                        variant="light"
                        color="teal"
                        radius="xl"
                        size="lg"
                        onClick={onOpenReleaseNotes}
                        aria-label={releaseNotesLabel}
                        title={releaseNotesLabel}
                      >
                        <IconInfoCircle size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon
                      variant="light"
                      color="cyan"
                      radius="xl"
                      size="lg"
                      onClick={() => onLanguageChange(language === 'fr' ? 'en' : 'fr')}
                      aria-label={settingsLanguageLabel}
                      title={settingsLanguageLabel}
                    >
                      <LanguageFlag src={language === 'fr' ? frenchFlagUrl : englishFlagUrl} />
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
                      {themeMode === 'auto' ? (
                        <IconDeviceDesktop size={18} />
                      ) : isDarkTheme ? (
                        <IconMoon size={18} />
                      ) : (
                        <IconSun size={18} />
                      )}
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
                      <Group gap={6} wrap="nowrap">
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Group gap={6} wrap="nowrap">
                            <Text fw={600}>{appNameLabel}</Text>
                            <Badge size="xs" variant="light" color="teal" radius="sm">
                              {appVersionLabel}
                            </Badge>
                          </Group>
                          {isDesktop && (
                            <Text size="xs" c="dimmed">
                              {appTaglineLabel}
                            </Text>
                          )}
                        </Stack>
                        <Tooltip label={releaseNotesLabel} withArrow>
                          <ActionIcon
                            variant="subtle"
                            color="teal"
                            radius="xl"
                            size="sm"
                            onClick={onOpenReleaseNotes}
                            aria-label={releaseNotesLabel}
                            title={releaseNotesLabel}
                          >
                            <IconInfoCircle size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
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
                      <>
                        <Tooltip label={releaseNotesLabel} withArrow>
                          <ActionIcon
                            variant="light"
                            color="teal"
                            radius="xl"
                            size="lg"
                            onClick={onOpenReleaseNotes}
                            aria-label={releaseNotesLabel}
                            title={releaseNotesLabel}
                          >
                            <IconInfoCircle size={18} />
                          </ActionIcon>
                        </Tooltip>
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
                      </>
                    )}
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      aria-label={settingsLanguageLabel}
                      value={language}
                      onChange={(value) => onLanguageChange(value as 'fr' | 'en')}
                      data={[
                        {
                          label: (
                            <Tooltip label={languageFrenchLabel} withArrow>
                              <span>
                                <LanguageFlag src={frenchFlagUrl} />
                                <VisuallyHidden>{languageFrenchLabel}</VisuallyHidden>
                              </span>
                            </Tooltip>
                          ),
                          value: 'fr',
                        },
                        {
                          label: (
                            <Tooltip label={languageEnglishLabel} withArrow>
                              <span>
                                <LanguageFlag src={englishFlagUrl} />
                                <VisuallyHidden>{languageEnglishLabel}</VisuallyHidden>
                              </span>
                            </Tooltip>
                          ),
                          value: 'en',
                        },
                      ]}
                    />
                    <SegmentedControl
                      size="xs"
                      radius="xl"
                      aria-label={mobileThemeActionLabel}
                      value={themeMode}
                      onChange={(value) => onThemeModeChange(value as 'light' | 'dark' | 'auto')}
                      data={[
                        {
                          label: (
                            <Tooltip label={themeAutoLabel} withArrow>
                              <span>
                                <IconDeviceDesktop size={16} aria-hidden />
                                <VisuallyHidden>{themeAutoLabel}</VisuallyHidden>
                              </span>
                            </Tooltip>
                          ),
                          value: 'auto',
                        },
                        {
                          label: (
                            <Tooltip label={themeLightLabel} withArrow>
                              <span>
                                <IconSun size={16} aria-hidden />
                                <VisuallyHidden>{themeLightLabel}</VisuallyHidden>
                              </span>
                            </Tooltip>
                          ),
                          value: 'light',
                        },
                        {
                          label: (
                            <Tooltip label={themeDarkLabel} withArrow>
                              <span>
                                <IconMoon size={16} aria-hidden />
                                <VisuallyHidden>{themeDarkLabel}</VisuallyHidden>
                              </span>
                            </Tooltip>
                          ),
                          value: 'dark',
                        },
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
