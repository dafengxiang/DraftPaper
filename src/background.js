'use strict'

import { openDB, getDataByKey } from './utils/database'

console.log('draft extension background script is running')

// 监听获取草稿信息请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_DRAFTS') {
        openDB(true).then(async () => {
            const data = await getDataByKey(request.payload.dbKey),
                { val: draftsInfo = '' } = data ?? {}
            sendResponse({ draftsInfo })
        })
        return true
    }
    if (request.type === 'URL_CHANGE') {
        sendResponse('background received url change')
    }
})
