import {
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import {
  normalizeNumericInput,
  speedRanges,
  type AssistLevel,
  type Mode,
  type ProfileSettings,
} from '../../features/routing/domain'

type ProfilesPageProps = {
  contentSize: string
  isDesktop: boolean
  profileSettings: ProfileSettings
  onSpeedChange: (targetMode: Mode, value: number | '') => void
  onAssistChange: (value: AssistLevel) => void
  onReset: () => void
}

export default function ProfilesPage({
  contentSize,
  isDesktop,
  profileSettings,
  onSpeedChange,
  onAssistChange,
  onReset,
}: ProfilesPageProps) {
  const { t } = useTranslation()

  return (
    <Container size={contentSize} py="lg">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>{t('profilesTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('profilesSubtitle')}
          </Text>
        </Stack>

        <Paper withBorder radius="md" p="lg">
          <Stack gap={isDesktop ? 'sm' : 'md'}>
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
              onChange={(value) => onSpeedChange('walk', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.walk}
                onChange={(value) => onSpeedChange('walk', normalizeNumericInput(value))}
                min={speedRanges.walk.min}
                max={speedRanges.walk.max}
                step={speedRanges.walk.step}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="lg">
          <Stack gap={isDesktop ? 'sm' : 'md'}>
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
              onChange={(value) => onSpeedChange('bike', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.bike}
                onChange={(value) => onSpeedChange('bike', normalizeNumericInput(value))}
                min={speedRanges.bike.min}
                max={speedRanges.bike.max}
                step={speedRanges.bike.step}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="lg">
          <Stack gap={isDesktop ? 'sm' : 'md'}>
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
              onChange={(value) => onSpeedChange('ebike', value)}
              label={(value) => `${value} ${t('unitKmh')}`}
            />
            <Group gap="xs" align="center">
              <NumberInput
                value={profileSettings.speeds.ebike}
                onChange={(value) => onSpeedChange('ebike', normalizeNumericInput(value))}
                min={speedRanges.ebike.min}
                max={speedRanges.ebike.max}
                step={speedRanges.ebike.step}
                hideControls
                w={120}
              />
              <Text size="sm" c="dimmed">
                {t('unitKmh')}
              </Text>
            </Group>
            <Stack gap={isDesktop ? 6 : 8} pt="xs">
              <Text size="sm" c="dimmed">
                {t('profileAssistLabel')}
              </Text>
              <SegmentedControl
                fullWidth
                radius="xl"
                value={profileSettings.ebikeAssist}
                onChange={(value) => onAssistChange(value as AssistLevel)}
                data={[
                  { label: t('assistLow'), value: 'low' },
                  { label: t('assistMedium'), value: 'medium' },
                  { label: t('assistHigh'), value: 'high' },
                ]}
              />
              <Text size="xs" fw={600}>
                {t('profileAssistEffectLabel')}
              </Text>
              <Text size="xs" c="dimmed">
                {profileSettings.ebikeAssist === 'low'
                  ? t('profileAssistDescriptionLow')
                  : profileSettings.ebikeAssist === 'high'
                    ? t('profileAssistDescriptionHigh')
                    : t('profileAssistDescriptionMedium')}
              </Text>
            </Stack>
          </Stack>
        </Paper>

        <Stack align={isDesktop ? 'flex-end' : 'stretch'}>
          <Button
            variant="outline"
            onClick={onReset}
            fullWidth={!isDesktop}
            leftSection={<IconRefresh size={16} />}
          >
            {t('profilesReset')}
          </Button>
        </Stack>
      </Stack>
    </Container>
  )
}

