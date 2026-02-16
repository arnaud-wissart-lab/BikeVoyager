export const parseApiError = async (response: Response) => {
  const fallback = `${response.status} ${response.statusText}`.trim()
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        message?: string
        error?: string | { message?: string }
        error_description?: string
      }

      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim()
      }

      if (
        payload.error &&
        typeof payload.error === 'object' &&
        typeof payload.error.message === 'string' &&
        payload.error.message.trim()
      ) {
        return payload.error.message.trim()
      }

      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim()
      }

      if (typeof payload.error_description === 'string' && payload.error_description.trim()) {
        return payload.error_description.trim()
      }
    }

    const text = (await response.text()).trim()
    if (text) {
      return text.slice(0, 240)
    }
  } catch {
    return fallback
  }

  return fallback
}
