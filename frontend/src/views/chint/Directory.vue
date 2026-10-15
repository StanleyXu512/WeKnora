<template>
  <div class="directory">
    <header>
      <h2>集团组织与人员</h2>
      <p>导入组织人员主数据，关联本地账号。缺失记录不会自动停用，离职或停用需明确提供状态。</p>
    </header>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="loading">正在加载…</p>
    <template v-if="status">
      <p v-if="!status.enabled" class="notice">集团目录功能尚未启用，请联系部署管理员。</p>
      <template v-else>
        <div class="notice">
          <strong>定时导入：{{ status.scheduled ? '已开启' : '未开启' }}</strong>
          <span v-if="status.scheduled"> · {{ status.schedule }} · {{ status.timezone }}</span>
          <span> · 最近结果：{{ statusLabels[status.last_status] || status.last_status }}</span>
          <span v-if="status.running"> · 正在执行</span>
          <span v-if="status.last_finished_at"> · {{ formatTime(status.last_finished_at) }}</span>
        </div>
        <section class="card">
          <h3>导入批次</h3>
          <p>选择 JSON 文件，先校验再导入。每批最多 20,000 条组织和人员记录，文件不超过 10 MiB。</p>
          <div class="actions">
            <label class="file-label">选择文件 <input type="file" accept=".json,application/json" :disabled="busy" @change="loadFile" /></label>
            <button type="button" @click="downloadSample">下载合成示例</button>
          </div>
          <label for="directory-json">批次内容</label>
          <textarea id="directory-json" v-model="input" :disabled="busy" rows="10" spellcheck="false" placeholder="选择文件或粘贴批次 JSON" @input="previewInput = ''"></textarea>
          <div class="actions">
            <button type="button" :disabled="busy || !input.trim()" @click="runImport(true)">校验批次</button>
            <button type="button" class="primary" :disabled="busy || !canApply" @click="runImport(false)">正式导入</button>
            <span v-if="busy">正在处理…</span>
          </div>
          <div v-if="report" class="notice" :class="{ error: report.status === 'rejected' }" aria-live="polite">
            <strong>{{ statusLabels[report.status] || report.status }}{{ report.replay ? '（重复批次，返回原结果）' : '' }}</strong>
            <p>批次 {{ report.batch_id }} · 组织 {{ report.organizations }} 条 · 人员 {{ report.people }} 条 · 校验问题 {{ report.issue_count }} 项</p>
            <ul v-if="report.issues?.length"><li v-for="(issue, i) in report.issues" :key="i">{{ issue.kind }} / {{ issue.id }}：{{ issue.message }}</li></ul>
            <p v-if="report.issue_count > (report.issues?.length || 0)">仅显示前 200 项问题，请修正后重新校验。</p>
          </div>
        </section>
        <section class="card">
          <h3>关联本地账号</h3>
          <p>按稳定 ID 显式绑定。不会按姓名匹配，也不会创建账号或授予知识访问权限。系统管理员账号不参与导入停用。</p>
          <form class="binding-form" @submit.prevent="bind">
            <label>来源 ID<input v-model="binding.source_id" required maxlength="128" :disabled="busy" /></label>
            <label>集团人员 ID<input v-model="binding.person_id" required maxlength="128" :disabled="busy" /></label>
            <label>本地账号 ID<input v-model="binding.user_id" required maxlength="36" :disabled="busy" /></label>
            <button type="submit" :disabled="busy">保存绑定</button>
          </form>
          <p class="notice">已绑定人员或所属组织停用后，该普通账号的后续受保护请求会被阻断；恢复有效状态后仍受本地账号及原有权限约束。</p>
        </section>
        <section class="card">
          <h3>紧急停用与恢复</h3>
          <p>使用上方的来源 ID 和人员 ID。人工停用独立保存，每日导入不会自动解除。</p>
          <label for="suspension-reason">操作原因</label>
          <input id="suspension-reason" v-model="suspensionReason" maxlength="500" :disabled="busy" />
          <div class="actions">
            <button type="button" :disabled="busy || !binding.source_id || !binding.person_id || !suspensionReason.trim()" @click="suspend(true)">紧急停用</button>
            <button type="button" :disabled="busy || !binding.source_id || !binding.person_id || !suspensionReason.trim()" @click="suspend(false)">解除人工停用</button>
          </div>
          <p>解除人工停用后，主数据中的人员或组织若仍为停用状态，账号仍不能访问。</p>
        </section>
        <section class="card">
          <div class="actions">
            <button v-for="item in tabs" :key="item.key" type="button" :class="{ primary: tab === item.key }" :disabled="busy || loading" @click="selectTab(item.key)">{{ item.label }}</button>
            <button type="button" :disabled="busy || loading" @click="reload">刷新</button>
          </div>
          <div class="table-wrap">
            <table v-if="tab === 'organizations'">
              <thead><tr><th>来源</th><th>组织 ID</th><th>名称</th><th>父组织</th><th>状态</th></tr></thead>
              <tbody><tr v-for="row in organizations" :key="`${row.source_id}:${row.id}`"><td>{{ row.source_id }}</td><td>{{ row.id }}</td><td>{{ row.name }}</td><td>{{ row.parent_id || '—' }}</td><td>{{ statusLabels[row.status] || row.status }}</td></tr></tbody>
            </table>
            <table v-else-if="tab === 'people'">
              <thead><tr><th>来源</th><th>人员 ID</th><th>姓名</th><th>组织 ID</th><th>状态</th></tr></thead>
              <tbody><tr v-for="row in people" :key="`${row.source_id}:${row.id}`"><td>{{ row.source_id }}</td><td>{{ row.id }}</td><td>{{ row.name }}</td><td>{{ row.org_id }}</td><td>{{ statusLabels[row.status] || row.status }}</td></tr></tbody>
            </table>
            <table v-else-if="tab === 'bindings'">
              <thead><tr><th>来源</th><th>人员 ID</th><th>本地账号 ID</th><th>更新时间</th></tr></thead>
              <tbody><tr v-for="row in bindings" :key="`${row.source_id}:${row.person_id}`"><td>{{ row.source_id }}</td><td>{{ row.person_id }}</td><td>{{ row.user_id }}</td><td>{{ formatTime(row.updated_at) }}</td></tr></tbody>
            </table>
            <table v-else-if="tab === 'identities'">
              <thead><tr><th>来源</th><th>飞书租户 ID</th><th>租户账号 ID</th><th>集团人员 ID</th></tr></thead>
              <tbody><tr v-for="row in identities" :key="`${row.source_id}:${row.tenant_id}:${row.user_id}`"><td>{{ row.source_id }}</td><td>{{ row.tenant_id }}</td><td>{{ row.user_id }}</td><td>{{ row.person_id }}</td></tr></tbody>
            </table>
            <table v-else-if="tab === 'suspensions'">
              <thead><tr><th>来源</th><th>人员 ID</th><th>人工停用</th><th>原因</th><th>更新时间</th></tr></thead>
              <tbody><tr v-for="row in suspensions" :key="`${row.source_id}:${row.person_id}`"><td>{{ row.source_id }}</td><td>{{ row.person_id }}</td><td>{{ row.active ? '已停用' : '已解除' }}</td><td>{{ row.reason }}</td><td>{{ formatTime(row.updated_at) }}</td></tr></tbody>
            </table>
            <table v-else>
              <thead><tr><th>批次 / 来源</th><th>序号</th><th>结果</th><th>组织 / 人员</th><th>问题</th><th>时间</th></tr></thead>
              <tbody><tr v-for="row in reports" :key="`${row.source_id}:${row.batch_id}`"><td>{{ row.batch_id }} / {{ row.source_id }}</td><td>{{ row.sequence }}</td><td>{{ statusLabels[row.status] || row.status }}</td><td>{{ row.organizations }} / {{ row.people }}</td><td><details v-if="row.issue_count"><summary>{{ row.issue_count }} 项</summary><p v-for="(issue, i) in row.issues" :key="i">{{ issue.id }}：{{ issue.message }}</p></details><span v-else>0</span></td><td>{{ formatTime(row.created_at) }}</td></tr></tbody>
            </table>
          </div>
          <p v-if="rowCount === 0 && !loading">暂无记录</p>
          <div class="actions pagination">
            <button type="button" :disabled="offset === 0 || loading || busy" @click="changePage(-50)">上一页</button>
            <span>第 {{ offset / 50 + 1 }} 页</span>
            <button type="button" :disabled="rowCount < 50 || loading || busy" @click="changePage(50)">下一页</button>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import {
  bindDirectoryAccount, directoryBindings, directoryOrganizations, directoryPeople,
  directoryReports, directoryStatus, importDirectory, directorySuspensions, suspendDirectoryPerson, directoryIdentities,
  type DirectoryBinding, type DirectoryOrganization, type DirectoryPerson,
  type DirectoryStatus, type ImportReport, type DirectorySuspension, type DirectoryIdentity,
} from '@/api/chint-directory'

type Tab = 'organizations' | 'people' | 'imports' | 'bindings' | 'suspensions' | 'identities'
const tabs: { key: Tab; label: string }[] = [
  { key: 'organizations', label: '组织' }, { key: 'people', label: '人员' },
  { key: 'imports', label: '导入记录' }, { key: 'bindings', label: '账号绑定' }, { key: 'suspensions', label: '人工停用' }, { key: 'identities', label: '飞书身份' },
]
const statusLabels: Record<string, string> = {
  never: '尚未执行', failed: '失败', rejected: '校验未通过', applied: '已导入',
  validated: '校验通过', replayed: '重复批次', active: '有效', inactive: '停用',
}
const status = ref<DirectoryStatus>()
const organizations = ref<DirectoryOrganization[]>([])
const people = ref<DirectoryPerson[]>([])
const reports = ref<ImportReport[]>([])
const bindings = ref<DirectoryBinding[]>([])
const suspensions = ref<DirectorySuspension[]>([])
const identities = ref<DirectoryIdentity[]>([])
const suspensionReason = ref('')
const loading = ref(false), busy = ref(false), error = ref('')
const tab = ref<Tab>('organizations'), offset = ref(0)
const input = ref(''), previewInput = ref(''), report = ref<ImportReport>()
const binding = ref({ source_id: '', person_id: '', user_id: '' })
const canApply = computed(() => report.value?.status === 'validated' && previewInput.value === input.value)
const rowCount = computed(() => ({ organizations: organizations.value, people: people.value, imports: reports.value, bindings: bindings.value, suspensions: suspensions.value, identities: identities.value })[tab.value].length)
function errorText(err: unknown): string {
  const data = err as { error?: string; message?: string; response?: { data?: { error?: string } } }
  return data?.response?.data?.error || data?.error || data?.message || '操作失败，请重试'
}
function formatTime(value: string) { return new Date(value).toLocaleString() }
async function reload() {
  loading.value = true; error.value = ''
  try {
    status.value = (await directoryStatus()).data
    if (!status.value.enabled) return
    if (tab.value === 'organizations') organizations.value = (await directoryOrganizations(offset.value)).data
    if (tab.value === 'people') people.value = (await directoryPeople(offset.value)).data
    if (tab.value === 'imports') reports.value = (await directoryReports(offset.value)).data
    if (tab.value === 'bindings') bindings.value = (await directoryBindings(offset.value)).data
    if (tab.value === 'suspensions') suspensions.value = (await directorySuspensions(offset.value)).data
    if (tab.value === 'identities') identities.value = (await directoryIdentities(offset.value)).data
  } catch (err) { error.value = errorText(err) } finally { loading.value = false }
}
async function selectTab(value: Tab) { tab.value = value; offset.value = 0; await reload() }
async function changePage(delta: number) { offset.value += delta; await reload() }
async function loadFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  previewInput.value = ''; report.value = undefined; error.value = ''
  if (file.size > 10 * 1024 * 1024) { error.value = '文件不能超过 10 MiB'; target.value = ''; return }
  busy.value = true
  try { input.value = await file.text() } catch (err) { error.value = errorText(err) } finally { busy.value = false; target.value = '' }
}
async function runImport(dryRun: boolean) {
  busy.value = true; error.value = ''; previewInput.value = ''
  const submitted = input.value
  try {
    report.value = (await importDirectory(JSON.parse(submitted), dryRun)).data
    if (dryRun && report.value.status === 'validated') previewInput.value = submitted
    if (!dryRun && report.value.status === 'applied') { MessagePlugin.success('导入完成'); await reload() }
  } catch (err) { error.value = errorText(err) } finally { busy.value = false }
}
async function bind() {
  busy.value = true; error.value = ''
  try {
    await bindDirectoryAccount(binding.value); MessagePlugin.success('账号绑定已保存')
    tab.value = 'bindings'; offset.value = 0; await reload()
  } catch (err) { error.value = errorText(err) } finally { busy.value = false }
}
async function suspend(active: boolean) {
  busy.value = true; error.value = ''
  try {
    await suspendDirectoryPerson({ source_id: binding.value.source_id, person_id: binding.value.person_id, active, reason: suspensionReason.value })
    MessagePlugin.success(active ? '人员已人工停用' : '人工停用已解除')
    tab.value = 'suspensions'; offset.value = 0; await reload()
  } catch (err) { error.value = errorText(err) } finally { busy.value = false }
}
function downloadSample() {
  const sample = {
    source_id: 'demo-masterdata', batch_id: `sample-${Date.now()}`, sequence: Date.now(), mode: 'full', complete: true,
    organizations: [{ id: 'demo-a', name: '示例组织 A', parent_id: '', status: 'active' }, { id: 'demo-b', name: '示例组织 B', parent_id: '', status: 'active' }],
    people: [{ id: 'demo-person-a', name: '示例人员 A', org_id: 'demo-a', status: 'active', feishu_identities: [{ tenant_id: 'demo-feishu-1', user_id: 'demo-user-1' }, { tenant_id: 'demo-feishu-2', user_id: 'demo-user-2' }, { tenant_id: 'demo-feishu-3', user_id: 'demo-user-3' }] }],
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = 'chint-directory-sample.json'; a.click()
  URL.revokeObjectURL(url)
}
onMounted(reload)
</script>

<style scoped lang="less">
.directory { padding: 24px; color: var(--td-text-color-primary); max-width: 1100px; margin: auto;
  h2 { margin: 0 0 8px; } h3 { margin: 0 0 12px; } p { line-height: 1.6; }
  header p, section > p { color: var(--td-text-color-secondary); }
}
.card { margin-top: 20px; padding: 20px; border: 1px solid var(--td-component-border); border-radius: 8px; }
.notice { padding: 12px; margin: 12px 0; background: var(--td-bg-color-secondarycontainer); border-radius: 6px; overflow-wrap: anywhere; }
.error { color: var(--td-error-color); border: 1px solid var(--td-error-color); }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
button { cursor: pointer; padding: 8px 14px; border: 1px solid var(--td-component-border); background: var(--td-bg-color-container); color: inherit; border-radius: 6px;
  &:disabled { opacity: .5; cursor: default; } &.primary { background: var(--td-brand-color); color: white; border-color: var(--td-brand-color); }
}
textarea, input:not([type=file]) { box-sizing: border-box; padding: 8px; border: 1px solid var(--td-component-border); border-radius: 6px; background: var(--td-bg-color-container); color: inherit; }
textarea { width: 100%; margin-top: 8px; font-family: monospace; resize: vertical; }
.binding-form { display: flex; flex-wrap: wrap; align-items: end; gap: 12px;
  label { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 160px; }
}
.table-wrap { overflow-x: auto; } table { border-collapse: collapse; width: 100%; text-align: left;
  th, td { padding: 10px; border-bottom: 1px solid var(--td-component-border); overflow-wrap: anywhere; min-width: 90px; } th { color: var(--td-text-color-secondary); }
}
.pagination { justify-content: flex-end; }
</style>
