/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-05-14 10:59:56
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

// 绘制草稿
let draftImgDom = document.createElement('img'),
    draftInfoCache = '',
    innerWidth = window.innerWidth,
    widthRatio = 1

const drawDraft = (draftsInfoJSON) => {
    if (!draftsInfoJSON) return
    const draftsInfo = JSON.parse(draftsInfoJSON),
        { pic, width, top, left, opacity } = draftsInfo?.list?.[draftsInfo?.selectedIdx] ?? {}

    if (!pic) return

    // 缓存草稿信息
    draftInfoCache = draftsInfoJSON
    widthRatio = innerWidth / width

    draftImgDom.setAttribute('src', pic)
    draftImgDom.style = `width:100%;top:${top * widthRatio}px;left:${
        left * widthRatio
    }px;opacity:${opacity};position:absolute;z-index:999999;pointer-events:none;`
    document.body.appendChild(draftImgDom)
}

window.addEventListener('resize', (e) => {
    innerWidth = e.currentTarget.innerWidth
    drawDraft(draftInfoCache)
})

// 页面进入，发送请求获取草稿信息
chrome.runtime.sendMessage(
    {
        type: 'GET_DRAFTS',
        payload: { dbKey },
    },
    (response) => drawDraft(response?.draftsInfo)
)

// 监听消息，更新草稿
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DRAFTS') drawDraft(request.payload.draftsInfo)
    sendResponse({})
    return true
})
