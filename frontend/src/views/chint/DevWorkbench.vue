<template>
  <main class="workbench">
    <header class="dev-header">
      <div><strong>CHINT 开发验证</strong><p>独立开发数据 · 组织人员导入、账号绑定与停用验证</p></div>
      <button v-if="signedIn" type="button" @click="logout">退出账号</button>
    </header>
    <form v-if="!signedIn" class="login" @submit.prevent="login">
      <h2>登录开发环境</h2>
      <p>使用独立的开发管理员账号，不是原 localhost:8081 环境的账号。</p>
      <label>邮箱<input v-model="email" type="email" autocomplete="username" required /></label>
      <label>密码<input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="busy">{{ busy ? '登录中…' : '登录' }}</button>
    </form>
    <Directory v-else />
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import Directory from './Directory.vue'
const signedIn = ref(false), busy = ref(false), error = ref('')
const email = ref('chint-dev@example.local'), password = ref('')
async function login() {
  busy.value = true; error.value = ''
  try {
    const response = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value, password: password.value }) })
    const data = await response.json()
    if (!response.ok || !data.success || !data.token) throw new Error(data.message || data.error?.message || '登录失败')
    if (!data.user?.is_system_admin) throw new Error('此验证入口需要开发系统管理员账号')
    localStorage.setItem('weknora_token', data.token)
    if (data.refresh_token) localStorage.setItem('weknora_refresh_token', data.refresh_token)
    if (data.tenant?.id) localStorage.setItem('weknora_selected_tenant_id', String(data.tenant.id))
    password.value = ''; signedIn.value = true
  } catch (err) { error.value = err instanceof Error ? err.message : '登录失败' } finally { busy.value = false }
}
function logout() {
  localStorage.removeItem('weknora_token'); localStorage.removeItem('weknora_refresh_token'); localStorage.removeItem('weknora_selected_tenant_id'); signedIn.value = false
}
</script>
<style scoped>
.workbench { min-height: 100vh; color: var(--td-text-color-primary); background: var(--td-bg-color-page); font-family: system-ui, sans-serif; }
.dev-header { padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; background: var(--td-bg-color-container); border-bottom: 1px solid var(--td-component-border); }
.dev-header p, .login p { color: var(--td-text-color-secondary); }
.login { max-width: 440px; margin: 48px auto; padding: 28px; border-radius: 12px; background: var(--td-bg-color-container); }
label { display: flex; flex-direction: column; gap: 8px; margin: 20px 0; }
input { padding: 10px; border: 1px solid var(--td-component-border); border-radius: 6px; }
button { padding: 10px 18px; border-radius: 6px; border: 1px solid var(--td-component-border); cursor: pointer; background: var(--td-brand-color); color: white; }
</style>
