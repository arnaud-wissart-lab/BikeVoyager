import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import '../i18n'
import { theme } from '../theme'

export const renderWithProviders = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(
    <MantineProvider theme={theme} defaultColorScheme="light" env="test">
      {ui}
    </MantineProvider>,
    options,
  )

export const resolveRequestUrl = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

export const createJsonResponse = <T,>(payload: T, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }) as Response
