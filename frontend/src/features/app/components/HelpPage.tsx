import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  type MantineTheme,
} from '@mantine/core'
import { IconDatabase, IconMail, IconRoute } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { CloudDiagnostics } from '../cloudSync'
import type { ValhallaStatus } from '../domain'

type HelpPageProps = {
  contentSize: string
  isDesktop: boolean
  isDarkTheme: boolean
  isFrench: boolean
  theme: MantineTheme
  valhallaStatus: ValhallaStatus | null
  isValhallaStatusLoading: boolean
  valhallaStatusError: boolean
  valhallaUpdateAvailable: boolean
  isValhallaBuildRunning: boolean
  cloudDiagnostics: CloudDiagnostics | null
  isCloudDiagnosticsLoading: boolean
  cloudDiagnosticsError: string | null
  feedbackSubject: string
  feedbackContactEmail: string
  feedbackMessage: string
  isFeedbackSubmitting: boolean
  canSubmitFeedback: boolean
  feedbackSubmitMessage: string | null
  feedbackSubmitError: string | null
  onFeedbackSubjectChange: (value: string) => void
  onFeedbackContactEmailChange: (value: string) => void
  onFeedbackMessageChange: (value: string) => void
  onSubmitFeedback: () => void
}

export default function HelpPage({
  contentSize,
  isDesktop,
  isDarkTheme,
  isFrench,
  theme,
  valhallaStatus,
  isValhallaStatusLoading,
  valhallaStatusError,
  valhallaUpdateAvailable,
  isValhallaBuildRunning,
  cloudDiagnostics,
  isCloudDiagnosticsLoading,
  cloudDiagnosticsError,
  feedbackSubject,
  feedbackContactEmail,
  feedbackMessage,
  isFeedbackSubmitting,
  canSubmitFeedback,
  feedbackSubmitMessage,
  feedbackSubmitError,
  onFeedbackSubjectChange,
  onFeedbackContactEmailChange,
  onFeedbackMessageChange,
  onSubmitFeedback,
}: HelpPageProps) {
  const { t } = useTranslation()

  return (
    <Container size={contentSize} py="lg">
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>{t('helpTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('helpSubtitle')}
          </Text>
        </Stack>

        <Paper withBorder radius="md" p={isDesktop ? 'md' : 'lg'}>
          <Stack gap={isDesktop ? 'sm' : 'md'}>
            <Group gap="xs" align="center">
              <ThemeIcon variant="light" color="cyan" radius="xl" size="md">
                <IconMail size={16} />
              </ThemeIcon>
              <Text fw={600}>{t('helpFeedbackTitle')}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('helpFeedbackBody')}
            </Text>
            <TextInput
              label={t('helpFeedbackSubjectLabel')}
              placeholder={t('helpFeedbackSubjectPlaceholder')}
              value={feedbackSubject}
              maxLength={120}
              onChange={(event) => onFeedbackSubjectChange(event.currentTarget.value)}
            />
            <TextInput
              label={t('helpFeedbackEmailLabel')}
              placeholder={t('helpFeedbackEmailPlaceholder')}
              value={feedbackContactEmail}
              maxLength={254}
              onChange={(event) => onFeedbackContactEmailChange(event.currentTarget.value)}
            />
            <Textarea
              label={t('helpFeedbackMessageLabel')}
              placeholder={t('helpFeedbackMessagePlaceholder')}
              value={feedbackMessage}
              minRows={5}
              maxRows={10}
              autosize
              maxLength={3500}
              onChange={(event) => onFeedbackMessageChange(event.currentTarget.value)}
            />
            <Group justify={isDesktop ? 'flex-end' : 'stretch'}>
              <Button
                onClick={onSubmitFeedback}
                loading={isFeedbackSubmitting}
                disabled={!canSubmitFeedback}
                fullWidth={!isDesktop}
              >
                {t('helpFeedbackSubmit')}
              </Button>
            </Group>
            {feedbackSubmitMessage && (
              <Text size="xs" c="teal.7">
                {feedbackSubmitMessage}
              </Text>
            )}
            {feedbackSubmitError && (
              <Text size="xs" c="red.6">
                {feedbackSubmitError}
              </Text>
            )}
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={isDesktop ? 'md' : 'lg'}>
          <Stack gap={isDesktop ? 'sm' : 'md'}>
            <Stack gap={isDesktop ? 'sm' : 'md'}>
              <Group gap="xs" align="center">
                <ThemeIcon variant="light" color="blue" radius="xl" size="md">
                  <IconRoute size={16} />
                </ThemeIcon>
                <Text fw={600}>{t('helpRoutingEngineTitle')}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {t('helpRoutingEngineBody')}
              </Text>
              {isValhallaStatusLoading && (
                <Text size="sm" c="dimmed">
                  {t('helpValhallaStatusLoading')}
                </Text>
              )}
              {!isValhallaStatusLoading && valhallaStatusError && (
                <Text size="sm" c="red.6">
                  {t('helpValhallaStatusUnavailable')}
                </Text>
              )}
              {!isValhallaStatusLoading && !valhallaStatusError && valhallaStatus && (
                <Stack gap={4}>
                  <Text
                    size="sm"
                    fw={600}
                    c={valhallaStatus.ready ? 'green.7' : 'orange.7'}
                  >
                    {valhallaStatus.ready
                      ? t('helpValhallaStatusReady')
                      : t('helpValhallaStatusNotReady')}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {valhallaStatus.message}
                  </Text>
                  {valhallaStatus.build && valhallaStatus.build.state !== 'completed' && (
                    <Stack gap={4}>
                      <Group justify="space-between" align="center">
                        <Text size="xs" c="dimmed">
                          {t('helpValhallaProgressLabel')}
                        </Text>
                        <Text size="xs" fw={600}>
                          {Math.max(0, Math.min(100, valhallaStatus.build.progress_pct))}
                          %
                        </Text>
                      </Group>
                      <Box
                        style={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: isDarkTheme
                            ? theme.colors.gray[7]
                            : theme.colors.gray[2],
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          style={{
                            width: `${Math.max(0, Math.min(100, valhallaStatus.build.progress_pct))}%`,
                            height: '100%',
                            backgroundColor: theme.colors.blue[6],
                            transition: 'width 220ms ease',
                          }}
                        />
                      </Box>
                      <Text size="xs" c="dimmed">
                        {t('helpValhallaPhaseLabel')}: {valhallaStatus.build.phase}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {valhallaStatus.build.message}
                      </Text>
                    </Stack>
                  )}
                  {valhallaStatus.update &&
                    (valhallaUpdateAvailable || isValhallaBuildRunning) && (
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          {t('helpRoutingEngineAutoUpdate')}{' '}
                          {valhallaStatus.update.message}
                        </Text>
                      </Stack>
                    )}
                </Stack>
              )}
            </Stack>

            <Divider />

            <Stack gap={isDesktop ? 'sm' : 'md'}>
              <Group gap="xs" align="center">
                <ThemeIcon variant="light" color="teal" radius="xl" size="md">
                  <IconDatabase size={16} />
                </ThemeIcon>
                <Text fw={600}>{t('helpPlatformStatusTitle')}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {t('helpPlatformStatusBody')}
              </Text>
              {isCloudDiagnosticsLoading && (
                <Text size="sm" c="dimmed">
                  {t('helpPlatformStatusLoading')}
                </Text>
              )}
              {!isCloudDiagnosticsLoading && cloudDiagnosticsError && (
                <Text size="sm" c="red.6">
                  {t('helpPlatformStatusUnavailable')}
                </Text>
              )}
              {!isCloudDiagnosticsLoading &&
                !cloudDiagnosticsError &&
                cloudDiagnostics && (
                  <Stack gap={4}>
                    <Badge
                      size="sm"
                      variant="light"
                      color={cloudDiagnostics.cache.healthy ? 'teal' : 'orange'}
                    >
                      {cloudDiagnostics.cache.healthy
                        ? t('helpCloudCacheHealthy')
                        : t('helpCloudCacheUnhealthy')}
                    </Badge>
                    {cloudDiagnostics.serverTimeUtc && (
                      <Text size="xs" c="dimmed">
                        {t('helpCloudServerTimeLabel')}:{' '}
                        {new Date(cloudDiagnostics.serverTimeUtc).toLocaleString(
                          isFrench ? 'fr-FR' : 'en-US',
                        )}
                      </Text>
                    )}
                  </Stack>
                )}
            </Stack>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p={isDesktop ? 'md' : 'lg'}>
          <Stack gap={isDesktop ? 'sm' : 'md'}>
            <Text fw={600}>{t('helpMentionsTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('helpMentionsBody')}
            </Text>
            <Stack gap={2}>
              <Text size="sm">{t('helpMentionsItem1')}</Text>
              <Text size="sm">{t('helpMentionsItem2')}</Text>
              <Text size="sm">{t('helpMentionsItem3')}</Text>
              <Text size="sm">{t('helpMentionsItem4')}</Text>
              <Text size="sm">{t('helpMentionsItem5')}</Text>
              <Text size="sm">{t('helpMentionsItem6')}</Text>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  )
}
