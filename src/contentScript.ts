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

// 当前模板代码
let currentTemplateCode = APP_CONFIG.defaultTemplate

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
      document.addEventListener('click', handleElementClick, true)
    } else {
      document.removeEventListener('click', handleElementClick, true)
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

    // 计算最终位置
    const deltaX = Math.round((dragState.currentX - dragState.startX) / widthRatio)
    const deltaY = Math.round((dragState.currentY - dragState.startY) / widthRatio)

    // 生成代码
    const code = generatePositionCode(deltaX, deltaY)

    // 复制到剪贴板
    const success = await copyToClipboard(code)

    if (success) {
      // eslint-disable-next-line no-console
      console.info('位置代码已复制:', code)
      showCopyNotification()
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
  } catch (error) {
    errorHandler(error as Error)
    return APP_CONFIG.defaultTemplate
      .replace(/\{top\}/gi, deltaY.toString())
      .replace(/\{left\}/gi, deltaX.toString())
  }
}

/**
 * 显示复制成功通知
 */
function showCopyNotification(): void {
  // 可以添加视觉反馈，比如toast消息
  // eslint-disable-next-line no-console
  console.log('✅ 位置代码已复制到剪贴板')
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
