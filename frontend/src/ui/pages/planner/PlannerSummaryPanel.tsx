import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Transition,
  type MantineTheme,
} from '@mantine/core'
import { IconCheck, IconRoute } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export type PlannerHelperItem = {
  key: string
  show: boolean
  label: string
}

type PlannerSummaryPanelProps = {
  isDesktop: boolean
  isDarkTheme: boolean
  theme: MantineTheme
  helperHasMissing: boolean
  helperItems: PlannerHelperItem[]
  helperReadyLabel: string
  isFormReady: boolean
  isRouteLoading: boolean
  onCalculate: () => void
  ctaLabel: string
  routeErrorMessage: string | null
}

export default function PlannerSummaryPanel({
  isDesktop,
  isDarkTheme,
  theme,
  helperHasMissing,
  helperItems,
  helperReadyLabel,
  isFormReady,
  isRouteLoading,
  onCalculate,
  ctaLabel,
  routeErrorMessage,
}: PlannerSummaryPanelProps) {
  const { t } = useTranslation()

  return (
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
  )
}
