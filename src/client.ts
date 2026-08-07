import {
  LeagueBroadcastClient,
  type LeagueBroadcastClientConfig,
} from '@bluebottle_gg/league-broadcast-client'
import { inject, type InjectionKey } from 'vue'

/**
 * Vue injection key for the shared LeagueBroadcastClient instance.
 * Use `useClient()` to access the client in components.
 */
export const ClientKey: InjectionKey<LeagueBroadcastClient> = Symbol('lbc')

const DEFAULT_PORT = 58869

/** Default config — connects to a local LeagueBroadcast server. */
export const defaultClientConfig: LeagueBroadcastClientConfig = {
  host: window.location.hostname,
  port: Number(new URLSearchParams(window.location.search).get('backendport')) || DEFAULT_PORT,
  autoConnect: false, // we connect explicitly after the app mounts
}

/**
 * Access the LeagueBroadcastClient instance provided at the app root.
 * Must be called inside a component that is a descendant of the provider.
 */
export function useClient(): LeagueBroadcastClient {
  const client = inject(ClientKey)
  if (!client) {
    throw new Error(
      'LeagueBroadcastClient not provided. Make sure app.provide(ClientKey, client) is called in main.ts.',
    )
  }
  return client
}
