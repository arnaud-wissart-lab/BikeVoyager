import { useCallback, useEffect, useState } from 'react'
import { routeValues } from './domain'
import type { RouteKey } from './domain'

export default function useHashRoute(defaultRoute: RouteKey) {
  const parseHash = useCallback(() => {
    if (typeof window === 'undefined') {
      return defaultRoute
    }

    const raw = window.location.hash.replace('#', '').replace('/', '')
    if (routeValues.includes(raw as RouteKey)) {
      return raw as RouteKey
    }
    return defaultRoute
  }, [defaultRoute])

  const [route, setRoute] = useState<RouteKey>(parseHash)

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = `/${defaultRoute}`
    }

    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [defaultRoute, parseHash])

  const navigate = (next: RouteKey) => {
    if (route === next) {
      return
    }

    window.location.hash = `/${next}`
    setRoute(next)
  }

  return [route, navigate] as const
}
