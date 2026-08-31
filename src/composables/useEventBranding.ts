import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue'
import { useClient } from '@/client'
import { resolveEventBranding } from '@/utils/backendAssets'

export interface EventBranding {
  eventLogoUrl: Readonly<Ref<string | null>>
  eventName: Readonly<Ref<string | null>>
  isLoading: Readonly<Ref<boolean>>
  reload: () => Promise<void>
}

/**
 * Current event identity backed by LeagueBroadcast's active season. Reloads
 * when the pre-game connection returns so a backend restart or season switch
 * does not leave a stale hardcoded mark on air.
 */
export function useEventBranding(): EventBranding {
  const client = useClient()
  const eventName = ref<string | null>(null)
  const eventLogoUrl = ref<string | null>(null)
  const isLoading = ref(false)
  let loadVersion = 0

  const reload = async (): Promise<void> => {
    const version = ++loadVersion
    isLoading.value = true
    try {
      const season = await client.api.season.getCurrentSeason()
      if (version !== loadVersion) return
      const branding = resolveEventBranding(client, season)
      eventName.value = branding.eventName
      eventLogoUrl.value = branding.eventLogoUrl
    } catch (error) {
      if (version !== loadVersion) return
      eventName.value = null
      eventLogoUrl.value = null
      console.warn('[ChampionSelect] Current event branding could not be loaded', error)
    } finally {
      if (version === loadVersion) isLoading.value = false
    }
  }

  const unsubscribe = client.onPreGameConnect(() => {
    void reload()
  })
  onMounted(() => {
    void reload()
  })
  onUnmounted(() => {
    loadVersion += 1
    unsubscribe()
  })

  return {
    eventLogoUrl: readonly(eventLogoUrl),
    eventName: readonly(eventName),
    isLoading: readonly(isLoading),
    reload,
  }
}
