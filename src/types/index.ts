/**
 * 草稿图片信息接口
 */
export interface DraftItem {
  /** 图片base64数据 */
  pic: string
  /** 图片宽度 */
  width: number
  /** 顶部位置 */
  top: number
  /** 左侧位置 */
  left: number
  /** 透明度 0-1 */
  opacity: number
}

/**
 * 草稿信息接口
 */
export interface DraftsInfo {
  /** 选中的草稿下标 */
  selectedIdx: number
  /** 是否可以拖拽元素 */
  isCanPick: boolean
  /** 位置代码模板 */
  templateCode: string
  /** 草稿列表 */
  list: DraftItem[]
}

/**
 * 数据库存储项接口
 */
export interface DatabaseItem {
  /** URL路径键 */
  url_path: string
  /** JSON字符串值 */
  val: string
}

/**
 * 消息类型枚举
 */
export enum MessageType {
  GET_DRAFTS = 'GET_DRAFTS',
  UPDATE_DRAFTS = 'UPDATE_DRAFTS',
  URL_CHANGE = 'URL_CHANGE',
}

/**
 * Chrome消息接口
 */
export interface ChromeMessage {
  type: MessageType
  payload: {
    dbKey: string
    draftsInfo?: string
  }
}

/**
 * 响应接口
 */
export interface ChromeResponse {
  draftsInfo?: string
  success?: boolean
  error?: string
}

/**
 * 位置信息接口
 */
export interface Position {
  top: number
  left: number
}

/**
 * 拖拽状态接口
 */
export interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
  element: HTMLElement | null
}

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** 默认草稿配置 */
  defaultDraft: Omit<DraftItem, 'pic'>
  /** 默认模板代码 */
  defaultTemplate: string
  /** 弹窗宽度 */
  popupWidth: number
  /** 最大图片大小（字节） */
  maxImageSize: number
  /** 支持的图片格式 */
  supportedImageTypes: string[]
}
