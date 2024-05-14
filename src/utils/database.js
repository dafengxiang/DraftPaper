const dbName = 'draftPaper', // 数据库名称
    storeName = 'draft_info' // 表格名称

let db // 数据库对象

/**
 * 封装的方法以及用法
 * 打开数据库
 */
export function openDB(fromSw = false, version = 1) {
    return new Promise((resolve, reject) => {
        const idxDB = fromSw ? indexedDB : window.indexedDB,
            request = idxDB.open(dbName, version)

        request.onsuccess = function (event) {
            db = event.target.result // 数据库对象
            resolve(db)
        }

        request.onerror = function (event) {
            reject(event)
        }

        request.onupgradeneeded = function (event) {
            // 数据库创建或升级的时候会触发
            console.log('onupgradeneeded')
            db = event.target.result // 数据库对象
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'url_path' }) // 创建表
            }
        }
    })
}

/**
 * 新增数据
 */
export function addData(data) {
    return new Promise((resolve, reject) => {
        const request = db
            .transaction([storeName], 'readwrite') // 事务对象 指定表格名称和操作模式（"只读"或"读写"）
            .objectStore(storeName) // 仓库对象
            .add(data)

        request.onsuccess = function (event) {
            resolve(event)
        }

        request.onerror = function (event) {
            reject(event)
            throw new Error(event.target.error)
        }
    })
}

/**
 * 通过主键读取数据
 */
export function getDataByKey(key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName]) // 事务
        const objectStore = transaction.objectStore(storeName) // 仓库对象
        const request = objectStore.get(key)

        request.onerror = function (event) {
            reject(event)
        }

        request.onsuccess = function (event) {
            resolve(request.result)
        }
    })
}

/**
 * 更新数据
 */
export function updateDB(data) {
    const request = db
        .transaction([storeName], 'readwrite') // 事务对象
        .objectStore(storeName) // 仓库对象
        .put(data)

    return new Promise((resolve, reject) => {
        request.onsuccess = function (ev) {
            resolve(ev)
        }

        request.onerror = function (ev) {
            resolve(ev)
        }
    })
}

/**
 * 关闭数据库
 */
export function closeDB(db) {
    db.close()
    console.log('数据库已关闭')
}

export default {
    openDB,
    addData,
    getDataByKey,
    updateDB,
    closeDB,
}
