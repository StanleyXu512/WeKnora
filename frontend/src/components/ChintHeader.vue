<template>
  <header class="chint-header" aria-label="集团知识中心导航">
    <RouterLink class="chint-header__brand" to="/platform/knowledge-bases">
      <img src="@/assets/chint/logo-white.svg" alt="CHINT"><span>集团知识中心</span>
    </RouterLink>
    <button class="chint-header__button" type="button" :aria-label="ui.sidebarCollapsed ? '展开导航' : '收起导航'" :aria-expanded="!ui.sidebarCollapsed" @click="ui.toggleSidebar"><i class="ri-menu-line" aria-hidden="true" /></button>
    <div class="chint-header__actions">
      <button class="chint-header__button" type="button" aria-label="搜索知识" @click="search.openPalette('')"><i class="ri-search-line" aria-hidden="true" /><span>搜索知识</span></button>
      <button class="chint-header__button" type="button" aria-label="切换明暗主题" @click="toggleTheme"><i class="ri-contrast-2-line" aria-hidden="true" /></button>
      <button class="chint-header__button" type="button" aria-label="打开设置" @click="ui.openSettings()"><i class="ri-settings-3-line" aria-hidden="true" /></button>
    </div>
  </header>
</template>
<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useCommandPaletteStore } from '@/stores/commandPalette'
import { useTheme } from '@/composables/useTheme'
const ui = useUIStore()
const search = useCommandPaletteStore()
const { setTheme } = useTheme()
const toggleTheme = () => setTheme(document.documentElement.getAttribute('theme-mode') === 'dark' ? 'light' : 'dark')
</script>
