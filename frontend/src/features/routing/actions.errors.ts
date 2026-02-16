import { readApiMessage } from './api'
import type { RouteErrorKey } from './types'

export type RouteErrorSetters = {
  setRouteErrorMessage: (value: string | null) => void
  setRouteErrorKey: (value: RouteErrorKey | null) => void
}

const setRouteError = (setters: RouteErrorSetters, key: RouteErrorKey) => {
  setters.setRouteErrorMessage(null)
  setters.setRouteErrorKey(key)
}

const normalizeServiceUnavailableError = async (
  response: Response,
  setters: RouteErrorSetters,
  fallbackKey: RouteErrorKey,
) => {
  const message = await readApiMessage(response)
  if (message) {
    setters.setRouteErrorMessage(message)
    setters.setRouteErrorKey(null)
    return
  }

  setRouteError(setters, fallbackKey)
}

export const clearRouteErrors = (setters: RouteErrorSetters) => {
  setters.setRouteErrorKey(null)
  setters.setRouteErrorMessage(null)
}

export const normalizeRouteResponseError = async (
  response: Response,
  setters: RouteErrorSetters,
) => {
  if (response.status === 503) {
    await normalizeServiceUnavailableError(
      response,
      setters,
      'routeErrorUnavailable',
    )
    return
  }

  if (response.status === 504) {
    setRouteError(setters, 'routeErrorTimeout')
    return
  }

  if (response.status === 502) {
    setRouteError(setters, 'routeErrorGateway')
    return
  }

  setRouteError(setters, 'routeErrorFailed')
}

export const normalizeLoopResponseError = async (
  response: Response,
  setters: RouteErrorSetters,
) => {
  if (response.status === 503) {
    await normalizeServiceUnavailableError(
      response,
      setters,
      'routeErrorUnavailable',
    )
    return
  }

  if (response.status === 504) {
    setRouteError(setters, 'routeErrorTimeout')
    return
  }

  if (response.status === 502) {
    setRouteError(setters, 'routeErrorGateway')
    return
  }

  if (response.status === 422) {
    const message = await readApiMessage(response)
    if (message) {
      setters.setRouteErrorMessage(message)
      setters.setRouteErrorKey(null)
      return
    }

    setRouteError(setters, 'loopErrorFailed')
    return
  }

  setRouteError(setters, 'loopErrorFailed')
}

export const setRouteUnexpectedError = (setters: RouteErrorSetters) => {
  setRouteError(setters, 'routeErrorFailed')
}

export const setLoopUnexpectedError = (setters: RouteErrorSetters) => {
  setRouteError(setters, 'loopErrorFailed')
}

export const setRouteMissingPlaceError = (setters: RouteErrorSetters) => {
  setters.setRouteErrorKey('routeErrorMissingPlace')
}

export const setLoopFailedError = (setters: RouteErrorSetters) => {
  setters.setRouteErrorKey('loopErrorFailed')
}
