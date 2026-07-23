import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  findProfileMatchingSettings,
  getProfilePresetSettings,
  profilePresetId,
  profilePresets,
  type CustomProfile,
  type ProfileCatalog,
  type ProfilePreset,
  type ProfilePresetKey,
  type ProfileSettings,
} from '../../features/routing/domain'
import ProfileSettingsEditor from './ProfileSettingsEditor'

type ProfileEditorState =
  | {
      kind: 'preset'
      preset: ProfilePreset
      name: string
      settings: ProfileSettings
    }
  | {
      kind: 'custom'
      profileId: string | null
      name: string
      settings: ProfileSettings
    }

type ProfilesPageProps = {
  contentSize: string
  isDesktop: boolean
  profileSettings: ProfileSettings
  profileCatalog: ProfileCatalog
  onProfileApply: (profileId: string, settings: ProfileSettings) => void
  onPresetSave: (presetKey: ProfilePresetKey, settings: ProfileSettings) => void
  onCustomProfileCreate: (name: string, settings: ProfileSettings) => void
  onCustomProfileUpdate: (profileId: string, name: string, settings: ProfileSettings) => void
  onCustomProfileDelete: (profileId: string) => void
}

export default function ProfilesPage({
  contentSize,
  isDesktop,
  profileSettings,
  profileCatalog,
  onProfileApply,
  onPresetSave,
  onCustomProfileCreate,
  onCustomProfileUpdate,
  onCustomProfileDelete,
}: ProfilesPageProps) {
  const { t } = useTranslation()
  const [editor, setEditor] = useState<ProfileEditorState | null>(null)
  const [profileToDelete, setProfileToDelete] = useState<CustomProfile | null>(null)
  const activeProfile = findProfileMatchingSettings(profileCatalog, profileSettings)

  const openPresetEditor = (preset: ProfilePreset) => {
    setEditor({
      kind: 'preset',
      preset,
      name: t(preset.labelKey),
      settings: getProfilePresetSettings(profileCatalog, preset),
    })
  }

  const openCustomEditor = (profile: CustomProfile) => {
    setEditor({
      kind: 'custom',
      profileId: profile.id,
      name: profile.name,
      settings: profile.settings,
    })
  }

  const openCreateEditor = () => {
    setEditor({
      kind: 'custom',
      profileId: null,
      name: '',
      settings: activeProfile?.settings ?? profileSettings,
    })
  }

  const saveEditor = () => {
    if (!editor) {
      return
    }

    if (editor.kind === 'preset') {
      onPresetSave(editor.preset.key, editor.settings)
      setEditor(null)
      return
    }

    const name = editor.name.trim()
    if (!name) {
      return
    }

    if (editor.profileId) {
      onCustomProfileUpdate(editor.profileId, name, editor.settings)
    } else {
      onCustomProfileCreate(name, editor.settings)
    }
    setEditor(null)
  }

  const renderMetrics = (settings: ProfileSettings) => (
    <SimpleGrid cols={2} spacing={4} verticalSpacing={4}>
      <Text size="xs" c="dimmed">
        {t('profilePresetWalkValue', {
          value: settings.speeds.walk,
          unit: t('unitKmh'),
        })}
      </Text>
      <Text size="xs" c="dimmed">
        {t('profilePresetBikeValue', {
          value: settings.speeds.bike,
          unit: t('unitKmh'),
        })}
      </Text>
      <Text size="xs" c="dimmed">
        {t('profilePresetEbikeValue', {
          value: settings.speeds.ebike,
          unit: t('unitKmh'),
        })}
      </Text>
      <Text size="xs" c="dimmed">
        {t('profilePresetAssistValue', {
          value:
            settings.ebikeAssist === 'low'
              ? t('assistLow')
              : settings.ebikeAssist === 'high'
                ? t('assistHigh')
                : t('assistMedium'),
        })}
      </Text>
    </SimpleGrid>
  )

  const renderActions = (
    profileId: string,
    settings: ProfileSettings,
    profileName: string,
    onEdit: () => void,
    profile?: CustomProfile,
  ) => {
    const isActive = activeProfile?.id === profileId

    return (
      <Group justify="space-between" gap="xs" mt="auto" wrap="nowrap">
        <Button
          variant={isActive ? 'light' : 'outline'}
          color={isActive ? 'teal' : 'blue'}
          size="xs"
          leftSection={isActive ? <IconCheck size={15} /> : <IconUser size={15} />}
          onClick={() => onProfileApply(profileId, settings)}
          aria-pressed={isActive}
        >
          {isActive ? t('profileActive') : t('profileUse')}
        </Button>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t('profileEdit')}>
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={onEdit}
              aria-label={t('profileEditNamed', { name: profileName })}
            >
              <IconPencil size={17} />
            </ActionIcon>
          </Tooltip>
          {profile ? (
            <Tooltip label={t('profileDelete')}>
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => setProfileToDelete(profile)}
                aria-label={t('profileDeleteNamed', { name: profile.name })}
              >
                <IconTrash size={17} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Group>
    )
  }

  const activeProfileName =
    activeProfile?.kind === 'preset'
      ? t(activeProfile.preset.labelKey)
      : activeProfile?.kind === 'custom'
        ? activeProfile.profile.name
        : t('profileCurrentCustomShort')

  return (
    <>
      <Container size={contentSize} py="lg">
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" gap="md">
            <Stack gap={4}>
              <Title order={2}>{t('profilesTitle')}</Title>
              <Text size="sm" c="dimmed">
                {t('profilesSubtitle')}
              </Text>
              <Badge variant="light" color="teal" leftSection={<IconCheck size={12} />}>
                {t('profileCurrentPreset', { name: activeProfileName })}
              </Badge>
            </Stack>
            <Button
              leftSection={<IconPlus size={17} />}
              onClick={openCreateEditor}
              fullWidth={!isDesktop}
            >
              {t('profileCreate')}
            </Button>
          </Group>

          <Stack gap="sm">
            <Stack gap={2}>
              <Text fw={600}>{t('profileBuiltInProfilesTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('profileBuiltInProfilesSubtitle')}
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" verticalSpacing="sm">
              {profilePresets.map((preset) => {
                const settings = getProfilePresetSettings(profileCatalog, preset)
                const profileId = profilePresetId(preset.key)
                const isModified = Boolean(profileCatalog.presetOverrides[preset.key])

                return (
                  <Paper
                    key={preset.key}
                    withBorder
                    radius="sm"
                    p="md"
                    data-testid={`profile-preset-${preset.key}`}
                  >
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                        <Stack gap={2} style={{ minWidth: 0 }}>
                          <Text fw={600}>{t(preset.labelKey)}</Text>
                          <Text size="sm" c="dimmed">
                            {t(preset.descriptionKey)}
                          </Text>
                        </Stack>
                        {isModified ? (
                          <Badge variant="light" color="orange">
                            {t('profileModified')}
                          </Badge>
                        ) : null}
                      </Group>
                      {renderMetrics(settings)}
                      {renderActions(profileId, settings, t(preset.labelKey), () =>
                        openPresetEditor(preset),
                      )}
                    </Stack>
                  </Paper>
                )
              })}
            </SimpleGrid>
          </Stack>

          <Stack gap="sm">
            <Stack gap={2}>
              <Text fw={600}>{t('profilePersonalProfilesTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('profilePersonalProfilesSubtitle')}
              </Text>
            </Stack>
            {profileCatalog.customProfiles.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" verticalSpacing="sm">
                {profileCatalog.customProfiles.map((profile) => (
                  <Paper key={profile.id} withBorder radius="sm" p="md">
                    <Stack gap="sm" h="100%">
                      <Text fw={600}>{profile.name}</Text>
                      {renderMetrics(profile.settings)}
                      {renderActions(
                        profile.id,
                        profile.settings,
                        profile.name,
                        () => openCustomEditor(profile),
                        profile,
                      )}
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            ) : (
              <Paper withBorder radius="sm" p="md">
                <Text size="sm" c="dimmed">
                  {t('profilePersonalProfilesEmpty')}
                </Text>
              </Paper>
            )}
          </Stack>
        </Stack>
      </Container>

      <Modal
        opened={editor !== null}
        onClose={() => setEditor(null)}
        title={
          editor?.kind === 'preset' || editor?.profileId
            ? t('profileEditorEditTitle', { name: editor?.name })
            : t('profileEditorCreateTitle')
        }
        size="lg"
        fullScreen={!isDesktop}
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {editor ? (
          <Stack gap="lg">
            {editor.kind === 'custom' ? (
              <TextInput
                label={t('profileNameLabel')}
                placeholder={t('profileNamePlaceholder')}
                value={editor.name}
                maxLength={60}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    name: event.currentTarget.value,
                  })
                }
                required
                autoFocus
              />
            ) : (
              <Group justify="space-between" align="center" gap="sm">
                <Text size="sm" c="dimmed">
                  {t('profileBuiltInEditHint')}
                </Text>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  leftSection={<IconRefresh size={15} />}
                  onClick={() =>
                    setEditor({
                      ...editor,
                      settings: editor.preset.settings,
                    })
                  }
                >
                  {t('profileRestoreOriginal')}
                </Button>
              </Group>
            )}

            <ProfileSettingsEditor
              settings={editor.settings}
              onChange={(settings) => setEditor({ ...editor, settings })}
            />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => setEditor(null)}>
                {t('commonCancel')}
              </Button>
              <Button
                onClick={saveEditor}
                disabled={editor.kind === 'custom' && editor.name.trim().length === 0}
              >
                {t('profileSave')}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={profileToDelete !== null}
        onClose={() => setProfileToDelete(null)}
        title={t('profileDeleteConfirmTitle')}
        centered
        size="sm"
      >
        <Stack gap="lg">
          <Text size="sm">
            {t('profileDeleteConfirmBody', { name: profileToDelete?.name ?? '' })}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setProfileToDelete(null)}>
              {t('commonCancel')}
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => {
                if (profileToDelete) {
                  onCustomProfileDelete(profileToDelete.id)
                }
                setProfileToDelete(null)
              }}
            >
              {t('profileDelete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
