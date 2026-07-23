import { Group, NumberInput, SegmentedControl, Slider, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import {
  normalizeNumericInput,
  speedRanges,
  type AssistLevel,
  type Mode,
  type ProfileSettings,
} from '../../features/routing/domain'

type ProfileSettingsEditorProps = {
  settings: ProfileSettings
  onChange: (settings: ProfileSettings) => void
}

export default function ProfileSettingsEditor({ settings, onChange }: ProfileSettingsEditorProps) {
  const { t } = useTranslation()

  const handleSpeedChange = (mode: Mode, value: number | '') => {
    if (value === '') {
      return
    }

    onChange({
      ...settings,
      speeds: {
        ...settings.speeds,
        [mode]: value,
      },
    })
  }

  const speedFields: Array<{
    mode: Mode
    titleKey: string
    inputLabelKey: string
  }> = [
    { mode: 'walk', titleKey: 'profileWalkTitle', inputLabelKey: 'profileWalkSpeedInputLabel' },
    { mode: 'bike', titleKey: 'profileBikeTitle', inputLabelKey: 'profileBikeSpeedInputLabel' },
    { mode: 'ebike', titleKey: 'profileEbikeTitle', inputLabelKey: 'profileEbikeSpeedInputLabel' },
  ]

  return (
    <Stack gap="lg">
      {speedFields.map(({ mode, titleKey, inputLabelKey }) => (
        <Stack key={mode} gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t(titleKey)}</Text>
            <Text size="sm" c="dimmed">
              {settings.speeds[mode]} {t('unitKmh')}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {t('profileSpeedHint')}
          </Text>
          <Slider
            min={speedRanges[mode].min}
            max={speedRanges[mode].max}
            step={speedRanges[mode].step}
            value={settings.speeds[mode]}
            onChange={(value) => handleSpeedChange(mode, value)}
            label={(value) => `${value} ${t('unitKmh')}`}
          />
          <Group gap="xs" align="center">
            <NumberInput
              aria-label={t(inputLabelKey)}
              value={settings.speeds[mode]}
              onChange={(value) => handleSpeedChange(mode, normalizeNumericInput(value))}
              min={speedRanges[mode].min}
              max={speedRanges[mode].max}
              step={speedRanges[mode].step}
              hideControls
              w={120}
            />
            <Text size="sm" c="dimmed">
              {t('unitKmh')}
            </Text>
          </Group>
        </Stack>
      ))}

      <Stack gap="xs">
        <Text fw={600}>{t('profileAssistLabel')}</Text>
        <SegmentedControl
          fullWidth
          radius="xl"
          value={settings.ebikeAssist}
          onChange={(value) =>
            onChange({
              ...settings,
              ebikeAssist: value as AssistLevel,
            })
          }
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
          {settings.ebikeAssist === 'low'
            ? t('profileAssistDescriptionLow')
            : settings.ebikeAssist === 'high'
              ? t('profileAssistDescriptionHigh')
              : t('profileAssistDescriptionMedium')}
        </Text>
      </Stack>
    </Stack>
  )
}
