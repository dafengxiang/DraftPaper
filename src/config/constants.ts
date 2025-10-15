import type { AppConfig } from '@/types'

/**
 * 应用配置常量
 */
export const APP_CONFIG: AppConfig = {
  defaultDraft: {
    width: 750,
    top: 0,
    left: 0,
    opacity: 1,
  },
  defaultTemplate: `你是一位负责页面样式修正的前端专家。
请修改{selector}匹配元素的CSS，实现下移{top}px、右移{left}px。
规则：
1. 严格基于该元素当前定位方式（不改动定位属性）；
2. relative/absolute/fixed/sticky：叠加/新增top/left；static：仅调margin-top/margin-left；
3. 不碰无关样式，输出含{selector}的完整CSS，改动行标注释。`,
  popupWidth: 350,
  maxImageSize: 5 * 1024 * 1024, // 5MB
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}

/**
 * 数据库配置
 */
export const DB_CONFIG = {
  name: 'draftPaper',
  version: 1,
  storeName: 'draft_info',
} as const

/**
 * CSS类名常量
 */
export const CSS_CLASSES = {
  dragBorder: 'draft-drag-border',
  dragPosition: 'draft-drag-position',
} as const

/**
 * 事件防抖延迟（毫秒）
 */
export const DEBOUNCE_DELAY = 300

/**
 * Z-index层级
 */
export const Z_INDEX = {
  draftImage: 999999,
  dragBorder: 1000000,
} as const
