/**
 * 防抖函数
 * @param func - 要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @returns 防抖后的函数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * 节流函数
 * @param func - 要节流的函数
 * @param limit - 限制时间（毫秒）
 * @returns 节流后的函数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 生成数据库键
 * @param url - URL对象
 * @returns 数据库键
 */
export function generateDbKey(url: URL): string {
  return url.host + url.pathname
}

/**
 * 压缩图片
 * @param file - 图片文件
 * @param quality - 压缩质量 0-1
 * @param maxWidth - 最大宽度
 * @returns Promise<string> base64字符串
 */
export function compressImage(
  file: File,
  quality: number = 0.8,
  maxWidth: number = 1920
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // 计算压缩后的尺寸
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height)
      const width = img.width * ratio
      const height = img.height * ratio

      canvas.width = width
      canvas.height = height

      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height)

      // 转换为base64
      const base64 = canvas.toDataURL('image/jpeg', quality)
      resolve(base64)
    }

    img.onerror = () => reject(new Error('图片加载失败'))

    // 创建图片URL
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 复制文本到剪贴板
 * @param text - 要复制的文本
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用现代API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 兼容性方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    `

    document.body.appendChild(textArea)
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)

    return success
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('复制失败:', error)
    return false
  }
}

/**
 * 创建错误处理器
 * @param context - 错误上下文
 * @returns 错误处理函数
 */
export function createErrorHandler(context: string) {
  return (error: Error | string) => {
    const message = error instanceof Error ? error.message : error
    // eslint-disable-next-line no-console
    console.error(`[${context}] 错误:`, message)

    // 这里可以添加错误上报逻辑
    // errorReporting.report(context, message)
  }
}
