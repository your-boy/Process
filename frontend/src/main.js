import { createApp } from 'vue'
import App from './App.vue'
import { installSourceGuard } from './security/sourceGuard'

installSourceGuard()

createApp(App).mount('#app')
