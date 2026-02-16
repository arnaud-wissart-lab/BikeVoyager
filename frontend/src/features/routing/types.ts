import type { LoopRequestPayload, RouteRequestPayload } from './domain'

export type RouteErrorKey =
  | 'routeErrorMissingPlace'
  | 'routeErrorFailed'
  | 'routeErrorUnavailable'
  | 'routeErrorTimeout'
  | 'routeErrorGateway'
  | 'loopErrorFailed'

export type RouteRequestKind =
  | {
      type: 'route'
      payload: RouteRequestPayload
    }
  | {
      type: 'loop'
      payload: LoopRequestPayload
    }
