import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Slider,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Transition,
  UnstyledButton,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconHelpCircle,
  IconMap2,
  IconMoon,
  IconRoute,
  IconSun,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type RouteKey = 'planifier' | 'carte' | 'profils' | 'aide'

type Mode = 'walk' | 'bike' | 'ebike'

type TripType = 'oneway' | 'loop'

type AssistLevel = 'low' | 'medium' | 'high'

type ProfileSettings = {
  speeds: Record<Mode, number>
  ebikeAssist: AssistLevel
}

const routeValues: RouteKey[] = ['planifier', 'carte', 'profils', 'aide']
const profileStorageKey = 'bv_profile_settings'

const speedRanges: Record<Mode, { min: number; max: number; step: number; precision: number }> = {
  walk: { min: 3, max: 7, step: 0.5, precision: 1 },
  bike: { min: 10, max: 30, step: 1, precision: 0 },
  ebike: { min: 15, max: 25, step: 1, precision: 0 },
}

const defaultProfileSettings: ProfileSettings = {
  speeds: {
    walk: 5,
    bike: 15,
    ebike: 25,
  },
  ebikeAssist: 'medium',
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const isAssistLevel = (value: unknown): value is AssistLevel =>
  value === 'low' || value === 'medium' || value === 'high'

const normalizeProfileSettings = (
  value: Partial<ProfileSettings> | null | undefined,
): ProfileSettings => {
  const walk = value?.speeds?.walk
  const bike = value?.speeds?.bike
  const ebike = value?.speeds?.ebike

  return {
    speeds: {
      walk:
        typeof walk === 'number'
          ? clamp(walk, speedRanges.walk.min, speedRanges.walk.max)
          : defaultProfileSettings.speeds.walk,
      bike:
        typeof bike === 'number'
          ? clamp(bike, speedRanges.bike.min, speedRanges.bike.max)
          : defaultProfileSettings.speeds.bike,
      ebike:
        typeof ebike === 'number'
          ? clamp(ebike, speedRanges.ebike.min, speedRanges.ebike.max)
          : defaultProfileSettings.speeds.ebike,
    },
    ebikeAssist: isAssistLevel(value?.ebikeAssist)
      ? value.ebikeAssist
      : defaultProfileSettings.ebikeAssist,
  }
}

const loadProfileSettings = (): ProfileSettings => {
  if (typeof window === 'undefined') {
    return defaultProfileSettings
  }

  const raw = localStorage.getItem(profileStorageKey)
  if (!raw) {
    return defaultProfileSettings
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>
    return normalizeProfileSettings(parsed)
  } catch {
    return defaultProfileSettings
  }
}

function useHashRoute(defaultRoute: RouteKey) {
  const parseHash = () => {
    if (typeof window === 'undefined') {
      return defaultRoute
    }

    const raw = window.location.hash.replace('#', '').replace('/', '')
    if (routeValues.includes(raw as RouteKey)) {
      return raw as RouteKey
    }
    return defaultRoute
  }

  const [route, setRoute] = useState<RouteKey>(parseHash)

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = `/${defaultRoute}`
    }

    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [defaultRoute])

  const navigate = (next: RouteKey) => {
    if (route === next) {
      return
    }

    window.location.hash = `/${next}`
    setRoute(next)
  }

  return [route, navigate] as const
}

export default function App() {
  const { t, i18n } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const isDesktop = useMediaQuery('(min-width: 60em)')

  const [route, navigate] = useHashRoute('planifier')
  const [hasRoute, setHasRoute] = useState(false)
  const [mode, setMode] = useState<Mode | null>(null)
  const [tripType, setTripType] = useState<TripType | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [distance, setDistance] = useState<number | ''>('')

  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(() =>
    loadProfileSettings(),
  )

  useEffect(() => {
    localStorage.setItem(profileStorageKey, JSON.stringify(profileSettings))
  }, [profileSettings])

  const language = i18n.language.startsWith('en') ? 'en' : 'fr'
  const headerHeight = isDesktop ? 72 : 56
  const footerHeight = isDesktop ? 0 : 72
  const contentSize = isDesktop ? '84rem' : 'xl'
  const surfaceColor =
    colorScheme === 'dark' ? theme.colors.gray[9] : theme.white
  const borderColor = theme.colors.gray[colorScheme === 'dark' ? 8 : 3]

  const navItems = [
    {
      key: 'planifier' as RouteKey,
      label: t('navPlanifier'),
      icon: IconRoute,
      disabled: false,
    },
    {
      key: 'carte' as RouteKey,
      label: t('navCarte'),
      icon: IconMap2,
      disabled: !hasRoute,
    },
    {
      key: 'profils' as RouteKey,
      label: t('navProfils'),
      icon: IconUser,
      disabled: false,
    },
    {
      key: 'aide' as RouteKey,
      label: t('navAide'),
      icon: IconHelpCircle,
      disabled: false,
    },
  ]

  const estimatedSpeed = mode ? profileSettings.speeds[mode] : null

  const isFormReady = useMemo(() => {
    if (!mode || !tripType) {
      return false
    }

    if (!start.trim()) {
      return false
    }

    if (tripType === 'oneway') {
      return Boolean(end.trim())
    }

    return typeof distance === 'number' && distance > 0
  }, [distance, end, mode, start, tripType])

  const handleCalculate = () => {
    if (!isFormReady) {
      return
    }

    setHasRoute(true)
    handleNavigate('carte')
  }

  const handleTypeChange = (value: string) => {
    setTripType(value as TripType)
    setEnd('')
    setDistance('')
  }

  const handleSpeedChange = (targetMode: Mode, value: number | '') => {
    if (typeof value !== 'number') {
      return
    }

    const range = speedRanges[targetMode]
    setProfileSettings((current) => ({
      ...current,
      speeds: {
        ...current.speeds,
        [targetMode]: clamp(value, range.min, range.max),
      },
    }))
  }

  const handleResetProfiles = () => {
    setProfileSettings(defaultProfileSettings)
  }

  const mainPadding = route === 'carte' ? 0 : isDesktop ? '32px' : '24px 16px'
  const mapPanelHeight = isDesktop
    ? `calc(100vh - ${headerHeight + 120}px)`
    : `calc(100vh - ${headerHeight + footerHeight + 160}px)`

  const renderPlanifier = () => (
    <Container size={contentSize} py={isDesktop ? 'xl' : 'lg'}>
      <Stack gap={isDesktop ? 'xl' : 'lg'}>
        <Stack gap={4}>
          <Title order={2}>{t('planTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('planSubtitle')}
          </Text>
        </Stack>

        <Stack gap={isDesktop ? 'xl' : 'lg'}>
          <Paper
            withBorder
            radius="md"
            p={isDesktop ? 'xl' : 'lg'}
            style={{
              backgroundColor:
                colorScheme === 'dark'
                  ? theme.colors.gray[8]
                  : theme.colors.gray[0],
            }}
          >
            <Stack gap="md">
              <Text fw={600}>{t('planGroupTitle')}</Text>
              <Stack gap={6}>
                <Text size="sm" c="dimmed">
                  {t('modeLabel')}
                </Text>
                <SegmentedControl
                  fullWidth
                  radius="xl"
                  value={mode ?? ''}
                  onChange={(value) => setMode(value as Mode)}
                  data={[
                    { label: t('modeWalk'), value: 'walk' },
                    { label: t('modeBike'), value: 'bike' },
                    { label: t('modeEbike'), value: 'ebike' },
                  ]}
                />
              </Stack>

              <Stack gap={6}>
                <Text size="sm" c="dimmed">
                  {t('typeLabel')}
                </Text>
                <SegmentedControl
                  fullWidth
                  radius="xl"
                  value={tripType ?? ''}
                  onChange={handleTypeChange}
                  data={[
                    { label: t('typeOneWay'), value: 'oneway' },
                    { label: t('typeLoop'), value: 'loop' },
                  ]}
                />
              </Stack>

              {!tripType && (
                <Text size="sm" c="dimmed">
                  {t('typeHint')}
                </Text>
              )}
            </Stack>
          </Paper>

          <Transition
            mounted={tripType === 'oneway'}
            transition="fade"
            duration={220}
            timingFunction="ease"
          >
            {(styles) => (
              <div style={styles}>
                <Paper withBorder radius="md" p={isDesktop ? 'lg' : 'md'}>
                  <Stack gap="sm">
                    <TextInput
                      label={t('fieldStart')}
                      placeholder={t('fieldStartPlaceholder')}
                      value={start}
                      onChange={(event) => setStart(event.currentTarget.value)}
                      withAsterisk
                    />
                    <TextInput
                      label={t('fieldEnd')}
                      placeholder={t('fieldEndPlaceholder')}
                      value={end}
                      onChange={(event) => setEnd(event.currentTarget.value)}
                      withAsterisk
                    />
                  </Stack>
                </Paper>
              </div>
            )}
          </Transition>

          <Transition
            mounted={tripType === 'loop'}
            transition="fade"
            duration={220}
            timingFunction="ease"
          >
            {(styles) => (
              <div style={styles}>
                <Paper withBorder radius="md" p={isDesktop ? 'lg' : 'md'}>
                  <Stack gap="sm">
                    <TextInput
                      label={t('fieldStart')}
                      placeholder={t('fieldStartPlaceholder')}
                      value={start}
                      onChange={(event) => setStart(event.currentTarget.value)}
                      withAsterisk
                    />
                    <NumberInput
                      label={t('fieldDistance')}
                      placeholder={t('fieldDistancePlaceholder')}
                      value={distance}
                      onChange={(value) =>
                        setDistance(typeof value === 'number' ? value : '')
                      }
                      min={1}
                      max={300}
                      hideControls
                      withAsterisk
                    />
                  </Stack>
                </Paper>
              </div>
            )}
          </Transition>

          <Stack gap="xs" align={isDesktop ? 'flex-end' : 'stretch'}>
            <Text size="sm" c="dimmed">
              {t('ctaReady')}
            </Text>
            <Button
              onClick={handleCalculate}
              disabled={!isFormReady}
              size="md"
              fullWidth={!isDesktop}
            >
              {t('ctaCalculate')}
            </Button>
          </Stack>
        </Stack>

        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('speedEstimateLabel')}
              </Text>
              <Text fw={600} size="sm">
                {estimatedSpeed !== null
                  ? t('speedEstimateInline', {
                      value: estimatedSpeed,
                    })
                  : t('speedEstimateEmpty')}
              </Text>
            </Stack>
            <Button variant="subtle" onClick={() => handleNavigate('profils')}>
              {t('speedEstimateEdit')}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Container>
  )

  const renderCarte = () => (
    <Box
      style={{
        padding: mainPadding,
        minHeight: `calc(100vh - ${headerHeight + footerHeight}px)`,
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>{t('mapTitle')}</Title>
            <Text size="sm" c="dimmed">
              {hasRoute ? t('mapSubtitleReady') : t('mapSubtitleEmpty')}
            </Text>
          </Stack>
          <Button variant="outline" onClick={() => handleNavigate('planifier')}>
            {t('mapBackToPlan')}
          </Button>
        </Group>

        {!hasRoute && (
          <Paper
            withBorder
            radius="md"
            p="xl"
            style={{
              minHeight: isDesktop ? 360 : 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <Stack gap={8} align="center">
              <Title order={4}>{t('mapPlaceholderTitle')}</Title>
              <Text size="sm" c="dimmed">
                {t('mapPlaceholderBody')}
              </Text>
              <Button onClick={() => handleNavigate('planifier')}>
                {t('mapBackToPlan')}
              </Button>
            </Stack>
          </Paper>
        )}

        {hasRoute && (
          <Group align="stretch" wrap="nowrap" gap="lg">
            <Paper
              withBorder
              radius="md"
              p={0}
              style={{
                flex: 1,
                minHeight: mapPanelHeight,
                backgroundColor:
                  colorScheme === 'dark'
                    ? theme.colors.gray[8]
                    : theme.colors.gray[0],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="sm" c="dimmed">
                {t('mapPlaceholderCanvas')}
              </Text>
            </Paper>
            {isDesktop && (
              <Paper withBorder radius="md" p="md" style={{ width: 320 }}>
                <Stack gap="md">
                  <Text fw={600}>{t('mapSummaryTitle')}</Text>
                  <Stack gap={6}>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {t('mapSummaryDistance')}
                      </Text>
                      <Text size="sm" fw={600}>
                        {typeof distance === 'number'
                          ? `${distance} ${t('unitKm')}`
                          : t('placeholderValue')}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {t('mapSummaryDuration')}
                      </Text>
                      <Text size="sm" fw={600}>
                        {t('placeholderValue')}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {t('mapSummaryElevation')}
                      </Text>
                      <Text size="sm" fw={600}>
                        {t('placeholderValue')}
                      </Text>
                    </Group>
                  </Stack>
                  <Button variant="light" onClick={() => handleNavigate('planifier')}>
                    {t('mapBackToPlan')}
                  </Button>
                </Stack>
              </Paper>
            )}
          </Group>
        )}
      </Stack>

      {!isDesktop && hasRoute && (
        <Paper
          withBorder
          radius="md"
          shadow="sm"
          p="sm"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: footerHeight + 12,
            backgroundColor: surfaceColor,
          }}
        >
          <Tabs defaultValue="summary" keepMounted={false}>
            <Tabs.List grow>
              <Tabs.Tab value="summary">{t('tabSummary')}</Tabs.Tab>
              <Tabs.Tab value="steps">{t('tabSteps')}</Tabs.Tab>
              <Tabs.Tab value="pois">{t('tabPois')}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="summary" pt="xs">
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  {t('mapSummaryTitle')}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('mapSummaryPlaceholder')}
                </Text>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="steps" pt="xs">
              <Text size="sm" c="dimmed">
                {t('stepsPlaceholder')}
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="pois" pt="xs">
              <Text size="sm" c="dimmed">
                {t('poisPlaceholder')}
              </Text>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      )}
    </Box>
  )

  const renderProfils = () => (
    <Container size={contentSize} py={isDesktop ? 'lg' : 'md'}>
      <Stack gap={isDesktop ? 'xl' : 'lg'}>
        <Stack gap={4}>
          <Title order={2}>{t('profilesTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('profilesSubtitle')}
          </Text>
        </Stack>

        <Paper withBorder radius="md" p={isDesktop ? 'lg' : 'md'}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>{t('profileWalkTitle')}</Text>
              <Text size="sm" c="dimmed">
                {profileSettings.speeds.walk} {t('unitKmh')}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('profileSpeedHint')}
            </Text>
            <Slider
              min={speedRanges.walk.min}
              max={speedRanges.walk.max}
              step={speedRanges.walk.step}
              value={profileSettings.speeds.walk}
              onChange={(value) => handleSpeedChange('walk', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.walk}
                onChange={(value) => handleSpeedChange('walk', value)}
                min={speedRanges.walk.min}
                max={speedRanges.walk.max}
                step={speedRanges.walk.step}
                precision={speedRanges.walk.precision}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={isDesktop ? 'lg' : 'md'}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>{t('profileBikeTitle')}</Text>
              <Text size="sm" c="dimmed">
                {profileSettings.speeds.bike} {t('unitKmh')}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('profileSpeedHint')}
            </Text>
            <Slider
              min={speedRanges.bike.min}
              max={speedRanges.bike.max}
              step={speedRanges.bike.step}
              value={profileSettings.speeds.bike}
              onChange={(value) => handleSpeedChange('bike', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.bike}
                onChange={(value) => handleSpeedChange('bike', value)}
                min={speedRanges.bike.min}
                max={speedRanges.bike.max}
                step={speedRanges.bike.step}
                precision={speedRanges.bike.precision}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={isDesktop ? 'lg' : 'md'}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={600}>{t('profileEbikeTitle')}</Text>
              <Text size="sm" c="dimmed">
                {profileSettings.speeds.ebike} {t('unitKmh')}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('profileSpeedHint')}
            </Text>
            <Slider
              min={speedRanges.ebike.min}
              max={speedRanges.ebike.max}
              step={speedRanges.ebike.step}
              value={profileSettings.speeds.ebike}
              onChange={(value) => handleSpeedChange('ebike', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.ebike}
                onChange={(value) => handleSpeedChange('ebike', value)}
                min={speedRanges.ebike.min}
                max={speedRanges.ebike.max}
                step={speedRanges.ebike.step}
                precision={speedRanges.ebike.precision}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
            <Stack gap={6} pt="xs">
              <Text size="sm" c="dimmed">
                {t('profileAssistLabel')}
              </Text>
              <SegmentedControl
                fullWidth
                radius="xl"
                value={profileSettings.ebikeAssist}
                onChange={(value) =>
                  setProfileSettings((current) => ({
                    ...current,
                    ebikeAssist: value as AssistLevel,
                  }))
                }
                data={[
                  { label: t('assistLow'), value: 'low' },
                  { label: t('assistMedium'), value: 'medium' },
                  { label: t('assistHigh'), value: 'high' },
                ]}
              />
            </Stack>
          </Stack>
        </Paper>

        <Stack align={isDesktop ? 'flex-end' : 'stretch'}>
          <Button
            variant="outline"
            onClick={handleResetProfiles}
            fullWidth={!isDesktop}
          >
            {t('profilesReset')}
          </Button>
        </Stack>
      </Stack>
    </Container>
  )

  const renderAide = () => (
    <Container size={contentSize} py={isDesktop ? 'lg' : 'md'}>
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>{t('helpTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('helpSubtitle')}
          </Text>
        </Stack>

        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>{t('helpDiagnosticTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('helpDiagnosticBody')}
            </Text>
            <Button variant="light" disabled>
              {t('helpExportDiagnostic')}
            </Button>
            <Text size="xs" c="dimmed">
              {t('helpExportPlaceholder')}
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>{t('helpMentionsTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('helpMentionsBody')}
            </Text>
            <Text size="sm">{t('helpMentionsEmpty')}</Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )

  const handleNavigate = (next: RouteKey) => {
    if (next === 'carte' && !hasRoute) {
      return
    }
    navigate(next)
  }

  const mainContent = (() => {
    switch (route) {
      case 'carte':
        return renderCarte()
      case 'profils':
        return renderProfils()
      case 'aide':
        return renderAide()
      default:
        return renderPlanifier()
    }
  })()

  return (
    <AppShell
      padding={0}
      header={{ height: headerHeight }}
      footer={isDesktop ? undefined : { height: footerHeight }}
    >
      <AppShell.Header
        style={{
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: surfaceColor,
        }}
      >
        <Container size={contentSize} h="100%">
          <Group justify="space-between" align="center" h="100%">
            <Group gap="md" align="center">
              <Stack gap={2}>
                <Text fw={600}>{t('appName')}</Text>
                {isDesktop && (
                  <Text size="xs" c="dimmed">
                    {t('tagline')}
                  </Text>
                )}
              </Stack>
              {isDesktop && (
                <Tabs
                  value={route}
                  onChange={(value) =>
                    value ? handleNavigate(value as RouteKey) : null
                  }
                  variant="pills"
                  radius="xl"
                >
                  <Tabs.List>
                    {navItems.map((item) => (
                      <Tabs.Tab
                        key={item.key}
                        value={item.key}
                        disabled={item.disabled}
                      >
                        {item.label}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs>
              )}
            </Group>

            <Group gap="sm" align="center">
              <SegmentedControl
                size="xs"
                radius="xl"
                value={language}
                onChange={(value) => i18n.changeLanguage(value)}
                data={[
                  { label: 'FR', value: 'fr' },
                  { label: 'EN', value: 'en' },
                ]}
              />
              <ActionIcon
                variant="subtle"
                onClick={() =>
                  setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
                }
                aria-label={t('themeToggleLabel')}
              >
                {colorScheme === 'dark' ? (
                  <IconSun size={18} />
                ) : (
                  <IconMoon size={18} />
                )}
              </ActionIcon>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>{mainContent}</AppShell.Main>

      {!isDesktop && (
        <AppShell.Footer
          style={{
            borderTop: `1px solid ${borderColor}`,
            backgroundColor: surfaceColor,
          }}
        >
          <Group justify="space-around" align="center" h="100%" px="md">
            {navItems.map((item) => {
              const isActive = route === item.key
              const Icon = item.icon
              const color = item.disabled
                ? theme.colors.gray[4]
                : isActive
                  ? theme.colors.blue[6]
                  : theme.colors.gray[6]

              return (
                <UnstyledButton
                  key={item.key}
                  onClick={() => !item.disabled && handleNavigate(item.key)}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color,
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <Icon size={20} />
                  <Text size="xs">{item.label}</Text>
                </UnstyledButton>
              )
            })}
          </Group>
        </AppShell.Footer>
      )}
    </AppShell>
  )
}
