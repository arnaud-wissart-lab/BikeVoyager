import {
  Button,
  Badge,
  Container,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconCheck, IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import {
  getActiveProfilePresetKey,
  normalizeNumericInput,
  profilePresets,
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
  onPresetApply: (settings: ProfileSettings) => void
  onReset: () => void
}

export default function ProfilesPage({
  contentSize,
  isDesktop,
  profileSettings,
  onSpeedChange,
  onAssistChange,
  onPresetApply,
  onReset,
}: ProfilesPageProps) {
  const { t } = useTranslation()
  const activePresetKey = getActiveProfilePresetKey(profileSettings)

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
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Stack gap={2}>
                <Text fw={600}>{t('profilePresetsTitle')}</Text>
                <Text size="sm" c="dimmed">
                  {t('profilePresetsSubtitle')}
                </Text>
              </Stack>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" verticalSpacing="sm">
              {profilePresets.map((preset) => {
                const isActive = activePresetKey === preset.key

                return (
                  <Paper
                    key={preset.key}
                    withBorder
                    radius="sm"
                    p="md"
                    data-testid={`profile-preset-${preset.key}`}
                  >
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start" gap="xs">
                        <Stack gap={2}>
                          <Text fw={600}>{t(preset.labelKey)}</Text>
                          <Text size="sm" c="dimmed">
                            {t(preset.descriptionKey)}
                          </Text>
                        </Stack>
                        {isActive ? (
                          <Badge variant="light" color="teal" leftSection={<IconCheck size={12} />}>
                            {t('profilePresetActive')}
                          </Badge>
                        ) : null}
                      </Group>

                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          {t('profilePresetWalkValue', {
                            value: preset.settings.speeds.walk,
                            unit: t('unitKmh'),
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('profilePresetBikeValue', {
                            value: preset.settings.speeds.bike,
                            unit: t('unitKmh'),
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('profilePresetEbikeValue', {
                            value: preset.settings.speeds.ebike,
                            unit: t('unitKmh'),
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('profilePresetAssistValue', {
                            value:
                              preset.settings.ebikeAssist === 'low'
                                ? t('assistLow')
                                : preset.settings.ebikeAssist === 'high'
                                  ? t('assistHigh')
                                  : t('assistMedium'),
                          })}
                        </Text>
                      </Stack>

                      <Button
                        mt="auto"
                        variant={isActive ? 'light' : 'outline'}
                        color={isActive ? 'teal' : undefined}
                        fullWidth
                        onClick={() => onPresetApply(preset.settings)}
                      >
                        {t('profilePresetApply')}
                      </Button>
                    </Stack>
                  </Paper>
                )
              })}
            </SimpleGrid>
          </Stack>
        </Paper>

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
                aria-label={t('profileWalkSpeedInputLabel')}
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
                aria-label={t('profileBikeSpeedInputLabel')}
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
                aria-label={t('profileEbikeSpeedInputLabel')}
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
