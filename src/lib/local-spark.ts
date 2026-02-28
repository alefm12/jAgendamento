const enableRemoteSpark = typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_REMOTE_SPARK === 'true'

type SparkKV = {
  keys: () => Promise<string[]>
  get: <T>(key: string) => Promise<T | undefined>
  set: <T>(key: string, value: T) => Promise<void>
  delete: (key: string) => Promise<void>
}

type PromptInput = ReadonlyArray<string>

interface SparkRuntime {
  kv: SparkKV
  user: () => Promise<any>
  llm: (...args: any[]) => Promise<any>
  llmPrompt: (strings: PromptInput, ...values: any[]) => string
  [key: string]: any
}

type StorageAdapter = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  keys: () => string[]
}

const KV_PREFIX = '__spark_kv__:'
const USER_CACHE_KEY = '__spark_user__'
const memoryStore = new Map<string, string>()

const defaultLlm = async () => {
  throw new Error('Spark LLM is not configured for local development.')
}

const defaultLlmPrompt = (strings: PromptInput, ...values: any[]) => {
  return strings.reduce((acc, chunk, index) => {
    const value = index < values.length ? values[index] : ''
    return `${acc}${chunk}${value ?? ''}`
  }, '')
}

const createStorageAdapter = (): StorageAdapter => {
  if (typeof window !== 'undefined') {
    try {
      const testKey = '__spark_storage_test__'
      window.localStorage.setItem(testKey, 'ok')
      window.localStorage.removeItem(testKey)
      return {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: (key: string) => window.localStorage.removeItem(key),
        keys: () => {
          const keys: string[] = []
          for (let i = 0; i < window.localStorage.length; i += 1) {
            const keyName = window.localStorage.key(i)
            if (keyName) {
              keys.push(keyName)
            }
          }
          return keys
        }
      }
    } catch {
      // ignore and fall through to memory storage
    }
  }

  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStore.set(key, value),
    removeItem: (key: string) => memoryStore.delete(key),
    keys: () => Array.from(memoryStore.keys())
  }
}

const storage = createStorageAdapter()

const readJson = <T>(key: string): T | undefined => {
  const raw = storage.getItem(key)
  if (raw === null) {
    return undefined
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    storage.removeItem(key)
    return undefined
  }
}

const writeJson = <T>(key: string, value: T) => {
  if (value === undefined) {
    storage.removeItem(key)
    return
  }
  storage.setItem(key, JSON.stringify(value))
}

const localKV: SparkKV = {
  keys: async () => storage.keys()
    .filter(key => key.startsWith(KV_PREFIX))
    .map(key => key.slice(KV_PREFIX.length)),
  get: async <T>(key: string) => readJson<T>(`${KV_PREFIX}${key}`),
  set: async <T>(key: string, value: T) => writeJson(`${KV_PREFIX}${key}`, value),
  delete: async (key: string) => storage.removeItem(`${KV_PREFIX}${key}`)
}

const DEFAULT_USER = {
  login: 'local-admin',
  fullName: 'Administrador Local',
  email: 'admin@localhost',
  isOwner: true
}

const getCachedUser = () => readJson<any>(USER_CACHE_KEY)
const cacheUser = (user: any) => writeJson(USER_CACHE_KEY, user)

let isConfigured = false

export const setupLocalSpark = () => {
  if (isConfigured || typeof window === 'undefined') {
    return
  }
  isConfigured = true

  const windowWithSpark = window as Window & { spark?: SparkRuntime }
  const remoteSpark = enableRemoteSpark ? windowWithSpark.spark : undefined

  if (!enableRemoteSpark && windowWithSpark.spark) {
    console.info('[spark] Remote runtime detected but disabled via VITE_ENABLE_REMOTE_SPARK')
  }
  const baseSpark: SparkRuntime = {
    kv: localKV,
    user: async () => DEFAULT_USER,
    llm: defaultLlm,
    llmPrompt: defaultLlmPrompt
  }
  const runtime: SparkRuntime = remoteSpark ? { ...baseSpark, ...remoteSpark } : baseSpark
  const remoteKV = remoteSpark?.kv

  const withFallback = {
    keys: async () => {
      if (remoteKV?.keys) {
        try {
          const keys = await remoteKV.keys()
          if (Array.isArray(keys)) {
            return keys
          }
        } catch (error) {
          console.warn('[spark] Remote KV keys failed, using local storage', error)
        }
      }
      return localKV.keys()
    },
    get: async <T>(key: string) => {
      if (remoteKV?.get) {
        try {
          const value = await remoteKV.get<T>(key)
          if (value !== undefined) {
            await localKV.set(key, value)
            return value
          }
        } catch (error) {
          console.warn(`[spark] Remote KV get failed for "${key}", using local storage`, error)
        }
      }
      return localKV.get<T>(key)
    },
    set: async <T>(key: string, value: T) => {
      if (remoteKV?.set) {
        try {
          await remoteKV.set(key, value)
        } catch (error) {
          console.warn(`[spark] Remote KV set failed for "${key}", persisting locally`, error)
        }
      }
      await localKV.set(key, value)
    },
    delete: async (key: string) => {
      if (remoteKV?.delete) {
        try {
          await remoteKV.delete(key)
        } catch (error) {
          console.warn(`[spark] Remote KV delete failed for "${key}", deleting locally`, error)
        }
      }
      await localKV.delete(key)
    }
  }

  const resolvedUser = async () => {
    if (runtime.user) {
      try {
        const remoteUser = await runtime.user()
        if (remoteUser && remoteUser.login) {
          cacheUser(remoteUser)
          return remoteUser
        }
      } catch (error) {
        console.warn('[spark] Failed to fetch remote user, using cached user', error)
      }
    }
    return getCachedUser() ?? DEFAULT_USER
  }

  windowWithSpark.spark = {
    ...runtime,
    kv: withFallback,
    user: resolvedUser,
    llm: runtime.llm ?? defaultLlm,
    llmPrompt: runtime.llmPrompt ?? defaultLlmPrompt
  }
}

export type { SparkKV }
