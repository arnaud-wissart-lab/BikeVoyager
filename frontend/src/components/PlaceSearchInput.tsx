import {
  ActionIcon,
  Combobox,
  Loader,
  ScrollArea,
  Text,
  TextInput,
  useCombobox,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconX } from '@tabler/icons-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiPaths } from '../features/routing/apiPaths'

export type PlaceCandidate = {
  label: string
  lat: number
  lon: number
  score: number
  source: string
  postcode?: string
  city?: string
  department?: string
  inseeCode?: string
}

type PlaceOption = {
  candidate: PlaceCandidate
  value: string
}

type PlaceSearchInputProps = {
  label: string
  placeholder?: string
  value: string
  onValueChange: (value: string) => void
  onPlaceSelect: (place: PlaceCandidate | null) => void
  disabled?: boolean
  suppressInitialSearch?: boolean
  testId: string
}

const minQueryLength = 2
const defaultLimit = 8
const streetKeywordPattern =
  /\b(rue|avenue|av|av\.|boulevard|bd|route|chemin|impasse|allee|place|quai|square|cours|passage|lotissement|parvis|voie|faubourg|residence)\b/i
const addressNumberPattern = /^\s*\d+/

function getSearchMode(query: string) {
  const looksLikeAddress =
    addressNumberPattern.test(query) || streetKeywordPattern.test(query)
  return looksLikeAddress ? 'address' : 'city'
}

function filterOptionsForMode(
  mode: 'city' | 'address',
  candidates: PlaceCandidate[],
) {
  if (mode !== 'city') {
    return candidates
  }

  return candidates.filter(
    (option) =>
      !addressNumberPattern.test(option.label) &&
      !streetKeywordPattern.test(option.label),
  )
}

export default function PlaceSearchInput({
  label,
  placeholder,
  value,
  onValueChange,
  onPlaceSelect,
  disabled,
  suppressInitialSearch = false,
  testId,
}: PlaceSearchInputProps) {
  const { t } = useTranslation()
  const combobox = useCombobox()
  const comboboxRef = useRef(combobox)
  const cacheRef = useRef<Map<string, PlaceCandidate[]>>(new Map())
  const lastSelectedRef = useRef<string | null>(null)
  const skipNextSearchRef = useRef(false)
  const hasUserEditedRef = useRef(
    !suppressInitialSearch || value.trim().length < minQueryLength,
  )
  const requestIdRef = useRef(0)
  const activeControllerRef = useRef<AbortController | null>(null)

  comboboxRef.current = combobox

  const [options, setOptions] = useState<PlaceCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [errorKey, setErrorKey] = useState<'placesSearchError' | null>(null)
  const [debouncedValue] = useDebouncedValue(value, 300)

  const optionItems: PlaceOption[] = options.map((candidate, index) => ({
    candidate,
    value: `${candidate.label}__${candidate.lat.toFixed(6)}__${candidate.lon.toFixed(6)}__${index}`,
  }))

  const hasQuery = debouncedValue.trim().length >= minQueryLength
  const hasError = errorKey !== null
  const isSelectedValue =
    Boolean(lastSelectedRef.current) && value.trim() === lastSelectedRef.current

  useEffect(() => {
    if (disabled) {
      setOptions([])
      setLoading(false)
      setErrorKey(null)
      requestIdRef.current += 1
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
      comboboxRef.current.closeDropdown()
      return
    }

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      setOptions([])
      setLoading(false)
      setErrorKey(null)
      requestIdRef.current += 1
      activeControllerRef.current?.abort()
      activeControllerRef.current = null
      comboboxRef.current.closeDropdown()
      return
    }

    if (!hasUserEditedRef.current) {
      setOptions([])
      setLoading(false)
      setErrorKey(null)
      comboboxRef.current.closeDropdown()
      return
    }

    if (!hasQuery) {
      setOptions([])
      setLoading(false)
      setErrorKey(null)
      lastSelectedRef.current = null
      comboboxRef.current.closeDropdown()
      return
    }

    const rawQuery = debouncedValue.trim()
    if (lastSelectedRef.current && rawQuery === lastSelectedRef.current) {
      setOptions([])
      setLoading(false)
      setErrorKey(null)
      comboboxRef.current.closeDropdown()
      return
    }

    const query = rawQuery.toLowerCase()
    const mode = getSearchMode(query)
    const cacheKey = `${mode}:${query}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setOptions(filterOptionsForMode(mode, cached))
      setErrorKey(null)
      comboboxRef.current.openDropdown()
      return
    }

    requestIdRef.current += 1
    const requestId = requestIdRef.current
    activeControllerRef.current?.abort()
    const controller = new AbortController()
    activeControllerRef.current = controller

    const fetchPlaces = async () => {
      setLoading(true)
      setErrorKey(null)

      try {
        const response = await fetch(
          `${apiPaths.placesSearch}?q=${encodeURIComponent(query)}&limit=${defaultLimit}&mode=${mode}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('search_failed')
        }

        const data = (await response.json()) as PlaceCandidate[]
        if (requestId !== requestIdRef.current) {
          return
        }

        const filtered = filterOptionsForMode(mode, data)
        cacheRef.current.set(cacheKey, filtered)
        setOptions(filtered)
        comboboxRef.current.openDropdown()
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }

        if (requestId !== requestIdRef.current) {
          return
        }

        setOptions([])
        setErrorKey('placesSearchError')
        comboboxRef.current.openDropdown()
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    void fetchPlaces()

    return () => {
      controller.abort()
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null
      }
    }
  }, [debouncedValue, disabled, hasQuery])

  const handleOptionSubmit = (optionValue: string) => {
    const selected = optionItems.find((item) => item.value === optionValue)?.candidate
    const selectedLabel = selected?.label ?? optionValue
    lastSelectedRef.current = selectedLabel
    skipNextSearchRef.current = true
    requestIdRef.current += 1
    activeControllerRef.current?.abort()
    activeControllerRef.current = null
    onValueChange(selectedLabel)
    onPlaceSelect(selected ?? null)
    setOptions([])
    setErrorKey(null)
    combobox.closeDropdown()
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.value
    if (lastSelectedRef.current && nextValue.trim() === lastSelectedRef.current) {
      return
    }

    lastSelectedRef.current = null
    skipNextSearchRef.current = false
    hasUserEditedRef.current = true
    onValueChange(nextValue)
    onPlaceSelect(null)
  }

  const handleClearInput = () => {
    if (!value) {
      return
    }

    lastSelectedRef.current = null
    skipNextSearchRef.current = false
    hasUserEditedRef.current = true
    requestIdRef.current += 1
    activeControllerRef.current?.abort()
    activeControllerRef.current = null
    setOptions([])
    setErrorKey(null)
    setLoading(false)
    onValueChange('')
    onPlaceSelect(null)
    combobox.closeDropdown()
  }


  const optionsList = optionItems.map(({ candidate, value }, index) => (
    <Combobox.Option
      value={value}
      key={`${candidate.label}-${candidate.lat}-${candidate.lon}`}
      data-testid={`${testId}-option-${index}`}
    >
      <Text size="sm" fw={500}>
        {candidate.label}
      </Text>
      {(candidate.postcode || candidate.city) && (
        <Text size="xs" c="dimmed">
          {[candidate.postcode, candidate.city].filter(Boolean).join(' · ')}
        </Text>
      )}
    </Combobox.Option>
  ))

  return (
    <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <TextInput
          label={label}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (
              (options.length > 0 || hasError) &&
              (!lastSelectedRef.current ||
                value.trim() !== lastSelectedRef.current)
            ) {
              combobox.openDropdown()
            }
          }}
          rightSection={
            value.trim().length > 0 ? (
              <ActionIcon
                variant="subtle"
                size="sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleClearInput}
                aria-label={t('inputClearLabel')}
                data-testid={`${testId}-clear`}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : loading ? (
              <Loader size="xs" data-testid={`${testId}-loading`} />
            ) : null
          }
          rightSectionPointerEvents="all"
          rightSectionWidth={32}
          disabled={disabled}
          data-testid={`${testId}-input`}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {errorKey && (
            <Combobox.Option value="error" disabled data-testid={`${testId}-error`}>
              <Text size="sm" c="dimmed">
                {t(errorKey)}
              </Text>
            </Combobox.Option>
          )}

          {!hasError &&
            !loading &&
            hasQuery &&
            !isSelectedValue &&
            options.length === 0 && (
            <Combobox.Option value="empty" disabled data-testid={`${testId}-empty`}>
              <Text size="sm" c="dimmed">
                {t('placesSearchEmpty')}
              </Text>
            </Combobox.Option>
          )}

          {!hasError && loading && (
            <Combobox.Option
              value="loading"
              disabled
              data-testid={`${testId}-loading-state`}
            >
              <Text size="sm" c="dimmed">
                {t('placesSearchLoading')}
              </Text>
            </Combobox.Option>
          )}

          {!hasError && options.length > 0 && (
            <ScrollArea.Autosize mah={220} type="scroll">
              {optionsList}
            </ScrollArea.Autosize>
          )}

          {!hasError && !hasQuery && (
            <Combobox.Option value="hint" disabled data-testid={`${testId}-hint`}>
              <Text size="sm" c="dimmed">
                {t('placesSearchHint')}
              </Text>
            </Combobox.Option>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}

