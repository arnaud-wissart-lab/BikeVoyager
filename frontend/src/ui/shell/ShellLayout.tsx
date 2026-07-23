import {
  ActionIcon,
  AppShell,
  Box,
  Container,
  Group,
  SegmentedControl,
  Tabs,
  Text,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from '@mantine/core'
import {
  IconDeviceDesktop,
  IconFlag,
  IconMapPin,
  IconMoon,
  IconSun,
  type TablerIcon,
} from '@tabler/icons-react'
import englishFlagUrl from 'flag-icons/flags/4x3/gb.svg'
import frenchFlagUrl from 'flag-icons/flags/4x3/fr.svg'
import type { ReactNode } from 'react'
import type { MapViewMode, RouteKey, TripType } from '../../features/routing/domain'

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

const segmentedControlStyles = {
  root: {
    flexShrink: 0,
    padding: 2,
  },
  control: {
    width: 34,
  },
  label: {
    alignItems: 'center',
    display: 'flex',
    height: 30,
    justifyContent: 'center',
    minHeight: 30,
    padding: 0,
  },
} as const

const ControlGlyph = ({ children }: { children: ReactNode }) => (
  <span
    style={{
      alignItems: 'center',
      display: 'inline-flex',
      height: 20,
      justifyContent: 'center',
      width: 20,
    }}
  >
    {children}
  </span>
)

type RouteHeaderTitleProps = {
  mapHeaderTitle: string
  mapStartLabel: string
  mapEndLabel: string
  mapTripType: TripType | null
  mapLoopLabel: string
  withTooltip: boolean
}

const RouteHeaderTitle = ({
  mapHeaderTitle,
  mapStartLabel,
  mapEndLabel,
  mapTripType,
  mapLoopLabel,
  withTooltip,
}: RouteHeaderTitleProps) => {
  const lineStyle = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const
  const content = (
    <Box
      aria-label={mapHeaderTitle}
      data-testid="route-header-title"
      style={{ minWidth: 0, width: '100%' }}
    >
      <Group gap={6} wrap="nowrap">
        <IconMapPin
          size={14}
          color="var(--mantine-color-teal-6)"
          aria-hidden
          style={{ flexShrink: 0 }}
        />
        <Text component="span" size="sm" fw={600} lh={1.2} style={lineStyle}>
          {mapStartLabel}
        </Text>
      </Group>
      <Group gap={6} wrap="nowrap">
        <IconFlag
          size={14}
          color="var(--mantine-color-red-6)"
          aria-hidden
          style={{ flexShrink: 0 }}
        />
        <Text component="span" size="sm" fw={600} lh={1.2} style={lineStyle}>
          {mapTripType === 'loop' ? mapLoopLabel : mapEndLabel}
        </Text>
      </Group>
    </Box>
  )

  if (!withTooltip) {
    return content
  }

  return (
    <Tooltip
      label={mapHeaderTitle}
      position="bottom-start"
      openDelay={350}
      withArrow
      multiline
      maw={360}
      radius="md"
      transitionProps={{ transition: 'fade-down', duration: 150 }}
      styles={{
        tooltip: {
          boxShadow: 'var(--mantine-shadow-md)',
          fontWeight: 500,
          padding: '8px 10px',
        },
      }}
    >
      {content}
    </Tooltip>
  )
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
  mapHeaderTitle: string
  mapStartLabel: string
  mapEndLabel: string
  mapTripType: TripType | null
  mapLoopLabel: string
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
  mapHeaderTitle,
  mapStartLabel,
  mapEndLabel,
  mapTripType,
  mapLoopLabel,
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
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    {isMapRoute && mapHeaderTitle ? (
                      <RouteHeaderTitle
                        mapHeaderTitle={mapHeaderTitle}
                        mapStartLabel={mapStartLabel}
                        mapEndLabel={mapEndLabel}
                        mapTripType={mapTripType}
                        mapLoopLabel={mapLoopLabel}
                        withTooltip={false}
                      />
                    ) : null}
                  </Box>
                  <Group gap={6} align="center" wrap="nowrap">
                    <ActionIcon
                      variant="light"
                      color="cyan"
                      radius="xl"
                      size={36}
                      onClick={() => onLanguageChange(language === 'fr' ? 'en' : 'fr')}
                      aria-label={settingsLanguageLabel}
                      title={settingsLanguageLabel}
                    >
                      <LanguageFlag src={language === 'fr' ? frenchFlagUrl : englishFlagUrl} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color={themeMode === 'auto' ? 'cyan' : isDarkTheme ? 'violet' : 'orange'}
                      radius="xl"
                      size={36}
                      onClick={() => onThemeModeChange(nextThemeMode)}
                      aria-label={mobileThemeActionLabel}
                      title={mobileThemeActionLabel}
                    >
                      {themeMode === 'auto' ? (
                        <IconDeviceDesktop size={18} color="var(--mantine-color-cyan-7)" />
                      ) : isDarkTheme ? (
                        <IconMoon size={18} color="var(--mantine-color-violet-6)" />
                      ) : (
                        <IconSun size={18} color="var(--mantine-color-orange-6)" />
                      )}
                    </ActionIcon>
                  </Group>
                </>
              ) : (
                <>
                  <Group gap="md" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    {isDesktop && (
                      <Tabs
                        value={route}
                        onChange={(value) => (value ? onNavigate(value as RouteKey) : null)}
                        variant="pills"
                        radius="xl"
                      >
                        <Tabs.List>
                          {navItems.map((item) => {
                            const Icon = item.icon

                            return (
                              <Tabs.Tab
                                key={item.key}
                                value={item.key}
                                disabled={item.disabled}
                                leftSection={<Icon size={16} stroke={1.8} aria-hidden />}
                              >
                                {item.label}
                              </Tabs.Tab>
                            )
                          })}
                        </Tabs.List>
                      </Tabs>
                    )}
                    {showDesktopMapHeader ? (
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <RouteHeaderTitle
                          mapHeaderTitle={mapHeaderTitle}
                          mapStartLabel={mapStartLabel}
                          mapEndLabel={mapEndLabel}
                          mapTripType={mapTripType}
                          mapLoopLabel={mapLoopLabel}
                          withTooltip
                        />
                      </Box>
                    ) : null}
                  </Group>

                  <Group gap={6} align="center" wrap="nowrap">
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
                        withItemsBorders={false}
                        styles={segmentedControlStyles}
                      />
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
                              <ControlGlyph>
                                <LanguageFlag src={frenchFlagUrl} />
                                <VisuallyHidden>{languageFrenchLabel}</VisuallyHidden>
                              </ControlGlyph>
                            </Tooltip>
                          ),
                          value: 'fr',
                        },
                        {
                          label: (
                            <Tooltip label={languageEnglishLabel} withArrow>
                              <ControlGlyph>
                                <LanguageFlag src={englishFlagUrl} />
                                <VisuallyHidden>{languageEnglishLabel}</VisuallyHidden>
                              </ControlGlyph>
                            </Tooltip>
                          ),
                          value: 'en',
                        },
                      ]}
                      withItemsBorders={false}
                      styles={segmentedControlStyles}
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
                              <ControlGlyph>
                                <IconDeviceDesktop
                                  size={18}
                                  color="var(--mantine-color-cyan-7)"
                                  aria-hidden
                                />
                                <VisuallyHidden>{themeAutoLabel}</VisuallyHidden>
                              </ControlGlyph>
                            </Tooltip>
                          ),
                          value: 'auto',
                        },
                        {
                          label: (
                            <Tooltip label={themeLightLabel} withArrow>
                              <ControlGlyph>
                                <IconSun
                                  size={18}
                                  color="var(--mantine-color-orange-6)"
                                  aria-hidden
                                />
                                <VisuallyHidden>{themeLightLabel}</VisuallyHidden>
                              </ControlGlyph>
                            </Tooltip>
                          ),
                          value: 'light',
                        },
                        {
                          label: (
                            <Tooltip label={themeDarkLabel} withArrow>
                              <ControlGlyph>
                                <IconMoon
                                  size={18}
                                  color="var(--mantine-color-violet-6)"
                                  aria-hidden
                                />
                                <VisuallyHidden>{themeDarkLabel}</VisuallyHidden>
                              </ControlGlyph>
                            </Tooltip>
                          ),
                          value: 'dark',
                        },
                      ]}
                      withItemsBorders={false}
                      styles={segmentedControlStyles}
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
