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

// 取色器状态
let isColorPickerActive = false
let magnifierElement: HTMLDivElement | null = null
let originalOpacity: number | null = 1 // 保存原始透明度
let pageScreenshot: string | null = null
let isScrollLocked = false

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
      } else if (request.type === 'TOGGLE_COLOR_PICKER') {
        handleColorPickerToggle(request.payload.isActive || false, request.payload.opacity || 1)
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

    // 保留自研方案作为唯一实现

    if (isActive) {
      // 保存当前透明度
      if (draftImgDom) {
        originalOpacity = parseFloat(draftImgDom.style.opacity) || 1
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
        const restoreOpacity = opacity > 0 ? opacity : originalOpacity || 1
        draftImgDom.style.opacity = restoreOpacity.toString()
        // eslint-disable-next-line no-console
        console.log('[DraftPaper] Draft image opacity restored to:', restoreOpacity)
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
    console.log('[DraftPaper] Page scroll unlocked')
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

      console.log('[DraftPaper] Magnifier removed')
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

    event.preventDefault()

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

    event.preventDefault()

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

    event.preventDefault()

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

// 立即执行函数，避免全局污染
;(function () {
  // 确保在DOM加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript)
  } else {
    initContentScript()
  }
})()
