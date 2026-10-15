import { get, post, put } from '@/utils/request'

const base = '/api/v1/system/admin/chint/directory'
export interface DirectoryStatus {
  enabled: boolean
  file_configured: boolean
  scheduled: boolean
  schedule: string
  timezone: string
  running: boolean
  last_status: string
  last_started_at?: string
  last_finished_at?: string
}
export interface DirectoryOrganization {
  source_id: string; id: string; name: string; parent_id: string; status: string
}
export interface DirectoryPerson {
  source_id: string; id: string; name: string; org_id: string; status: string
}
export interface DirectoryBinding {
  source_id: string; person_id: string; user_id: string; actor: string; updated_at: string
}
export interface ImportIssue { kind: string; id: string; message: string }
export interface ImportReport {
  source_id: string; batch_id: string; sequence: number; status: string
  organizations: number; people: number; issue_count: number; issues: ImportIssue[]
  actor: string; created_at: string; replay: boolean; dry_run: boolean
}
interface Response<T> { success: boolean; data: T }
export const directoryStatus = () => get<Response<DirectoryStatus>>(`${base}/status`)
export const directoryOrganizations = (offset = 0) => get<Response<DirectoryOrganization[]>>(`${base}/organizations`, { params: { offset, limit: 50 } })
export const directoryPeople = (offset = 0) => get<Response<DirectoryPerson[]>>(`${base}/people`, { params: { offset, limit: 50 } })
export const directoryReports = (offset = 0) => get<Response<ImportReport[]>>(`${base}/imports`, { params: { offset, limit: 50 } })
export const directoryBindings = (offset = 0) => get<Response<DirectoryBinding[]>>(`${base}/bindings`, { params: { offset, limit: 50 } })
export const importDirectory = (batch: unknown, dryRun: boolean) => post<Response<ImportReport>>(`${base}/imports`, batch as object, { params: { dry_run: dryRun }, timeout: 120000 })
export const bindDirectoryAccount = (binding: { source_id: string; person_id: string; user_id: string }) => put(`${base}/bindings`, binding)

export interface DirectorySuspension {
  source_id: string; person_id: string; active: boolean; reason: string; actor: string; updated_at: string
}
export const directorySuspensions = (offset = 0) => get<Response<DirectorySuspension[]>>(`${base}/suspensions`, { params: { offset, limit: 50 } })
export const suspendDirectoryPerson = (payload: { source_id: string; person_id: string; active: boolean; reason: string }) => put(`${base}/suspensions`, payload)

export interface DirectoryIdentity { source_id: string; tenant_id: string; user_id: string; person_id: string }
export const directoryIdentities = (offset = 0) => get<Response<DirectoryIdentity[]>>(`${base}/identities`, { params: { offset, limit: 50 } })
