/*
 * @Description:
 * @Author: wangfengxiang
 * @Date: 2024-05-11 11:34:20
 * @LastEditTime: 2024-06-06 11:36:09
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

function drawDraft(draftInfo) {
    if (!draftInfo) return
    const { pic, width, top, left, opacity } = draftInfo

    if (!pic) return

    // 缓存草稿信息
    widthRatio = innerWidth / width

    draftImgDom.setAttribute('src', pic)
    draftImgDom.style = `width:100%;top:${top * widthRatio}px;left:${
        left * widthRatio
    }px;opacity:${opacity};position:absolute;z-index:999999;pointer-events:none;`
    document.body.appendChild(draftImgDom)
}

window.addEventListener('resize', (e) => {
    innerWidth = e.currentTarget.innerWidth
    handleDraft(draftInfoCache)
})

// 元素拖动
const draftStyleDom = document.createElement('style')
draftStyleDom.innerHTML = `
.draft-drag-border {
    box-shadow: 0 0 0 2px #f00 !important;
}
.draft-drag-position {
    transform: translate(var(--d-dragX,0px), var(--d-dragY,0px)) !important;
}
`
let selectedElement = null,
    selectedClientX = 0,
    selectedClientY = 0,
    currentClientX = 0,
    currentClientY = 0

document.head.appendChild(draftStyleDom)
let input = document.createElement('input')
input.setAttribute('readonly', 'readonly')
input.setAttribute(
    'style',
    'width:1px;height:0px;opacity:0;position:absolute;top:0;left:0;pointer-events:none;'
)
document.body.appendChild(input)

function handleElementDrag(isCanDrag = false) {
    if (isCanDrag) {
        document.addEventListener('click', handleClick, true)
    } else {
        document.removeEventListener('click', handleClick, true)
    }
}

function handleClick(e) {
    if (!e?.target?.classList) return
    e.stopPropagation && e.stopPropagation()

    if (selectedElement?.classList) {
        selectedElement.classList.remove('draft-drag-border')
        selectedElement.removeEventListener('touchstart', handleTouchStart, true)
        selectedElement.removeEventListener('touchmove', handleTouchMove, true)
        selectedElement.addEventListener('touchend', handleTouchEnd, true)
    }

    selectedElement = e.target

    selectedElement.classList.add('draft-drag-border', 'draft-drag-position')
    selectedElement.addEventListener('touchstart', handleTouchStart, true)
    selectedElement.addEventListener('touchmove', handleTouchMove, true)
    selectedElement.addEventListener('touchend', handleTouchEnd, true)
}

function handleTouchStart(e) {
    e.preventDefault && e.preventDefault()
    const { clientX, clientY } = e.touches[0]
    selectedClientX = clientX
    selectedClientY = clientY
}
function handleTouchMove(e) {
    e.stopPropagation && e.stopPropagation()
    const { clientX, clientY } = e.touches[0],
        styleStr = e?.target?.getAttribute('style') ?? ''
    styleStr?.replace(/--d-dragX:\s*([0-9.-]+)px;\s*--d-dragY:\s*([0-9.-]+)px;/g, '')

    e.target.style =
        styleStr +
        `--d-dragX:${clientX - selectedClientX}px;--d-dragY:${clientY - selectedClientY}px;`

    currentClientX = clientX
    currentClientY = clientY
}
function handleTouchEnd(e) {
    const template = '.ab($ypx, $xpx);'
    const x = parseInt((currentClientX - selectedClientX) / widthRatio),
        y = parseInt((currentClientY - selectedClientY) / widthRatio),
        copyRes = template.replace(/\$y/gi, y).replace(/\$x/gi, x)
    input.setAttribute('value', copyRes)
    input.select()
    if (document.execCommand('copy')) {
        document.execCommand('copy')
        const classNames = e?.target?.className ?? ''

        console.info(
            `${classNames.replace(/draft-drag-position|draft-drag-border/g, '')}: ${copyRes}`
        )
    }
}

function handleDraft(draftsInfoJSON) {
    if (!draftsInfoJSON) return
    draftInfoCache = draftsInfoJSON
    const draftsInfo = JSON.parse(draftsInfoJSON),
        { list = [], selectedIdx = 0, isCanPick = false } = draftsInfo ?? {},
        draftInfo = list[selectedIdx] ?? {}
    if (draftInfo.pic) drawDraft(draftInfo)
    handleElementDrag(isCanPick)
}

// 页面进入，发送请求获取草稿信息
chrome.runtime.sendMessage(
    {
        type: 'GET_DRAFTS',
        payload: { dbKey },
    },
    (response) => handleDraft(response?.draftsInfo)
)

// 监听消息，更新草稿
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DRAFTS') handleDraft(request.payload.draftsInfo)
    sendResponse({})
    return true
})
