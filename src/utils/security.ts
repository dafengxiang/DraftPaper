import DOMPurify from 'dompurify'

/**
 * 验证并清理URL
 * @param url - 要验证的URL
 * @returns 清理后的安全URL
 */
export function sanitizeUrl(url: string): string {
  try {
    // 验证是否为有效的data URL
    if (!url.startsWith('data:image/')) {
      throw new Error('Invalid image URL')
    }

    // 使用DOMPurify清理
    return DOMPurify.sanitize(url)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Invalid URL:', error)
    return ''
  }
}

/**
 * 验证模板代码的安全性
 * @param template - 模板字符串
 * @returns 是否安全
 */
export function validateTemplate(template: string): boolean {
  // 只允许CSS属性、值和占位符
  const allowedPattern = /^[a-zA-Z0-9\s:\-{}();.px%#]+$/
  const hasPlaceholders = /\{(top|left)\}/.test(template)

  return allowedPattern.test(template) && hasPlaceholders
}

/**
 * 清理和验证模板代码
 * @param template - 要清理的模板
 * @returns 清理后的模板
 */
export function sanitizeTemplate(template: string): string {
  if (!validateTemplate(template)) {
    throw new Error('Invalid template code')
  }

  // 移除可能的恶意代码
  return template
    .replace(/javascript:/gi, '')
    .replace(/<script/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

/**
 * 验证图片文件
 * @param file - 文件对象
 * @param maxSize - 最大文件大小
 * @param allowedTypes - 允许的文件类型
 * @returns 验证结果
 */
export function validateImageFile(
  file: File,
  maxSize: number,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: '请选择文件' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '不支持的文件格式' }
  }

  if (file.size > maxSize) {
    return { valid: false, error: `文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)}MB` }
  }

  return { valid: true }
}
