/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-05-13 16:17:34
 * @LastEditors: wangfengxiang
 */
'use strict'

const dbKey = new URL(location.href).host + new URL(location.href).pathname
chrome.runtime.sendMessage(
    {
        type: 'URL_CHANGE',
        payload: { dbKey },
    },
    (response) => {
        console.log(response)
    }
)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DRAFTS') {
        console.log(`Current count is ${request.payload.count}`)
    }

    // Send an empty response
    // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
    sendResponse({})
    return true
})
