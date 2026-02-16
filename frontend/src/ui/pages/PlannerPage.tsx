import {
  ActionIcon,
  Box,
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Transition,
  type MantineTheme,
} from '@mantine/core'
import {
  IconArrowRight,
  IconBike,
  IconBolt,
  IconCheck,
  IconMapPinPlus,
  IconRefresh,
  IconRoute,
  IconWalk,
  IconX,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../../components/PlaceSearchInput'
import type { Mode, PlaceCandidate, TripType } from '../../features/routing/domain'

type PlannerHelperItem = {
  key: string
  show: boolean
  label: string
}

type PlannerPageProps = {
  contentSize: string
  isDesktop: boolean
  isDarkTheme: boolean
  theme: MantineTheme
  mode: Mode | null
  tripType: TripType | null
  showLocationInputs: boolean
  panelStackStyle: React.CSSProperties
  getPanelStyle: (isActive: boolean) => React.CSSProperties
  onModeChange: (value: string) => void
  onTypeChange: (value: string) => void
  onewayStartValue: string
  onOnewayStartValueChange: (value: string) => void
  onOnewayStartPlaceSelect: (place: PlaceCandidate | null) => void
  canQuickSaveOnewayStart: boolean
  onSaveQuickOnewayStart: () => void
  endValue: string
  onEndValueChange: (value: string) => void
  onEndPlaceSelect: (place: PlaceCandidate | null) => void
  canQuickSaveOnewayEnd: boolean
  onSaveQuickOnewayEnd: () => void
  loopStartValue: string
  onLoopStartValueChange: (value: string) => void
  onLoopStartPlaceSelect: (place: PlaceCandidate | null) => void
  canQuickSaveLoopStart: boolean
  onSaveQuickLoopStart: () => void
  targetDistanceKm: number | ''
  onTargetDistanceChange: (value: number | string) => void
  helperHasMissing: boolean
  helperItems: PlannerHelperItem[]
  helperReadyLabel: string
  isFormReady: boolean
  isRouteLoading: boolean
  onCalculate: () => void
  ctaLabel: string
  routeErrorMessage: string | null
}

export default function PlannerPage({
  contentSize,
  isDesktop,
  isDarkTheme,
  theme,
  mode,
  tripType,
  showLocationInputs,
  panelStackStyle,
  getPanelStyle,
  onModeChange,
  onTypeChange,
  onewayStartValue,
  onOnewayStartValueChange,
  onOnewayStartPlaceSelect,
  canQuickSaveOnewayStart,
  onSaveQuickOnewayStart,
  endValue,
  onEndValueChange,
  onEndPlaceSelect,
  canQuickSaveOnewayEnd,
  onSaveQuickOnewayEnd,
  loopStartValue,
  onLoopStartValueChange,
  onLoopStartPlaceSelect,
  canQuickSaveLoopStart,
  onSaveQuickLoopStart,
  targetDistanceKm,
  onTargetDistanceChange,
  helperHasMissing,
  helperItems,
  helperReadyLabel,
  isFormReady,
  isRouteLoading,
  onCalculate,
  ctaLabel,
  routeErrorMessage,
}: PlannerPageProps) {
  const { t } = useTranslation()

  return (
    <Container size={contentSize} py="xl">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>{t('planTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('planSubtitle')}
          </Text>
        </Stack>

        <Stack gap={isDesktop ? 'md' : 'lg'}>
          <Paper
            withBorder
            radius="md"
            p={isDesktop ? 'xl' : 'lg'}
            style={{
              background: isDarkTheme
                ? 'linear-gradient(165deg, rgba(31,36,48,0.98) 0%, rgba(25,31,42,0.94) 100%)'
                : 'linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(245,248,252,0.96) 100%)',
            }}
          >
            <Stack gap={isDesktop ? 'md' : 'lg'}>
              <Text fw={600}>{t('planGroupTitle')}</Text>
              <Stack gap={isDesktop ? 6 : 8}>
                <Text size="sm" c="dimmed">
                  {t('modeLabel')}
                </Text>
                <SegmentedControl
                  fullWidth
                  radius="xl"
                  value={mode ?? ''}
                  onChange={onModeChange}
                  data={[
                    {
                      label: (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <IconWalk size={14} />
                          <span>{t('modeWalk')}</span>
                        </Group>
                      ),
                      value: 'walk',
                    },
                    {
                      label: (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <IconBike size={14} />
                          <span>{t('modeBike')}</span>
                        </Group>
                      ),
                      value: 'bike',
                    },
                    {
                      label: (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <IconBolt size={14} />
                          <span>{t('modeEbike')}</span>
                        </Group>
                      ),
                      value: 'ebike',
                    },
                  ]}
                />
              </Stack>

              <Stack gap={isDesktop ? 6 : 8}>
                <Text size="sm" c="dimmed">
                  {t('typeLabel')}
                </Text>
                <SegmentedControl
                  fullWidth
                  radius="xl"
                  value={tripType ?? ''}
                  onChange={onTypeChange}
                  data={[
                    {
                      label: (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <IconArrowRight size={14} />
                          <span>{t('typeOneWay')}</span>
                        </Group>
                      ),
                      value: 'oneway',
                    },
                    {
                      label: (
                        <Group gap={6} justify="center" wrap="nowrap">
                          <IconRefresh size={14} />
                          <span>{t('typeLoop')}</span>
                        </Group>
                      ),
                      value: 'loop',
                    },
                  ]}
                />
              </Stack>
            </Stack>
          </Paper>

          {!showLocationInputs && (
            <Text size="sm" c="dimmed">
              {t('planSelectModeTypeHint')}
            </Text>
          )}

          {showLocationInputs && (
            <div style={panelStackStyle}>
              <div style={getPanelStyle(tripType === 'oneway')} aria-hidden={tripType !== 'oneway'}>
                <Paper
                  withBorder
                  radius="md"
                  p="lg"
                  style={{
                    borderColor: tripType === 'oneway' ? theme.colors.blue[5] : undefined,
                    background:
                      tripType === 'oneway'
                        ? isDarkTheme
                          ? 'linear-gradient(160deg, rgba(26,41,67,0.68) 0%, rgba(20,31,50,0.72) 100%)'
                          : 'linear-gradient(160deg, rgba(235,245,255,0.92) 0%, rgba(245,250,255,0.96) 100%)'
                        : undefined,
                  }}
                >
                  <Stack gap={isDesktop ? 'sm' : 'md'}>
                    <PlaceSearchInput
                      label={t('fieldStart')}
                      placeholder={t('fieldStartPlaceholder')}
                      value={onewayStartValue}
                      onValueChange={onOnewayStartValueChange}
                      onPlaceSelect={onOnewayStartPlaceSelect}
                      disabled={tripType !== 'oneway'}
                      suppressInitialSearch
                      testId="plan-start"
                    />
                    {canQuickSaveOnewayStart && (
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconMapPinPlus size={14} />}
                        onClick={onSaveQuickOnewayStart}
                      >
                        {t('addressBookQuickSave')}
                      </Button>
                    )}
                    <PlaceSearchInput
                      label={t('fieldEnd')}
                      placeholder={t('fieldEndPlaceholder')}
                      value={endValue}
                      onValueChange={onEndValueChange}
                      onPlaceSelect={onEndPlaceSelect}
                      suppressInitialSearch
                      testId="plan-end"
                    />
                    {canQuickSaveOnewayEnd && (
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconMapPinPlus size={14} />}
                        onClick={onSaveQuickOnewayEnd}
                      >
                        {t('addressBookQuickSave')}
                      </Button>
                    )}
                  </Stack>
                </Paper>
              </div>

              <div style={getPanelStyle(tripType === 'loop')} aria-hidden={tripType !== 'loop'}>
                <Paper
                  withBorder
                  radius="md"
                  p="lg"
                  style={{
                    borderColor: tripType === 'loop' ? theme.colors.teal[5] : undefined,
                    background:
                      tripType === 'loop'
                        ? isDarkTheme
                          ? 'linear-gradient(160deg, rgba(24,62,61,0.62) 0%, rgba(21,41,52,0.72) 100%)'
                          : 'linear-gradient(160deg, rgba(232,250,243,0.94) 0%, rgba(244,255,250,0.96) 100%)'
                        : undefined,
                  }}
                >
                  <Stack gap={isDesktop ? 'sm' : 'md'}>
                    <PlaceSearchInput
                      label={t('fieldStart')}
                      placeholder={t('fieldStartPlaceholder')}
                      value={loopStartValue}
                      onValueChange={onLoopStartValueChange}
                      onPlaceSelect={onLoopStartPlaceSelect}
                      disabled={tripType !== 'loop'}
                      suppressInitialSearch
                      testId="plan-start"
                    />
                    {canQuickSaveLoopStart && (
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<IconMapPinPlus size={14} />}
                        onClick={onSaveQuickLoopStart}
                      >
                        {t('addressBookQuickSave')}
                      </Button>
                    )}
                    <NumberInput
                      label={t('fieldDistance')}
                      placeholder={t('fieldDistancePlaceholder')}
                      value={targetDistanceKm}
                      onChange={onTargetDistanceChange}
                      min={1}
                      max={300}
                      hideControls
                      rightSection={
                        targetDistanceKm === '' ? null : (
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onTargetDistanceChange('')}
                            aria-label={t('inputClearLabel')}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        )
                      }
                      rightSectionWidth={32}
                    />
                    <Text size="xs" c="dimmed">
                      {t('loopDistanceHelp')}
                    </Text>
                  </Stack>
                </Paper>
              </div>
            </div>
          )}

          <Paper
            withBorder
            radius="md"
            p={isDesktop ? 'lg' : 'md'}
            style={{
              alignSelf: 'stretch',
              background: isDarkTheme
                ? 'linear-gradient(165deg, rgba(28,33,45,0.98) 0%, rgba(22,29,39,0.94) 100%)'
                : 'linear-gradient(165deg, rgba(255,255,255,0.99) 0%, rgba(247,250,255,0.96) 100%)',
            }}
          >
            <Stack
              gap={isDesktop ? 'xs' : 'sm'}
              align="center"
              style={{ maxWidth: 760, marginInline: 'auto', width: '100%' }}
            >
              {helperHasMissing ? (
                <Stack gap={isDesktop ? 4 : 6} align="center" style={{ alignSelf: 'stretch' }}>
                  <Text size={isDesktop ? 'md' : 'sm'} fw={600} ta="center" c="dimmed">
                    {t('helper.title.pending')}
                  </Text>
                  <Box
                    component="ul"
                    style={{
                      margin: 0,
                      paddingLeft: 0,
                      listStylePosition: 'inside',
                      textAlign: 'center',
                    }}
                  >
                    {helperItems.map((item) => (
                      <Transition key={item.key} mounted={item.show} transition="fade" duration={200}>
                        {(styles) => (
                          <Text
                            component="li"
                            size={isDesktop ? 'md' : 'sm'}
                            c="dimmed"
                            ta="center"
                            style={styles}
                          >
                            {item.label}
                          </Text>
                        )}
                      </Transition>
                    ))}
                  </Box>
                </Stack>
              ) : (
                <Group gap={8} align="center" justify="center" style={{ alignSelf: 'center' }}>
                  <IconCheck size={18} color={theme.colors.green[6]} />
                  <Text size={isDesktop ? 'md' : 'sm'} fw={600} ta="center" c="green.7">
                    {helperReadyLabel}
                  </Text>
                </Group>
              )}
              <Button
                onClick={onCalculate}
                disabled={!isFormReady || isRouteLoading}
                loading={isRouteLoading}
                size="md"
                fullWidth={!isDesktop}
                leftSection={<IconRoute size={16} />}
              >
                {ctaLabel}
              </Button>
              {routeErrorMessage && (
                <Text size="sm" c="red.6" ta="center">
                  {routeErrorMessage}
                </Text>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </Container>
  )
}

