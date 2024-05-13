/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-05-13 19:07:14
 * @LastEditors: wangfengxiang
 */
'use strict'

// 路径改变强制关闭插件
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

// 监听消息，绘制草稿
let draftImgDom = document.createElement('img'),
    drawDraft = (draftsInfoJSON) => {
        if (!draftsInfoJSON) return
        const draftsInfo = JSON.parse(draftsInfoJSON),
            { pic, top, left, opacity } = draftsInfo?.list?.[draftsInfo?.selectedIdx] ?? {}

        if (!pic) return

        draftImgDom.setAttribute('src', pic)
        draftImgDom.style = `width:100%;top:${top}px;left:${left}px;opacity:${opacity};position:absolute;z-index:999999;pointer-events:none;`
        document.body.appendChild(draftImgDom)
    }

const draftsInfoJSON = sessionStorage.getItem('draftsInfo')
sessionStorage.getItem('dbKey') === dbKey && drawDraft(draftsInfoJSON)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DRAFTS') {
        sessionStorage.setItem('dbKey', dbKey)
        sessionStorage.setItem('draftsInfo', request.payload.draftsInfo)
        drawDraft(request.payload.draftsInfo)
    }

    // Send an empty response
    // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
    sendResponse({})
    return true
})
