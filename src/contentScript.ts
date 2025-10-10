/**
 * @description 页面注入脚本 - 负责草稿绘制和元素拖拽功能
 * @author wangfengxiang
 * @date 2024-05-11
 */

import type { DraftsInfo, MessageType, ChromeMessage, ChromeResponse, DragState } from '@/types'
import { CSS_CLASSES, Z_INDEX, APP_CONFIG } from '@/config/constants'
import { debounce, generateDbKey, copyToClipboard, createErrorHandler } from '@/utils/helpers'
import { sanitizeUrl, sanitizeTemplate } from '@/utils/security'

// 错误处理器
const errorHandler = createErrorHandler('ContentScript')

// 全局状态
let draftImgDom: HTMLImageElement | null = null
let draftInfoCache = ''
let innerWidth = window.innerWidth
let widthRatio = 1

// 拖拽状态
const dragState: DragState = {
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  element: null,
}

// 文档点击监听是否已挂载，防止重复添加导致多次打印
let isClickListenerAttached = false

// 当前模板代码
let currentTemplateCode = APP_CONFIG.defaultTemplate
// 当前点击元素的选择器链（清洗后）
let currentSelectorChain = ''

/**
 * 初始化内容脚本
 */
function initContentScript(): void {
  try {
    // 发送URL变化消息
    notifyUrlChange()

    // 初始化样式
    initStyles()

    // 初始化拖拽功能
    initDragFeature()

    // 注册事件监听器
    registerEventListeners()

    // 请求初始草稿信息
    requestDraftsInfo()
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 通知URL变化
 */
function notifyUrlChange(): void {
  const dbKey = generateDbKey(new URL(location.href))
  const message: ChromeMessage = {
    type: 'URL_CHANGE' as MessageType,
    payload: { dbKey },
  }

  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      errorHandler(new Error(`URL变化通知失败: ${chrome.runtime.lastError.message}`))
    }
  })
}

/**
 * 初始化样式
 */
function initStyles(): void {
  // 创建样式标签
  const styleElement = document.createElement('style')
  styleElement.id = 'draft-paper-styles'
  styleElement.textContent = `
    .${CSS_CLASSES.dragBorder} { 
      box-shadow: 0 0 0 2px #f00 !important; 
      cursor: move !important;
    }
    .${CSS_CLASSES.dragPosition} { 
      transform: translate(var(--d-dragX, 0px), var(--d-dragY, 0px)) !important; 
    }
  `

  // 移除已存在的样式（如果有）
  const existingStyle = document.getElementById('draft-paper-styles')
  if (existingStyle) {
    existingStyle.remove()
  }

  document.head.appendChild(styleElement)
}

/**
 * 初始化拖拽功能相关DOM
 */
function initDragFeature(): void {
  // 创建隐藏的输入框用于复制
  const input = document.createElement('input')
  input.id = 'draft-paper-copy-input'
  input.setAttribute('readonly', 'readonly')
  input.style.cssText = `
    width: 1px; 
    height: 0px; 
    opacity: 0; 
    position: absolute; 
    top: 0; 
    left: 0; 
    pointer-events: none;
  `

  // 移除已存在的输入框（如果有）
  const existingInput = document.getElementById('draft-paper-copy-input')
  if (existingInput) {
    existingInput.remove()
  }

  document.body.appendChild(input)
}

/**
 * 注册事件监听器
 */
function registerEventListeners(): void {
  // 窗口大小变化事件（防抖处理）
  const handleResize = debounce(() => {
    innerWidth = window.innerWidth
    if (draftInfoCache) {
      handleDraft(draftInfoCache)
    }
  }, 300)

  window.addEventListener('resize', handleResize)

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    try {
      if (request.type === 'UPDATE_DRAFTS') {
        handleDraft(request.payload.draftsInfo)
      }
      sendResponse({ success: true })
    } catch (error) {
      errorHandler(error as Error)
      sendResponse({ success: false, error: (error as Error).message })
    }
    return true
  })

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    cleanup()
  })
}

/**
 * 请求草稿信息
 */
function requestDraftsInfo(): void {
  const dbKey = generateDbKey(new URL(location.href))
  const message: ChromeMessage = {
    type: 'GET_DRAFTS' as MessageType,
    payload: { dbKey },
  }

  chrome.runtime.sendMessage(message, (response: ChromeResponse) => {
    if (chrome.runtime.lastError) {
      errorHandler(new Error(`获取草稿信息失败: ${chrome.runtime.lastError.message}`))
      return
    }

    if (response.draftsInfo) {
      handleDraft(response.draftsInfo)
    }
  })
}

/**
 * 绘制草稿图片
 * @param draftInfo - 草稿信息
 */
function drawDraft(draftInfo: {
  pic: string
  width: number
  top: number
  left: number
  opacity: number
}): void {
  try {
    if (!draftInfo || !draftInfo.pic) {
      return
    }

    const { pic, width, top, left, opacity } = draftInfo

    // 安全性检查
    const safePic = sanitizeUrl(pic)
    if (!safePic) {
      errorHandler(new Error('不安全的图片URL'))
      return
    }

    // 计算宽度比例
    widthRatio = innerWidth / width

    // 移除旧的草稿图片
    if (draftImgDom) {
      draftImgDom.remove()
    }

    // 创建新的草稿图片
    draftImgDom = document.createElement('img')
    draftImgDom.id = 'draft-paper-image'
    draftImgDom.src = safePic
    draftImgDom.style.cssText = `
      width: 100%;
      top: ${top * widthRatio}px;
      left: ${left * widthRatio}px;
      opacity: ${opacity};
      position: absolute;
      z-index: ${Z_INDEX.draftImage};
      pointer-events: none;
      user-select: none;
    `

    document.body.appendChild(draftImgDom)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理元素拖拽功能
 * @param isEnabled - 是否启用拖拽
 */
function handleElementDrag(isEnabled: boolean): void {
  try {
    if (isEnabled) {
      if (!isClickListenerAttached) {
        document.addEventListener('click', handleElementClick, true)
        isClickListenerAttached = true
      }
    } else {
      if (isClickListenerAttached) {
        document.removeEventListener('click', handleElementClick, true)
        isClickListenerAttached = false
      }
      clearDragState()
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 清理拖拽状态
 */
function clearDragState(): void {
  if (dragState.element) {
    dragState.element.classList.remove(CSS_CLASSES.dragBorder, CSS_CLASSES.dragPosition)
    removeEventListeners(dragState.element)
    dragState.element = null
  }
  resetDragState()
}

/**
 * 重置拖拽状态
 */
function resetDragState(): void {
  dragState.isDragging = false
  dragState.startX = 0
  dragState.startY = 0
  dragState.currentX = 0
  dragState.currentY = 0
}

/**
 * 处理元素点击
 * @param event - 点击事件
 */
function handleElementClick(event: Event): void {
  try {
    const target = event.target as HTMLElement
    if (!target || !target.classList) {
      return
    }

    // 阻止事件传播
    event.stopPropagation()
    event.preventDefault()

    // 打印被点击元素的选择器
    try {
      const selector = getElementSelector(target)
      // eslint-disable-next-line no-console
      console.info('[DraftPaper] clicked selector:', selector)
      const chain = sanitizeSelector(getSelectorChain(target, 6))
      if (chain) {
        // eslint-disable-next-line no-console
        console.info('[DraftPaper] selector chain:', chain)
        currentSelectorChain = chain
      }
    } catch (_e) {
      // ignore selector errors
    }

    // 清理之前选中的元素
    clearDragState()

    // 设置新的拖拽元素
    dragState.element = target
    target.classList.add(CSS_CLASSES.dragBorder, CSS_CLASSES.dragPosition)

    // 添加触摸事件监听器
    addEventListeners(target)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 添加事件监听器
 * @param element - 目标元素
 */
function addEventListeners(element: HTMLElement): void {
  element.addEventListener('touchstart', handleTouchStart, { passive: false })
  element.addEventListener('touchmove', handleTouchMove, { passive: false })
  element.addEventListener('touchend', handleTouchEnd, { passive: false })
}

/**
 * 移除事件监听器
 * @param element - 目标元素
 */
function removeEventListeners(element: HTMLElement): void {
  element.removeEventListener('touchstart', handleTouchStart)
  element.removeEventListener('touchmove', handleTouchMove)
  element.removeEventListener('touchend', handleTouchEnd)
}

/**
 * 处理触摸开始
 * @param event - 触摸事件
 */
function handleTouchStart(event: TouchEvent): void {
  try {
    event.preventDefault()
    const touch = event.touches[0]
    dragState.isDragging = true
    dragState.startX = touch.clientX
    dragState.startY = touch.clientY
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理触摸移动
 * @param event - 触摸事件
 */
function handleTouchMove(event: TouchEvent): void {
  try {
    if (!dragState.isDragging || !dragState.element) {
      return
    }

    event.stopPropagation()
    const touch = event.touches[0]
    const deltaX = touch.clientX - dragState.startX
    const deltaY = touch.clientY - dragState.startY

    // 更新元素位置
    dragState.element.style.setProperty('--d-dragX', `${deltaX}px`)
    dragState.element.style.setProperty('--d-dragY', `${deltaY}px`)

    dragState.currentX = touch.clientX
    dragState.currentY = touch.clientY
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理触摸结束
 * @param _event - 触摸事件
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleTouchEnd(_event: TouchEvent): Promise<void> {
  try {
    if (!dragState.isDragging) {
      return
    }

    dragState.isDragging = false

    // 在复制前刷新最新模板，避免消息不同步导致使用旧模板
    await refreshTemplateFromDB()

    // 计算最终位置
    const deltaX = Math.round((dragState.currentX - dragState.startX) / widthRatio)
    const deltaY = Math.round((dragState.currentY - dragState.startY) / widthRatio)

    // 生成代码
    const code = generatePositionCode(deltaX, deltaY)

    // 复制到剪贴板
    const success = await copyToClipboard(code)

    if (success) {
      // eslint-disable-next-line no-console
      console.info('✅ 模版已复制到剪贴板:', code)
    } else {
      errorHandler(new Error('复制失败'))
    }

    // 重置拖拽状态
    resetDragState()
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 生成位置代码
 * @param deltaX - X轴偏移
 * @param deltaY - Y轴偏移
 * @returns 生成的代码
 */
function generatePositionCode(deltaX: number, deltaY: number): string {
  try {
    const safeTemplate = sanitizeTemplate(currentTemplateCode)
    return safeTemplate
      .replace(/\{top\}/gi, deltaY.toString())
      .replace(/\{left\}/gi, deltaX.toString())
      .replace(/\{selector\}/gi, currentSelectorChain || '')
  } catch (error) {
    errorHandler(error as Error)
    return APP_CONFIG.defaultTemplate
      .replace(/\{top\}/gi, deltaY.toString())
      .replace(/\{left\}/gi, deltaX.toString())
      .replace(/\{selector\}/gi, currentSelectorChain || '')
  }
}

/**
 * 获取元素的单节点 CSS 选择器（不包含祖先）
 */
function getElementSelector(element: Element): string {
  if (!(element instanceof Element)) return ''
  if (element.id) return `#${cssEscape(element.id)}`
  return buildNodeSelector(element)
}

function buildNodeSelector(node: Element): string {
  const tag = node.tagName.toLowerCase()

  // 使用类名（最多两个，避免过长）
  const classList = Array.from(node.classList).slice(0, 2)
  if (classList.length) {
    const base = `${tag}.${classList.map((c) => cssEscape(c)).join('.')}`
    const parent = node.parentElement
    if (!parent) return base
    // 如果同级存在相同 tag+classes，则加 :nth-child
    const siblings = Array.from(parent.children) as Element[]
    const same = siblings.filter(
      (el) =>
        el.tagName.toLowerCase() === tag &&
        classList.every((c) => (el as Element).classList.contains(c))
    )
    if (same.length > 1) {
      const index = siblings.indexOf(node) + 1
      return `${base}:nth-child(${index})`
    }
    return base
  }

  // 退化到 nth-child
  const parent = node.parentElement
  if (!parent) return tag
  const children = Array.from(parent.children)
  const index = children.indexOf(node) + 1
  return `${tag}:nth-child(${index})`
}

function cssEscape(text: string): string {
  return text
    .replace(/"/g, '\\"')
    .replace(/\n|\r|\t/g, ' ')
    .replace(/([!"#$%&'()*+,./:;<=>?@\[\]^`{|}~])/g, '\\$1')
}

/**
 * 获取上级（祖先）元素的选择器列表
 * @param element 目标元素
 * @param maxDepth 最多向上追溯层级
 * @returns 由近到远的祖先选择器数组
 */
function getAncestorSelectors(element: Element, maxDepth = 5): string[] {
  const selectors: string[] = []
  let current: Element | null = element.parentElement
  let depth = 0

  while (current && depth < maxDepth && current !== document.body) {
    try {
      const sel = current.id ? `#${cssEscape(current.id)}` : buildNodeSelector(current)
      if (sel) selectors.push(sel)
    } catch (_e) {
      // ignore
    }
    current = current.parentElement
    depth += 1
  }

  return selectors
}

/**
 * 获取祖先到目标的选择器链（以 ' > ' 连接）
 */
function getSelectorChain(element: Element, maxDepth = 5): string {
  const parts: string[] = []
  const parents = getAncestorSelectors(element, maxDepth)
  if (parents.length) parts.push(...parents.reverse())
  const self = getElementSelector(element)
  if (self) parts.push(self)
  return parts.join(' > ')
}

/**
 * 从数据库刷新当前模板，确保使用最新的自定义模板
 */
async function refreshTemplateFromDB(): Promise<void> {
  try {
    const dbKey = generateDbKey(new URL(location.href))
    const message: ChromeMessage = {
      type: 'GET_DRAFTS' as MessageType,
      payload: { dbKey },
    }
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(message, (response: ChromeResponse) => {
        try {
          if (chrome.runtime.lastError) {
            resolve()
            return
          }
          if (response && response.draftsInfo) {
            draftInfoCache = response.draftsInfo
            const info: DraftsInfo = JSON.parse(response.draftsInfo)
            currentTemplateCode = info.templateCode || APP_CONFIG.defaultTemplate
          }
        } catch (_e) {
          // ignore
        }
        resolve()
      })
    })
  } catch (_error) {
    // ignore
  }
}

/**
 * 移除属性选择器，仅保留标签与类名（以及 :nth-child）
 */
function sanitizeSelector(selector: string): string {
  // 去除所有 [attr=...] 片段
  return selector.replace(/\[[^\]]*\]/g, '')
}

/**
 * 处理草稿信息更新
 * @param draftsInfoJSON - 草稿信息JSON字符串
 */
function handleDraft(draftsInfoJSON: string): void {
  try {
    if (!draftsInfoJSON) {
      return
    }

    draftInfoCache = draftsInfoJSON
    const draftsInfo: DraftsInfo = JSON.parse(draftsInfoJSON)

    const { list = [], selectedIdx = 0, templateCode = '', isCanPick = false } = draftsInfo

    // 更新模板代码
    currentTemplateCode = templateCode || APP_CONFIG.defaultTemplate

    // 绘制选中的草稿
    const draftInfo = list[selectedIdx]
    if (draftInfo && draftInfo.pic) {
      drawDraft(draftInfo)
    } else if (draftImgDom) {
      draftImgDom.remove()
      draftImgDom = null
    }

    // 处理拖拽功能
    handleElementDrag(isCanPick)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 清理资源
 */
function cleanup(): void {
  try {
    // 移除草稿图片
    if (draftImgDom) {
      draftImgDom.remove()
      draftImgDom = null
    }

    // 清理拖拽状态
    clearDragState()

    // 移除样式
    const styleElement = document.getElementById('draft-paper-styles')
    if (styleElement) {
      styleElement.remove()
    }

    // 移除输入框
    const inputElement = document.getElementById('draft-paper-copy-input')
    if (inputElement) {
      inputElement.remove()
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

// 立即执行函数，避免全局污染
;(function () {
  // 确保在DOM加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript)
  } else {
    initContentScript()
  }
})()
