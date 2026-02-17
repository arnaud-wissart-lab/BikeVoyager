import { Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import {
  IconArrowRight,
  IconBike,
  IconBolt,
  IconRefresh,
  IconWalk,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { Mode, TripType } from '../../../features/routing/domain'

type PlannerModeTypePanelProps = {
  isDesktop: boolean
  isDarkTheme: boolean
  mode: Mode | null
  tripType: TripType | null
  onModeChange: (value: string) => void
  onTypeChange: (value: string) => void
}

export default function PlannerModeTypePanel({
  isDesktop,
  isDarkTheme,
  mode,
  tripType,
  onModeChange,
  onTypeChange,
}: PlannerModeTypePanelProps) {
  const { t } = useTranslation()

  return (
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
  )
}
