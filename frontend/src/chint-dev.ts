import { createApp } from 'vue'
import { createPinia } from 'pinia'
import TDesign from 'tdesign-vue-next'
import 'tdesign-vue-next/dist/tdesign.css'
import '@/assets/theme/theme.css'
import i18n from '@/i18n'
import DevWorkbench from '@/views/chint/DevWorkbench.vue'

createApp(DevWorkbench).use(createPinia()).use(TDesign).use(i18n).mount('#app')
