import { Container, Stack, Text, Title, type MantineTheme } from '@mantine/core'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Mode, PlaceCandidate, TripType } from '../../features/routing/domain'
import PlannerLocationPanels from './planner/PlannerLocationPanels'
import PlannerModeTypePanel from './planner/PlannerModeTypePanel'
import PlannerSummaryPanel, { type PlannerHelperItem } from './planner/PlannerSummaryPanel'

type PlannerPageProps = {
  contentSize: string
  isDesktop: boolean
  isDarkTheme: boolean
  theme: MantineTheme
  mode: Mode | null
  tripType: TripType | null
  showLocationInputs: boolean
  panelStackStyle: CSSProperties
  getPanelStyle: (isActive: boolean) => CSSProperties
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
          <PlannerModeTypePanel
            isDesktop={isDesktop}
            isDarkTheme={isDarkTheme}
            mode={mode}
            tripType={tripType}
            onModeChange={onModeChange}
            onTypeChange={onTypeChange}
          />

          {!showLocationInputs && (
            <Text size="sm" c="dimmed">
              {t('planSelectModeTypeHint')}
            </Text>
          )}

          {showLocationInputs && (
            <PlannerLocationPanels
              isDesktop={isDesktop}
              isDarkTheme={isDarkTheme}
              theme={theme}
              tripType={tripType}
              panelStackStyle={panelStackStyle}
              getPanelStyle={getPanelStyle}
              onewayStartValue={onewayStartValue}
              onOnewayStartValueChange={onOnewayStartValueChange}
              onOnewayStartPlaceSelect={onOnewayStartPlaceSelect}
              canQuickSaveOnewayStart={canQuickSaveOnewayStart}
              onSaveQuickOnewayStart={onSaveQuickOnewayStart}
              endValue={endValue}
              onEndValueChange={onEndValueChange}
              onEndPlaceSelect={onEndPlaceSelect}
              canQuickSaveOnewayEnd={canQuickSaveOnewayEnd}
              onSaveQuickOnewayEnd={onSaveQuickOnewayEnd}
              loopStartValue={loopStartValue}
              onLoopStartValueChange={onLoopStartValueChange}
              onLoopStartPlaceSelect={onLoopStartPlaceSelect}
              canQuickSaveLoopStart={canQuickSaveLoopStart}
              onSaveQuickLoopStart={onSaveQuickLoopStart}
              targetDistanceKm={targetDistanceKm}
              onTargetDistanceChange={onTargetDistanceChange}
            />
          )}

          <PlannerSummaryPanel
            isDesktop={isDesktop}
            isDarkTheme={isDarkTheme}
            theme={theme}
            helperHasMissing={helperHasMissing}
            helperItems={helperItems}
            helperReadyLabel={helperReadyLabel}
            isFormReady={isFormReady}
            isRouteLoading={isRouteLoading}
            onCalculate={onCalculate}
            ctaLabel={ctaLabel}
            routeErrorMessage={routeErrorMessage}
          />
        </Stack>
      </Stack>
    </Container>
  )
}
