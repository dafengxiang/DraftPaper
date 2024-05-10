/*
 * @Description:草稿chrome存储
 * @Author: wangfengxiang
 * @Date: 2024-05-10 16:31:26
 * @LastEditTime: 2024-05-10 17:48:56
 * @LastEditors: wangfengxiang
 */
export const draftsStorage = {
    get: (cb) => {
        chrome.storage.sync.get(
            ['drafts'],
            (result) => cb && cb(result?.drafts ? JSON.parse(result.drafts) : '')
        )
    },
    set: (value, cb) => {
        chrome.storage.sync.set(
            {
                drafts: JSON.stringify(value),
            },
            () => cb && cb()
        )
    },
}
