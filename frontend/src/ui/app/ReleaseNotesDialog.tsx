import { Badge, Group, Modal, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconBug, IconPlus, IconSparkles, IconTrendingUp } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import {
  releaseNotes as defaultReleaseNotes,
  type ReleaseNote,
  type ReleaseNoteType,
} from '../../features/app/releaseNotes'

type ReleaseNotesDialogProps = {
  opened: boolean
  onClose: () => void
  isDesktop: boolean
  isFrench: boolean
  releaseNotes?: ReleaseNote[]
}

const typeColorByNoteType: Record<ReleaseNoteType, string> = {
  added: 'green',
  improved: 'blue',
  fixed: 'orange',
}

const typeIconByNoteType = {
  added: IconPlus,
  improved: IconTrendingUp,
  fixed: IconBug,
} satisfies Record<ReleaseNoteType, typeof IconPlus>

const formatReleaseDate = (date: string, isFrench: boolean) =>
  new Intl.DateTimeFormat(isFrench ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))

export default function ReleaseNotesDialog({
  opened,
  onClose,
  isDesktop,
  isFrench,
  releaseNotes = defaultReleaseNotes,
}: ReleaseNotesDialogProps) {
  const { t } = useTranslation()
  const language = isFrench ? 'fr' : 'en'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('releaseNotesTitle')}
      size="lg"
      fullScreen={!isDesktop}
      centered={isDesktop}
      scrollAreaComponent={ScrollArea.Autosize}
      closeButtonProps={{ 'aria-label': t('releaseNotesClose') }}
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          {t('releaseNotesSubtitle')}
        </Text>

        {releaseNotes.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('releaseNotesEmpty')}
          </Text>
        ) : (
          releaseNotes.map((note) => (
            <Stack key={`${note.version}-${note.date}`} gap="md">
              <Group justify="space-between" align="center" gap="sm">
                <Group gap="xs" align="center">
                  <ThemeIcon variant="light" color="cyan" radius="xl" size="md">
                    <IconSparkles size={16} />
                  </ThemeIcon>
                  <Text fw={700}>v{note.version}</Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {formatReleaseDate(note.date, isFrench)}
                </Text>
              </Group>

              {note.sections.map((section) => (
                <Stack key={section.title.fr} gap="xs">
                  <Text fw={600}>{section.title[language]}</Text>
                  <Stack component="ul" gap={8} m={0} pl="md">
                    {section.items.map((item) => {
                      const noteType = item.type
                      const Icon = noteType ? typeIconByNoteType[noteType] : IconSparkles

                      return (
                        <Group key={item.text.fr} component="li" gap="xs" align="flex-start">
                          {noteType && (
                            <Badge
                              size="sm"
                              variant="light"
                              color={typeColorByNoteType[noteType]}
                              leftSection={<Icon size={12} />}
                              style={{ flexShrink: 0 }}
                            >
                              {t(`releaseNotesType.${noteType}`)}
                            </Badge>
                          )}
                          <Text size="sm" style={{ flex: 1 }}>
                            {item.text[language]}
                          </Text>
                        </Group>
                      )
                    })}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ))
        )}
      </Stack>
    </Modal>
  )
}
