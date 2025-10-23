/**
 * @description 页面注入脚本 - 负责草稿绘制和元素拖拽功能
 * @author wangfengxiang
 * @date 2024-05-11
 */

import type {
  DraftsInfo,
  MessageType,
  ChromeMessage,
  ChromeResponse,
  DragState,
  DragMemory,
  DragMemoryItem,
} from '@/types'
import { CSS_CLASSES, Z_INDEX, APP_CONFIG } from '@/config/constants'
import {
  debounce,
  generateDbKey,
  generateDragMemoryDbKey,
  copyToClipboard,
  createErrorHandler,
} from '@/utils/helpers'
import { sanitizeUrl, sanitizeTemplate } from '@/utils/security'

// 错误处理器
const errorHandler = createErrorHandler('ContentScript')

// 全局状态
let draftImgDom: HTMLImageElement | null = null
let draftInfoCache = ''
let innerWidth = window.innerWidth
let widthRatio = 1
let currentDraftWidth = 375 // 默认设计稿宽度

// 拖拽状态
const dragState: DragState = {
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  element: null,
}

// 当前拖拽开始时的已存在偏移（从 CSS 变量读取）
let baseVarX = 0
let baseVarY = 0

// 文档点击监听是否已挂载，防止重复添加导致多次打印
let isClickListenerAttached = false

// 当前模板代码
let currentTemplateCode = APP_CONFIG.defaultTemplate
// 当前点击元素的选择器链（清洗后）
let currentSelectorChain = ''

// 拖拽记忆功能
let dragMemory: DragMemory = {
  items: [],
  url: location.href,
  lastUpdated: Date.now(),
}

// 取色器状态
let isColorPickerActive = false
let magnifierElement: HTMLDivElement | null = null
let originalOpacity: number | null = null // 保存原始透明度
let pageScreenshot: string | null = null
let isScrollLocked = false
let isMemoryModeEnabled = false

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

    // 加载拖拽记忆并应用
    loadDragMemoryFromDB().then(() => {
      if (isMemoryModeEnabled) applyAllDragMemories()
    })
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
      } else if (request.type === 'TOGGLE_COLOR_PICKER') {
        handleColorPickerToggle(request.payload.isActive || false, request.payload.opacity)
      } else if (request.type === 'PING') {
        // 简单的ping响应，用于检查内容脚本是否可用
        sendResponse({ success: true, message: 'Content script is ready' })
        return true
      } else if (request.type === 'GET_COLOR_PICKER_STATE') {
        // 获取当前取色器状态
        sendResponse({
          success: true,
          isActive: isColorPickerActive,
          originalOpacity: originalOpacity,
        })
        return true
      } else if (request.type === 'TOGGLE_MEMORY_MODE') {
        // 切换记忆模式
        try {
          isMemoryModeEnabled = !!request.payload.memoryModeEnabled
          console.log(`[DraftPaper] 内容脚本记忆模式状态更新: ${isMemoryModeEnabled}`)
          if (isMemoryModeEnabled) {
            applyAllDragMemories()
          } else {
            // 关闭记忆模式时，移除仅通过变量造成的偏移（不改动页面原有样式）
            document.querySelectorAll(`.${CSS_CLASSES.dragPosition}`).forEach((el) => {
              const node = el as HTMLElement
              node.style.removeProperty('--d-dragX')
              node.style.removeProperty('--d-dragY')
              // 保留类名，以保持拖动动画特性，但位移归零
            })
          }
          sendResponse({ success: true })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
      } else if (request.type === 'GET_DRAG_MEMORY') {
        // 获取拖拽记忆
        sendResponse({
          success: true,
          dragMemory: JSON.stringify(dragMemory),
        })
        return true
      } else if (request.type === 'ADD_DRAG_MEMORY') {
        // 添加拖拽记忆
        try {
          const memoryItem = JSON.parse(request.payload.dragMemoryItem || '{}')
          if (!dragMemory.items) {
            dragMemory.items = []
          }
          dragMemory.items.push(memoryItem)
          dragMemory.lastUpdated = Date.now()
          saveDragMemoryToDB()
            .then(() => {
              sendResponse({ success: true })
            })
            .catch((error) => {
              sendResponse({ success: false, error: (error as Error).message })
            })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
      } else if (request.type === 'REMOVE_DRAG_MEMORY') {
        // 删除拖拽记忆
        try {
          const memoryId = request.payload.memoryId
          if (!dragMemory.items) {
            dragMemory.items = []
          }

          // 找到要删除的记忆项，恢复其元素位置
          const itemToRemove = dragMemory.items.find((item) => item.id === memoryId)
          if (itemToRemove) {
            const el = document.querySelector(itemToRemove.selector) as HTMLElement | null
            if (el) {
              // 恢复元素到初始位置
              el.style.removeProperty('--d-dragX')
              el.style.removeProperty('--d-dragY')
              el.classList.remove(CSS_CLASSES.dragPosition)
            }
          }

          dragMemory.items = dragMemory.items.filter((item) => item.id !== memoryId)
          dragMemory.lastUpdated = Date.now()
          saveDragMemoryToDB()
            .then(() => {
              sendResponse({ success: true })
            })
            .catch((error) => {
              sendResponse({ success: false, error: (error as Error).message })
            })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
      } else if (request.type === 'CLEAR_DRAG_MEMORY') {
        // 清空拖拽记忆
        try {
          if (!dragMemory.items) {
            dragMemory.items = []
          }

          // 恢复所有元素到初始位置
          dragMemory.items.forEach((item) => {
            const el = document.querySelector(item.selector) as HTMLElement | null
            if (el) {
              // 恢复元素到初始位置
              el.style.removeProperty('--d-dragX')
              el.style.removeProperty('--d-dragY')
              el.classList.remove(CSS_CLASSES.dragPosition)
            }
          })

          dragMemory.items = []
          dragMemory.lastUpdated = Date.now()
          saveDragMemoryToDB()
            .then(() => {
              sendResponse({ success: true })
            })
            .catch((error) => {
              sendResponse({ success: false, error: (error as Error).message })
            })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
      } else if (request.type === 'GENERATE_DRAG_MEMORY_SUMMARY') {
        // 生成拖拽记忆汇总
        try {
          const summary = generateDragMemorySummary()
          copyToClipboard(summary)
            .then((success) => {
              sendResponse({ success, summary })
            })
            .catch((error) => {
              sendResponse({ success: false, error: (error as Error).message })
            })
        } catch (error) {
          sendResponse({ success: false, error: (error as Error).message })
        }
        return true
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
    currentDraftWidth = width // 保存当前设计稿宽度

    // 在记忆模式下，确保 widthRatio 被正确设置
    if (isMemoryModeEnabled) {
      console.log(
        `[DraftPaper] 设计稿宽度: ${width}px, 屏幕宽度: ${innerWidth}px, 缩放比例: ${widthRatio}`
      )
    }

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
    // 在记忆模式下，不移除 dragPosition 类，保持元素位置
    if (isMemoryModeEnabled) {
      dragState.element.classList.remove(CSS_CLASSES.dragBorder)
    } else {
      dragState.element.classList.remove(CSS_CLASSES.dragBorder, CSS_CLASSES.dragPosition)
    }
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
  // 在记忆模式下，保持 baseVarX/baseVarY 不变，确保元素位置持久化
  if (!isMemoryModeEnabled) {
    baseVarX = 0
    baseVarY = 0
  }
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

    // 在记忆模式下，确保新元素有正确的CSS变量值
    if (isMemoryModeEnabled) {
      const existingX = parseFloat(target.style.getPropertyValue('--d-dragX')) || 0
      const existingY = parseFloat(target.style.getPropertyValue('--d-dragY')) || 0
      target.style.setProperty('--d-dragX', `${existingX}px`)
      target.style.setProperty('--d-dragY', `${existingY}px`)
    }

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
    // 安全地调用 preventDefault
    if (event.cancelable) {
      event.preventDefault()
    }
    const touch = event.touches[0]
    dragState.isDragging = true
    dragState.startX = touch.clientX
    dragState.startY = touch.clientY

    // 确保拖拽比例正确
    ensureDragRatio()

    // 读取当前元素的CSS变量偏移作为基础偏移
    if (dragState.element) {
      baseVarX = parseFloat(dragState.element.style.getPropertyValue('--d-dragX')) || 0
      baseVarY = parseFloat(dragState.element.style.getPropertyValue('--d-dragY')) || 0
    } else {
      baseVarX = 0
      baseVarY = 0
    }
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

    // 直接使用拖拽距离，不处理倍数
    const adjX = deltaX
    const adjY = deltaY

    // 更新元素位置（基础 + 相对）
    dragState.element.style.setProperty('--d-dragX', `${baseVarX + adjX}px`)
    dragState.element.style.setProperty('--d-dragY', `${baseVarY + adjY}px`)

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

    // 计算最终位置（相对位移，不处理倍数）
    const deltaX = dragState.currentX - dragState.startX
    const deltaY = dragState.currentY - dragState.startY
    // 总偏移 = 基础偏移 + 本次相对位移
    const totalX = baseVarX + deltaX
    const totalY = baseVarY + deltaY

    // 生成代码（在记忆模式下，将像素值除以草稿倍数）
    const code = isMemoryModeEnabled
      ? generatePositionCode(deltaX / widthRatio, deltaY / widthRatio)
      : generatePositionCode(deltaX, deltaY)

    // 复制到剪贴板
    const success = await copyToClipboard(code)

    if (success) {
      // eslint-disable-next-line no-console
      console.info('✅ 模版已复制到剪贴板:', code)
    } else {
      errorHandler(new Error('复制失败'))
    }

    // 只在记忆模式下保存拖拽记忆
    console.log(`[DraftPaper] 检查记忆模式状态: ${isMemoryModeEnabled}`)
    if (isMemoryModeEnabled) {
      const memoryX = totalX / widthRatio
      const memoryY = totalY / widthRatio
      await saveDragMemory(memoryX, memoryY)
    }

    // 最终应用总偏移到元素样式
    if (dragState.element) {
      dragState.element.style.setProperty('--d-dragX', `${totalX}px`)
      dragState.element.style.setProperty('--d-dragY', `${totalY}px`)
      dragState.element.classList.add(CSS_CLASSES.dragPosition)
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
    // 根据记忆模式选择模板
    const template = isMemoryModeEnabled ? APP_CONFIG.defaultMemoryTemplate : currentTemplateCode
    console.log(`[DraftPaper] 生成代码使用模板: ${isMemoryModeEnabled ? '记忆模板' : '普通模板'}`)
    const safeTemplate = sanitizeTemplate(template)
    return safeTemplate
      .replace(/\{top\}/gi, deltaY.toString())
      .replace(/\{left\}/gi, deltaX.toString())
      .replace(/\{selector\}/gi, currentSelectorChain || '')
  } catch (error) {
    errorHandler(error as Error)
    const fallbackTemplate = isMemoryModeEnabled
      ? APP_CONFIG.defaultMemoryTemplate
      : APP_CONFIG.defaultTemplate
    return fallbackTemplate
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

  // 过滤掉拖拽功能添加的类名
  const dragClasses = [CSS_CLASSES.dragBorder, CSS_CLASSES.dragPosition]
  const classList = Array.from(node.classList)
    .filter((className) => !dragClasses.includes(className as any))
    .slice(0, 2) // 最多两个，避免过长

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
      // 为祖先元素也过滤拖拽类名
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

    // 清理取色器
    if (isColorPickerActive) {
      removeMagnifier()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('click', handleColorClick, true)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUp)
      if (magnifierUpdateTimeout) {
        clearTimeout(magnifierUpdateTimeout)
        magnifierUpdateTimeout = null
      }
      isColorPickerActive = false
    }

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

/**
 * 处理取色器切换
 * @param isActive - 是否激活取色器
 * @param opacity - 草稿图片透明度
 */
function handleColorPickerToggle(isActive: boolean, opacity: number): void {
  try {
    // 如果状态没有变化，直接返回
    if (isColorPickerActive === isActive) {
      // eslint-disable-next-line no-console
      console.log('[DraftPaper] Color picker state unchanged, skipping')
      return
    }

    isColorPickerActive = isActive

    if (isActive) {
      // 保存当前透明度
      if (draftImgDom) {
        originalOpacity = parseFloat(draftImgDom.style.opacity)
        // 设置草稿图片透明度为100%
        draftImgDom.style.opacity = '1'
      }

      // 锁定页面滚动
      lockPageScroll()

      // 创建页面截图
      createPageScreenshot().then(() => {
        // 确保截图创建成功后再继续
        if (pageScreenshot) {
          // 创建放大镜
          createMagnifier()

          // 添加鼠标移动监听
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('click', handleColorClick, true) // 使用capture阶段确保优先处理

          // 检测是否为移动端模拟模式，如果是则强制启用鼠标事件
          const isMobileSimulation =
            window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
          if (isMobileSimulation) {
            // 在移动端模拟模式下，强制启用鼠标事件
            document.addEventListener('mousemove', handleMouseMove, { passive: false })
          }

          // 添加触摸事件支持（用于手机模式）
          document.addEventListener('touchstart', handleColorPickerTouchStart, { passive: false })
          document.addEventListener('touchmove', handleColorPickerTouchMove, { passive: false })
          document.addEventListener('touchend', handleColorPickerTouchEnd, { passive: false })

          // 添加移动端鼠标事件支持（用于设备模拟模式）
          document.addEventListener('pointermove', handlePointerMove, { passive: false })
          document.addEventListener('pointerdown', handlePointerDown, { passive: false })
          document.addEventListener('pointerup', handlePointerUp, { passive: false })

          // 立即显示放大镜（在鼠标当前位置）
          if (magnifierElement) {
            magnifierElement.style.display = 'block'
            // 触发一次鼠标移动事件来更新放大镜位置
            const mouseEvent = new MouseEvent('mousemove', {
              clientX: 0,
              clientY: 0,
              bubbles: true,
            })
            handleMouseMove(mouseEvent)

            // 也触发指针事件，确保移动端模拟模式下也能工作
            const pointerEvent = new PointerEvent('pointermove', {
              clientX: 0,
              clientY: 0,
              bubbles: true,
            })
            handlePointerMove(pointerEvent)
          }
        } else {
          console.error(
            '[DraftPaper] Failed to create screenshot, color picker cannot be activated'
          )
          // 恢复状态
          isColorPickerActive = false
          unlockPageScroll()
          if (draftImgDom && originalOpacity !== null) {
            draftImgDom.style.opacity = originalOpacity.toString()
            originalOpacity = null
          }
        }
      })
    } else {
      // 恢复草稿图片透明度
      if (draftImgDom) {
        const restoreOpacity = opacity > 0 ? opacity : originalOpacity
        draftImgDom.style.opacity = restoreOpacity?.toString() || '0'
      }

      // 解锁页面滚动
      unlockPageScroll()

      // 清理页面截图
      pageScreenshot = null

      // 移除放大镜
      removeMagnifier()

      // 移除事件监听
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('click', handleColorClick, true)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('touchstart', handleColorPickerTouchStart)
      document.removeEventListener('touchmove', handleColorPickerTouchMove)
      document.removeEventListener('touchend', handleColorPickerTouchEnd)

      // 清理防抖定时器
      if (magnifierUpdateTimeout) {
        clearTimeout(magnifierUpdateTimeout)
        magnifierUpdateTimeout = null
      }

      // 重置放大镜相关变量
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 锁定页面滚动
 */
function lockPageScroll(): void {
  try {
    if (isScrollLocked) return

    // 保存当前滚动位置
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    // 锁定滚动
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = `-${scrollX}px`
    document.body.style.width = '100%'

    isScrollLocked = true
  } catch (error) {
    console.error('[DraftPaper] Error locking page scroll:', error)
  }
}

/**
 * 解锁页面滚动
 */
function unlockPageScroll(): void {
  try {
    if (!isScrollLocked) return

    // 恢复滚动
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.width = ''

    isScrollLocked = false
  } catch (error) {
    console.error('[DraftPaper] Error unlocking page scroll:', error)
  }
}

/**
 * 创建页面截图
 */
async function createPageScreenshot(): Promise<void> {
  try {
    // 使用html2canvas创建页面截图
    if (window.html2canvas) {
      // 检查草稿纸是否存在
      if (draftImgDom) {
        console.log("[DraftPaper] Draft paper found, ensuring it's visible in screenshot:", {
          display: window.getComputedStyle(draftImgDom).display,
          visibility: window.getComputedStyle(draftImgDom).visibility,
          opacity: window.getComputedStyle(draftImgDom).opacity,
          zIndex: window.getComputedStyle(draftImgDom).zIndex,
          position: window.getComputedStyle(draftImgDom).position,
          rect: draftImgDom.getBoundingClientRect(),
        })
      }

      const canvas = await window.html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        // 确保包含所有元素，包括高z-index的元素
        ignoreElements: (element: Element) => {
          // 排除放大镜本身
          return element.classList.contains('draft-paper-magnifier')
        },
      })

      pageScreenshot = canvas.toDataURL('image/png')

      // 创建一个临时图片来检查截屏内容
      const testImg = new Image()
      testImg.onload = () => {
        // 验证截屏中是否包含草稿纸
        if (draftImgDom) {
          verifyDraftPaperInScreenshot(testImg, draftImgDom)
        }
      }
      testImg.src = pageScreenshot
    } else {
      // 使用DOM克隆方法创建页面截图
      pageScreenshot = await createDOMScreenshot()
    }
  } catch (error) {
    console.error('[DraftPaper] Error creating page screenshot:', error)
    pageScreenshot = null
  }
}

/**
 * 使用DOM克隆方法创建页面截图
 */
async function createDOMScreenshot(): Promise<string | null> {
  try {
    // 创建一个临时的canvas来绘制页面内容
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 设置canvas尺寸
    canvas.width = document.documentElement.scrollWidth
    canvas.height = document.documentElement.scrollHeight

    // 设置白色背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 克隆页面内容
    const clonedBody = document.body.cloneNode(true) as HTMLElement
    clonedBody.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: white;
    `

    // 移除干扰元素（排除草稿纸图片）
    const elementsToRemove = clonedBody.querySelectorAll('.draft-paper-magnifier, script, style')
    elementsToRemove.forEach((el) => {
      // 确保不移除草稿纸图片
      if (el.id !== 'draft-paper-image' && !el.classList.contains('draft-paper-image')) {
        el.remove()
      }
    })

    // 创建临时容器
    const tempContainer = document.createElement('div')
    tempContainer.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: ${canvas.width}px;
      height: ${canvas.height}px;
      overflow: hidden;
      background: white;
    `
    tempContainer.appendChild(clonedBody)
    document.body.appendChild(tempContainer)

    // 使用html2canvas的替代方案：直接绘制到canvas
    // 这里我们使用一个简化的方法，绘制页面结构
    drawPageStructureToCanvas(ctx, canvas.width, canvas.height)

    // 清理临时容器
    document.body.removeChild(tempContainer)

    const dataURL = canvas.toDataURL('image/png')
    return dataURL
  } catch (error) {
    console.error('[DraftPaper] Error creating DOM screenshot:', error)
    return null
  }
}

/**
 * 绘制页面结构到canvas
 */
function drawPageStructureToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // 绘制页面背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // 绘制一些基本的页面元素作为示例
  // 这里可以根据需要添加更复杂的页面内容绘制逻辑
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(0, 0, width, 60) // 顶部区域

  // 绘制网格背景
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'
  ctx.lineWidth = 1
  const gridSize = 20

  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // 如果有草稿图片，绘制它
  if (draftImgDom) {
    drawDraftImageToCanvas(ctx, draftImgDom)
  }
}

/**
 * 验证截屏中是否包含草稿纸
 */
function verifyDraftPaperInScreenshot(
  screenshotImg: HTMLImageElement,
  draftImg: HTMLElement
): void {
  try {
    const rect = draftImg.getBoundingClientRect()
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    // 计算草稿纸在截屏中的位置
    const pageWidth = document.documentElement.scrollWidth || window.innerWidth
    const pageHeight = document.documentElement.scrollHeight || window.innerHeight
    const scaleX = screenshotImg.naturalWidth / pageWidth
    const scaleY = screenshotImg.naturalHeight / pageHeight

    const draftX = (rect.left + scrollX) * scaleX
    const draftY = (rect.top + scrollY) * scaleY
    const draftWidth = rect.width * scaleX
    const draftHeight = rect.height * scaleY

    // 创建一个临时canvas来检查截屏中的草稿纸区域
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCanvas.width = 1
    tempCanvas.height = 1

    // 在草稿纸中心采样一个像素
    const centerX = Math.floor(draftX + draftWidth / 2)
    const centerY = Math.floor(draftY + draftHeight / 2)

    if (
      centerX >= 0 &&
      centerX < screenshotImg.naturalWidth &&
      centerY >= 0 &&
      centerY < screenshotImg.naturalHeight
    ) {
      tempCtx.drawImage(screenshotImg, centerX, centerY, 1, 1, 0, 0, 1, 1)
      const imageData = tempCtx.getImageData(0, 0, 1, 1)
      const [r, g, b, a] = imageData.data

      console.log('[DraftPaper] Draft paper center pixel in screenshot:', {
        centerX,
        centerY,
        rgba: { r, g, b, a },
        isTransparent: a === 0,
        isWhite: r === 255 && g === 255 && b === 255 && a === 255,
      })

      if (a === 0) {
        console.warn('[DraftPaper] Draft paper appears to be transparent in screenshot!')
      } else if (r === 255 && g === 255 && b === 255 && a === 255) {
        console.warn('[DraftPaper] Draft paper appears to be white in screenshot!')
      } else {
        console.log('[DraftPaper] Draft paper appears to be visible in screenshot')
      }
    } else {
      console.warn('[DraftPaper] Draft paper center is out of bounds in screenshot')
    }
  } catch (error) {
    console.error('[DraftPaper] Error verifying draft paper in screenshot:', error)
  }
}

/**
 * 绘制草稿图片到canvas
 */
function drawDraftImageToCanvas(ctx: CanvasRenderingContext2D, img: HTMLElement): void {
  if (!(img instanceof HTMLImageElement)) {
    console.log('[DraftPaper] Draft element is not an image element')
    return
  }

  const rect = img.getBoundingClientRect()
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft
  const scrollY = window.pageYOffset || document.documentElement.scrollTop

  const x = rect.left + scrollX
  const y = rect.top + scrollY
  const width = rect.width
  const height = rect.height

  // 绘制图片
  try {
    ctx.drawImage(img, x, y, width, height)
  } catch (error) {
    console.error('[DraftPaper] Error drawing draft image to canvas:', error)
  }
}

/**
 * 创建放大镜
 */
function createMagnifier(): void {
  try {
    removeMagnifier() // 先移除已存在的放大镜

    magnifierElement = document.createElement('div')
    magnifierElement.id = 'draft-paper-magnifier'
    magnifierElement.style.cssText = `
      position: fixed;
      width: 75px;
      height: 75px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      pointer-events: none;
      z-index: 1000001;
      display: none;
      overflow: hidden;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    `

    // 创建放大镜内容容器
    const magnifierContent = document.createElement('div')
    magnifierContent.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      background: #f0f0f0;
    `

    magnifierElement.appendChild(magnifierContent)
    document.body.appendChild(magnifierElement)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 移除放大镜
 */
function removeMagnifier(): void {
  try {
    if (magnifierElement) {
      // 清理放大镜内容
      const magnifierContent = magnifierElement.firstElementChild as HTMLElement
      if (magnifierContent) {
        // 清理所有子元素
        while (magnifierContent.firstChild) {
          magnifierContent.removeChild(magnifierContent.firstChild)
        }
      }

      // 移除放大镜元素
      magnifierElement.remove()
      magnifierElement = null
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

// 放大镜更新防抖
let magnifierUpdateTimeout: number | null = null

/**
 * 处理鼠标移动
 * @param event - 鼠标事件
 */
function handleMouseMove(event: MouseEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    const { clientX, clientY } = event

    // 显示放大镜并跟随鼠标
    magnifierElement.style.display = 'block'
    magnifierElement.style.left = `${clientX - 37.5}px`
    magnifierElement.style.top = `${clientY - 37.5}px`

    // 更新放大镜内容
    updateMagnifierContent(clientX, clientY)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理取色器触摸开始
 * @param event - 触摸事件
 */
function handleColorPickerTouchStart(event: TouchEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    // 安全地调用 preventDefault
    if (event.cancelable) {
      event.preventDefault()
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    const { clientX, clientY } = touch

    // 显示放大镜并跟随触摸
    magnifierElement.style.display = 'block'
    magnifierElement.style.left = `${clientX - 37.5}px`
    magnifierElement.style.top = `${clientY - 37.5}px`

    // 添加视觉反馈，确保放大镜位置正确
    magnifierElement.style.transform = 'scale(1)'
    magnifierElement.style.transition = 'none'

    // 更新放大镜内容
    updateMagnifierContent(clientX, clientY)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理指针移动事件（支持移动端模拟）
 * @param event - 指针事件
 */
function handlePointerMove(event: PointerEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    const { clientX, clientY } = event

    // 显示放大镜并跟随指针
    magnifierElement.style.display = 'block'
    magnifierElement.style.left = `${clientX - 37.5}px`
    magnifierElement.style.top = `${clientY - 37.5}px`

    // 更新放大镜内容
    updateMagnifierContent(clientX, clientY)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理指针按下事件（支持移动端模拟）
 * @param event - 指针事件
 */
function handlePointerDown(event: PointerEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    const { clientX, clientY } = event

    // 显示放大镜并跟随指针
    magnifierElement.style.display = 'block'
    magnifierElement.style.left = `${clientX - 37.5}px`
    magnifierElement.style.top = `${clientY - 37.5}px`

    // 更新放大镜内容
    updateMagnifierContent(clientX, clientY)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理指针抬起事件（支持移动端模拟）
 * @param event - 指针事件
 */
function handlePointerUp(event: PointerEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    const { clientX, clientY } = event

    // 获取点击位置的实际像素颜色
    if (pageScreenshot) {
      const img = new Image()
      img.onload = () => {
        const captureSize = 150 / 12
        const captureX = clientX - captureSize / 2
        const captureY = clientY - captureSize / 2

        const actualPixelColor = getActualPixelColorFromScreenshot(
          img,
          clientX,
          clientY,
          captureX,
          captureY,
          12
        )

        if (actualPixelColor) {
          copyToClipboard(actualPixelColor).then((success) => {
            if (success) {
              showColorNotification(actualPixelColor)
            } else {
              errorHandler(new Error('色值复制失败'))
            }
          })
        } else {
          console.warn('[DraftPaper] 无法获取实际像素颜色')
        }
      }
      img.src = pageScreenshot
    } else {
      console.warn('[DraftPaper] 没有页面截图，无法获取实际像素颜色')
      showColorNotification('请先开启取色器')
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理取色器触摸移动
 * @param event - 触摸事件
 */
function handleColorPickerTouchMove(event: TouchEvent): void {
  try {
    if (!magnifierElement || !isColorPickerActive) {
      return
    }

    // 安全地调用 preventDefault
    if (event.cancelable) {
      event.preventDefault()
    }

    const touch = event.touches[0]
    if (!touch) {
      return
    }

    const { clientX, clientY } = touch

    // 显示放大镜并跟随触摸
    magnifierElement.style.display = 'block'
    magnifierElement.style.left = `${clientX - 37.5}px`
    magnifierElement.style.top = `${clientY - 37.5}px`

    // 添加视觉反馈，确保放大镜位置正确
    magnifierElement.style.transform = 'scale(1)'
    magnifierElement.style.transition = 'none'

    // 更新放大镜内容
    updateMagnifierContent(clientX, clientY)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理取色器触摸结束
 * @param event - 触摸事件
 */
async function handleColorPickerTouchEnd(event: TouchEvent): Promise<void> {
  try {
    if (!isColorPickerActive) return

    // 安全地调用 preventDefault
    if (event.cancelable) {
      event.preventDefault()
    }

    const touch = event.changedTouches[0]
    if (!touch) return

    const { clientX, clientY } = touch

    // 获取点击位置的实际像素颜色
    if (pageScreenshot) {
      const img = new Image()
      img.onload = () => {
        const captureSize = 150 / 12
        const captureX = clientX - captureSize / 2
        const captureY = clientY - captureSize / 2

        const actualPixelColor = getActualPixelColorFromScreenshot(
          img,
          clientX,
          clientY,
          captureX,
          captureY,
          12
        )

        if (actualPixelColor) {
          copyToClipboard(actualPixelColor).then((success) => {
            if (success) {
              showColorNotification(actualPixelColor)
            } else {
              errorHandler(new Error('色值复制失败'))
            }
          })
        } else {
          console.warn('[DraftPaper] 无法获取实际像素颜色')
        }
      }
      img.src = pageScreenshot
    } else {
      console.warn('[DraftPaper] 没有页面截图，无法获取实际像素颜色')
      showColorNotification('请先开启取色器')
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 更新放大镜内容
 * @param x - X坐标
 * @param y - Y坐标
 */
function updateMagnifierContent(x: number, y: number): void {
  try {
    if (!magnifierElement) {
      return
    }

    const magnifierContent = magnifierElement.firstElementChild as HTMLElement
    if (!magnifierContent) {
      return
    }

    // 放大镜参数
    const magnifierSize = 75
    const zoomFactor = 12 // 保持放大倍数不变
    const captureSize = magnifierSize / zoomFactor

    // 计算截取区域（以鼠标为中心）
    const captureX = x - captureSize / 2
    const captureY = y - captureSize / 2

    // 清理旧内容
    magnifierContent.innerHTML = ''

    // 创建canvas来显示放大效果
    const canvas = document.createElement('canvas')
    canvas.width = magnifierSize
    canvas.height = magnifierSize
    canvas.style.cssText = `
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
      border-radius: 50%;
    `

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('[DraftPaper] Could not get canvas context')
      return
    }

    // 如果有页面截图，使用截图
    if (pageScreenshot) {
      const img = new Image()
      img.onload = () => {
        // 绘制放大区域
        ctx.drawImage(
          img,
          captureX,
          captureY,
          captureSize,
          captureSize, // 源区域
          0,
          0,
          magnifierSize,
          magnifierSize // 目标区域
        )

        // 绘制像素网格
        drawMagnifierGrid(ctx, magnifierSize, zoomFactor)

        // 从截图中获取中心像素的实际颜色（与点击取色使用相同方法）
        const centerColor = getActualPixelColorFromScreenshot(
          img,
          x,
          y,
          captureX,
          captureY,
          zoomFactor
        )

        if (centerColor) {
          const centerX = magnifierSize / 2
          const centerY = magnifierSize / 2
          const gridSize = zoomFactor

          // 计算中心像素位置，使其与偏移后的网格对齐
          // 网格线向左上偏移了4像素，所以中心像素也需要相应调整
          const pixelX = Math.floor(centerX / gridSize) * gridSize - 4
          const pixelY = Math.floor(centerY / gridSize) * gridSize - 4

          // 绘制中心像素（完整的网格像素）
          ctx.fillStyle = centerColor
          ctx.fillRect(pixelX, pixelY, gridSize, gridSize)

          // 绘制颜色边框（与网格线对齐）
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 2
          ctx.strokeRect(pixelX, pixelY, gridSize, gridSize)
        }
      }
      img.src = pageScreenshot
    } else {
      // 如果没有截图，显示等待提示
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, magnifierSize, magnifierSize)

      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'

      console.log('[DraftPaper] No screenshot available, waiting for screenshot creation')
    }

    magnifierContent.appendChild(canvas)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 绘制放大镜网格
 */
function drawMagnifierGrid(ctx: CanvasRenderingContext2D, size: number, pixelSize: number): void {
  // 绘制细网格线（像素边界）
  ctx.strokeStyle = '#666666'
  ctx.lineWidth = 0.5
  ctx.globalAlpha = 0.7

  // 绘制网格线，向左上偏移0.5像素，让中心像素显示为完整的网格
  for (let i = 0; i < size; i += pixelSize) {
    ctx.beginPath()
    ctx.moveTo(i - 4, 0)
    ctx.lineTo(i - 4, size)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i - 4)
    ctx.lineTo(size, i - 4)
    ctx.stroke()
  }

  // 重置透明度
  ctx.globalAlpha = 1
}

/**
 * 从截图中获取放大镜中心点的实际像素颜色
 */
function getActualPixelColorFromScreenshot(
  img: HTMLImageElement,
  x: number,
  y: number,
  _captureX: number,
  _captureY: number,
  _zoomFactor: number
): string | null {
  try {
    // 创建临时canvas来采样颜色
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return null

    // 设置canvas尺寸为图片尺寸
    tempCanvas.width = img.naturalWidth
    tempCanvas.height = img.naturalHeight

    // 绘制图片到临时canvas
    tempCtx.drawImage(img, 0, 0)

    // 计算在原始图片中的坐标
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft
    const scrollY = window.pageYOffset || document.documentElement.scrollTop

    // 计算在页面中的绝对坐标（包含滚动）
    const absoluteX = x + scrollX
    const absoluteY = y + scrollY

    // 计算在原始图片中的坐标
    const pageWidth = document.documentElement.scrollWidth || window.innerWidth
    const pageHeight = document.documentElement.scrollHeight || window.innerHeight
    const scaleX = img.naturalWidth / pageWidth
    const scaleY = img.naturalHeight / pageHeight

    const imageX = Math.floor(absoluteX * scaleX)
    const imageY = Math.floor(absoluteY * scaleY)

    // 确保坐标在图片范围内
    if (imageX < 0 || imageX >= img.naturalWidth || imageY < 0 || imageY >= img.naturalHeight) {
      return null
    }

    // 获取像素数据
    const imageData = tempCtx.getImageData(imageX, imageY, 1, 1)
    const [r, g, b, a] = imageData.data

    if (a === 0) return null // 透明像素

    const color = rgbToHex(`rgb(${r}, ${g}, ${b})`)
    return color
  } catch (error) {
    console.error('[DraftPaper] Error getting actual pixel color:', error)
    return null
  }
}

/**
 * 同步获取指定位置的颜色
 */

/**
 * 处理颜色点击
 * @param event - 点击事件
 */
async function handleColorClick(event: MouseEvent): Promise<void> {
  try {
    if (!isColorPickerActive) return

    event.preventDefault()
    event.stopPropagation()

    const { clientX, clientY } = event

    // 获取点击位置的颜色（使用与放大镜相同的实际像素颜色）
    if (pageScreenshot) {
      // 从截图中获取实际像素颜色
      const img = new Image()
      img.onload = () => {
        const captureSize = 150 / 12 // 放大镜大小 / 缩放因子
        const captureX = clientX - captureSize / 2
        const captureY = clientY - captureSize / 2

        const actualPixelColor = getActualPixelColorFromScreenshot(
          img,
          clientX,
          clientY,
          captureX,
          captureY,
          12
        )

        if (actualPixelColor) {
          // 复制到剪贴板
          copyToClipboard(actualPixelColor).then((success) => {
            if (success) {
              // 显示通知
              showColorNotification(actualPixelColor)
            } else {
              errorHandler(new Error('色值复制失败'))
            }
          })
        } else {
          console.warn('[DraftPaper] 无法获取实际像素颜色')
        }
      }
      img.src = pageScreenshot
    } else {
      // 如果没有截图，提示用户
      console.warn('[DraftPaper] 没有页面截图，无法获取实际像素颜色')
      showColorNotification('请先开启取色器')
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 将RGB颜色转换为十六进制
 * @param rgb - RGB颜色字符串
 * @returns 十六进制颜色值
 */
function rgbToHex(rgb: string): string {
  try {
    const match = rgb.match(/\d+/g)
    if (match && match.length >= 3) {
      const r = parseInt(match[0])
      const g = parseInt(match[1])
      const b = parseInt(match[2])
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
    }
    return '#000000'
  } catch {
    return '#000000'
  }
}

/**
 * 显示颜色通知
 * @param color - 颜色值
 */
function showColorNotification(color: string): void {
  try {
    // 创建通知元素
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000002;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 8px;
    `

    // 添加颜色预览
    const colorPreview = document.createElement('div')
    colorPreview.style.cssText = `
      width: 20px;
      height: 20px;
      background: ${color};
      border-radius: 3px;
      border: 1px solid #fff;
    `

    notification.appendChild(colorPreview)
    notification.appendChild(document.createTextNode(`${color} 色值已保存在剪贴板中`))

    document.body.appendChild(notification)

    // 3秒后自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 保存拖拽记忆
 * @param deltaX - X轴偏移
 * @param deltaY - Y轴偏移
 */
async function saveDragMemory(deltaX: number, deltaY: number): Promise<void> {
  try {
    if (!currentSelectorChain) {
      return
    }

    const memoryItem: DragMemoryItem = {
      id: generateMemoryId(),
      selector: currentSelectorChain,
      top: deltaY,
      left: deltaX,
      timestamp: Date.now(),
      description: getElementDescription(dragState.element),
    }

    // 检查是否已存在相同的选择器
    const existingIndex = (dragMemory.items || []).findIndex(
      (item) => item.selector === currentSelectorChain
    )

    if (existingIndex >= 0) {
      // 更新现有项
      dragMemory.items[existingIndex] = memoryItem
    } else {
      // 添加新项
      if (!dragMemory.items) {
        dragMemory.items = []
      }
      dragMemory.items.push(memoryItem)
    }

    dragMemory.lastUpdated = Date.now()

    // 保存到数据库
    await saveDragMemoryToDB()

    // eslint-disable-next-line no-console
    console.info('✅ 拖拽记忆已保存:', memoryItem)
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 将偏移持久应用到元素（使用 CSS 变量 --d-dragX/--d-dragY，并确保类名存在）
 */
function applyPersistentOffset(element: HTMLElement, topDelta: number, leftDelta: number): void {
  try {
    // 读取已有的变量值，叠加本次增量
    const prevX = parseFloat(element.style.getPropertyValue('--d-dragX')) || 0
    const prevY = parseFloat(element.style.getPropertyValue('--d-dragY')) || 0
    const nextX = prevX + leftDelta
    const nextY = prevY + topDelta

    element.style.setProperty('--d-dragX', `${nextX}px`)
    element.style.setProperty('--d-dragY', `${nextY}px`)
    element.classList.add(CSS_CLASSES.dragPosition)
  } catch (e) {
    // 忽略单个元素应用失败，避免影响整体流程
  }
}

/**
 * 确保拖拽比例正确
 */
function ensureDragRatio(): void {
  if (widthRatio === 1 && currentDraftWidth !== 750) {
    widthRatio = innerWidth / currentDraftWidth
  }

  // 在记忆模式下，如果没有设计稿宽度信息，使用默认值
  if (isMemoryModeEnabled && widthRatio === 1) {
    widthRatio = innerWidth / currentDraftWidth
    console.log(
      `[DraftPaper] 记忆模式使用默认设计稿宽度: ${currentDraftWidth}px, 缩放比例: ${widthRatio}`
    )
  }

  // 确保在记忆模式下，widthRatio 不为 1（除非屏幕宽度确实等于设计稿宽度）
  if (isMemoryModeEnabled && widthRatio === 1 && innerWidth !== currentDraftWidth) {
    widthRatio = innerWidth / currentDraftWidth
    console.log(`[DraftPaper] 记忆模式强制更新缩放比例: ${widthRatio}`)
  }
}

/**
 * 将已保存的记忆批量应用到页面
 */
function applyAllDragMemories(): void {
  try {
    if (!dragMemory.items || dragMemory.items.length === 0) return
    dragMemory.items.forEach((item) => {
      const el = document.querySelector(item.selector) as HTMLElement | null
      if (el) {
        // 在记忆模式下，需要将保存的值乘以widthRatio来应用到元素
        const appliedX = isMemoryModeEnabled ? item.left * widthRatio : item.left
        const appliedY = isMemoryModeEnabled ? item.top * widthRatio : item.top
        el.style.setProperty('--d-dragX', `${appliedX}px`)
        el.style.setProperty('--d-dragY', `${appliedY}px`)
        el.classList.add(CSS_CLASSES.dragPosition)
      }
    })
  } catch {
    // no-op
  }
}

/**
 * 生成记忆项ID
 */
function generateMemoryId(): string {
  return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取元素描述
 * @param element - 目标元素
 */
function getElementDescription(element: HTMLElement | null): string {
  if (!element) return ''

  try {
    const tagName = element.tagName.toLowerCase()
    const className = element.className ? `.${element.className.split(' ').join('.')}` : ''
    const id = element.id ? `#${element.id}` : ''
    const text = element.textContent?.trim().substring(0, 20) || ''

    return `${tagName}${id}${className}${text ? ` (${text}...)` : ''}`
  } catch {
    return element.tagName.toLowerCase()
  }
}

/**
 * 保存拖拽记忆到数据库
 */
async function saveDragMemoryToDB(): Promise<void> {
  try {
    const dbKey = generateDragMemoryDbKey(new URL(location.href))
    const message: ChromeMessage = {
      type: 'UPDATE_DRAG_MEMORY' as MessageType,
      payload: {
        dbKey,
        dragMemory: JSON.stringify(dragMemory),
      },
    }

    // 添加重试机制
    const maxRetries = 3
    let retryCount = 0

    const attemptSave = (): void => {
      chrome.runtime.sendMessage(message, (response: ChromeResponse) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message
          console.warn(
            `[DraftPaper] 保存拖拽记忆失败 (尝试 ${retryCount + 1}/${maxRetries}):`,
            errorMsg
          )

          // 如果是连接错误且还有重试次数，则重试
          if (
            retryCount < maxRetries - 1 &&
            errorMsg &&
            (errorMsg.includes('Could not establish connection') ||
              errorMsg.includes('Receiving end does not exist'))
          ) {
            retryCount++
            setTimeout(attemptSave, 1000 * retryCount) // 递增延迟
            return
          }

          console.error('[DraftPaper] 拖拽记忆保存最终失败')
        } else if (response?.success) {
          console.log('[DraftPaper] 拖拽记忆保存成功')
        } else {
          console.warn('[DraftPaper] 拖拽记忆保存响应异常:', response)
        }
      })
    }

    attemptSave()
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 从数据库加载拖拽记忆
 */
async function loadDragMemoryFromDB(): Promise<void> {
  try {
    const dbKey = generateDragMemoryDbKey(new URL(location.href))
    const message: ChromeMessage = {
      type: 'GET_DRAG_MEMORY' as MessageType,
      payload: { dbKey },
    }

    // 添加重试机制
    const maxRetries = 3
    let retryCount = 0

    const attemptLoad = (): void => {
      chrome.runtime.sendMessage(message, (response: ChromeResponse) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message
          console.warn(
            `[DraftPaper] 加载拖拽记忆失败 (尝试 ${retryCount + 1}/${maxRetries}):`,
            errorMsg
          )

          // 如果是连接错误且还有重试次数，则重试
          if (
            retryCount < maxRetries - 1 &&
            errorMsg &&
            (errorMsg.includes('Could not establish connection') ||
              errorMsg.includes('Receiving end does not exist'))
          ) {
            retryCount++
            setTimeout(attemptLoad, 1000 * retryCount) // 递增延迟
            return
          }

          // 最终失败，使用默认值
          dragMemory = {
            items: [],
            url: location.href,
            lastUpdated: Date.now(),
          }
        } else if (response?.dragMemory) {
          try {
            const parsedMemory = JSON.parse(response.dragMemory)
            dragMemory = {
              items: parsedMemory.items || [],
              url: parsedMemory.url || location.href,
              lastUpdated: parsedMemory.lastUpdated || Date.now(),
            }
            console.log('[DraftPaper] 拖拽记忆加载成功:', dragMemory.items.length, '项')
          } catch (parseError) {
            console.warn('[DraftPaper] 解析拖拽记忆失败:', parseError)
            // 重置为默认值
            dragMemory = {
              items: [],
              url: location.href,
              lastUpdated: Date.now(),
            }
          }
        } else {
          // 没有数据，使用默认值
          dragMemory = {
            items: [],
            url: location.href,
            lastUpdated: Date.now(),
          }
        }
      })
    }

    attemptLoad()
  } catch (error) {
    errorHandler(error as Error)
    // 发生错误时使用默认值
    dragMemory = {
      items: [],
      url: location.href,
      lastUpdated: Date.now(),
    }
  }
}

/**
 * 生成拖拽记忆汇总代码
 */
function generateDragMemorySummary(): string {
  if (!dragMemory.items || dragMemory.items.length === 0) {
    return '// 暂无拖拽记忆'
  }

  let summary = '// 拖拽记忆汇总\n'
  summary += `// 页面: ${dragMemory.url}\n`
  summary += `// 共 ${dragMemory.items.length} 个元素\n\n`

  dragMemory.items.forEach((item, index) => {
    summary += `// ${index + 1}. ${item.description || item.selector}\n`
    summary += `${item.selector} {\n`
    summary += `  /* 拖拽偏移: top: ${item.top}px, left: ${item.left}px */\n`

    // 根据元素的定位方式生成不同的CSS
    const element = document.querySelector(item.selector) as HTMLElement
    if (element) {
      const computedStyle = window.getComputedStyle(element)
      const position = computedStyle.position

      if (position === 'static') {
        summary += `  margin-top: ${item.top}px;\n`
        summary += `  margin-left: ${item.left}px;\n`
      } else {
        summary += `  top: ${item.top}px;\n`
        summary += `  left: ${item.left}px;\n`
      }
    }

    summary += `}\n\n`
  })

  return summary
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
