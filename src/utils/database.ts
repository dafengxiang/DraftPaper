import type { DatabaseItem } from '@/types'
import { DB_CONFIG } from '@/config/constants'
import { createErrorHandler } from './helpers'

const errorHandler = createErrorHandler('Database')

let db: IDBDatabase | null = null

/**
 * 打开数据库
 * @param fromSw - 是否来自Service Worker
 * @param version - 数据库版本
 * @returns Promise<IDBDatabase>
 */
export function openDB(fromSw = false, version = DB_CONFIG.version): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const idxDB = fromSw ? indexedDB : window.indexedDB

      if (!idxDB) {
        throw new Error('IndexedDB 不受支持')
      }

      const request = idxDB.open(DB_CONFIG.name, version)

      request.onsuccess = (event) => {
        db = (event.target as IDBOpenDBRequest).result
        resolve(db)
      }

      request.onerror = (event) => {
        const error = new Error(`数据库打开失败: ${(event.target as IDBOpenDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      request.onupgradeneeded = (event) => {
        // eslint-disable-next-line no-console
        console.log('数据库升级中...')
        db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
          const store = db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'url_path' })
          // 可以添加索引
          store.createIndex('url_path', 'url_path', { unique: true })
        }
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}

/**
 * 验证数据库连接
 */
function ensureDBConnection(): void {
  if (!db) {
    throw new Error('数据库未连接，请先调用 openDB()')
  }
}

/**
 * 新增数据
 * @param data - 要添加的数据
 * @returns Promise<void>
 */
export function addData(data: DatabaseItem): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ensureDBConnection()

      const transaction = db!.transaction([DB_CONFIG.storeName], 'readwrite')
      const store = transaction.objectStore(DB_CONFIG.storeName)
      const request = store.add(data)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = (event) => {
        const error = new Error(`数据添加失败: ${(event.target as IDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      transaction.onerror = (event) => {
        const error = new Error(`事务失败: ${(event.target as IDBTransaction).error}`)
        errorHandler(error)
        reject(error)
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}

/**
 * 通过主键读取数据
 * @param key - 主键
 * @returns Promise<DatabaseItem | null>
 */
export function getDataByKey(key: string): Promise<DatabaseItem | null> {
  return new Promise((resolve, reject) => {
    try {
      ensureDBConnection()

      const transaction = db!.transaction([DB_CONFIG.storeName], 'readonly')
      const store = transaction.objectStore(DB_CONFIG.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = (event) => {
        const error = new Error(`数据读取失败: ${(event.target as IDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      transaction.onerror = (event) => {
        const error = new Error(`事务失败: ${(event.target as IDBTransaction).error}`)
        errorHandler(error)
        reject(error)
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}

/**
 * 更新数据
 * @param data - 要更新的数据
 * @returns Promise<void>
 */
export function updateDB(data: DatabaseItem): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ensureDBConnection()

      const transaction = db!.transaction([DB_CONFIG.storeName], 'readwrite')
      const store = transaction.objectStore(DB_CONFIG.storeName)
      const request = store.put(data)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = (event) => {
        const error = new Error(`数据更新失败: ${(event.target as IDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      transaction.onerror = (event) => {
        const error = new Error(`事务失败: ${(event.target as IDBTransaction).error}`)
        errorHandler(error)
        reject(error)
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}

/**
 * 删除数据
 * @param key - 要删除的数据键
 * @returns Promise<void>
 */
export function deleteData(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ensureDBConnection()

      const transaction = db!.transaction([DB_CONFIG.storeName], 'readwrite')
      const store = transaction.objectStore(DB_CONFIG.storeName)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = (event) => {
        const error = new Error(`数据删除失败: ${(event.target as IDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      transaction.onerror = (event) => {
        const error = new Error(`事务失败: ${(event.target as IDBTransaction).error}`)
        errorHandler(error)
        reject(error)
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}

/**
 * 关闭数据库
 */
export function closeDB(): void {
  if (db) {
    db.close()
    db = null
    // eslint-disable-next-line no-console
    console.log('数据库已关闭')
  }
}

/**
 * 获取所有数据
 * @returns Promise<DatabaseItem[]>
 */
export function getAllData(): Promise<DatabaseItem[]> {
  return new Promise((resolve, reject) => {
    try {
      ensureDBConnection()

      const transaction = db!.transaction([DB_CONFIG.storeName], 'readonly')
      const store = transaction.objectStore(DB_CONFIG.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = (event) => {
        const error = new Error(`数据读取失败: ${(event.target as IDBRequest).error}`)
        errorHandler(error)
        reject(error)
      }

      transaction.onerror = (event) => {
        const error = new Error(`事务失败: ${(event.target as IDBTransaction).error}`)
        errorHandler(error)
        reject(error)
      }
    } catch (error) {
      errorHandler(error as Error)
      reject(error)
    }
  })
}
