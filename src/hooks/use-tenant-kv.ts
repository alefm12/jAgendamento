import { useKV } from '@github/spark/hooks'

export function useTenantKV<T>(tenantId: string, key: string, defaultValue: T) {
  const tenantKey = `tenant:${tenantId}:${key}`
  return useKV<T>(tenantKey, defaultValue)
}

export async function getTenantData<T>(tenantId: string, key: string): Promise<T | undefined> {
  const tenantKey = `tenant:${tenantId}:${key}`
  return await window.spark.kv.get<T>(tenantKey)
}

export async function setTenantData<T>(tenantId: string, key: string, value: T): Promise<void> {
  const tenantKey = `tenant:${tenantId}:${key}`
  return await window.spark.kv.set(tenantKey, value)
}

export async function deleteTenantData(tenantId: string, key: string): Promise<void> {
  const tenantKey = `tenant:${tenantId}:${key}`
  return await window.spark.kv.delete(tenantKey)
}

export async function deleteTenantAllData(tenantId: string): Promise<void> {
  const allKeys = await window.spark.kv.keys()
  const tenantKeys = allKeys.filter(key => key.startsWith(`tenant:${tenantId}:`))
  
  for (const key of tenantKeys) {
    await window.spark.kv.delete(key)
  }
}
