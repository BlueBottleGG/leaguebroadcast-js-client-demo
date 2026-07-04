import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'

import App from './App.vue'
import router from './router'
import { LeagueBroadcastClient } from '@bluebottle_gg/league-broadcast-client'
import { ClientKey, defaultClientConfig } from './client'

const client = new LeagueBroadcastClient(defaultClientConfig)

const app = createApp(App)
app.provide(ClientKey, client)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Connect after mount so the UI renders immediately with a "connecting" state
client.connect()
