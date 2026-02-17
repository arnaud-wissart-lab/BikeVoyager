import {
  ActionIcon,
  Button,
  NumberInput,
  Paper,
  Stack,
  Text,
  type MantineTheme,
} from '@mantine/core'
import { IconMapPinPlus, IconX } from '@tabler/icons-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../../../components/PlaceSearchInput'
import type { PlaceCandidate, TripType } from '../../../features/routing/domain'

type PlannerLocationPanelsProps = {
  isDesktop: boolean
  isDarkTheme: boolean
  theme: MantineTheme
  tripType: TripType | null
  panelStackStyle: CSSProperties
  getPanelStyle: (isActive: boolean) => CSSProperties
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
}

export default function PlannerLocationPanels({
  isDesktop,
  isDarkTheme,
  theme,
  tripType,
  panelStackStyle,
  getPanelStyle,
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
}: PlannerLocationPanelsProps) {
  const { t } = useTranslation()

  return (
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
  )
}
