import { createApp } from 'vue'
import { LeagueBroadcastClient } from '@bluebottle_gg/league-broadcast-client'
import '@/style.css'
import ChampionStagePreview from './ChampionStagePreview.vue'
import { ClientKey, defaultClientConfig } from '@/client'

const client = new LeagueBroadcastClient(defaultClientConfig)
const app = createApp(ChampionStagePreview)
app.provide(ClientKey, client)
app.mount('#app')
