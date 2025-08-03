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
 * 非空检查
 * @param template - 模板字符串
 * @returns 是否为空模版
 */
export function validateTemplate(template: string): boolean {
  return !!template.trim()
}

/**
 * 清理和验证模板代码
 * @param template - 要清理的模板
 * @returns 清理后的模板
 */
export function sanitizeTemplate(template: string): string {
  if (!validateTemplate(template)) {
    throw new Error('模板不能为空')
  }

  // 移除可能的恶意代码，但保持模板格式的灵活性
  return template
    .replace(/javascript:/gi, '')
    .replace(/<script/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/Function\s*\(/gi, '')
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
