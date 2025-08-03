<!--
 * @Description: 全局设置面板
 * @Author: wangfengxiang
 * @Date: 2024-07-03 16:17:06
 * @LastEditTime: 2024-07-04 10:26:31
 * @LastEditors: wangfengxiang
-->
<template>
  <section class="m-setting-box">
    <h4 class="setting-title">代码模板设置</h4>

    <div class="setting-description">
      <p>
        模板中的 <code>{top}</code> 和 <code>{left}</code> 将被替换为元素拖拽后的位置值，
        并自动复制到剪贴板。
      </p>
      <p class="default-template">
        默认模板：<code>{{ defaultTemplate }}</code>
      </p>
    </div>

    <form @submit.prevent="saveTemplate" class="template-form">
      <div class="form-group">
        <label for="template-input" class="label">自定义模板：</label>
        <textarea
          id="template-input"
          v-model="templateCode"
          class="template-input"
          placeholder="请输入代码模板..."
          rows="3"
          :class="{ error: hasError }"
        ></textarea>

        <div v-if="hasError" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="help-text">
          <p>⚠️ 模板必须包含 {top} 和 {left} 占位符</p>
          <p>✅ 只允许使用 CSS 属性和值</p>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" @click="resetToDefault">重置为默认</button>
        <button type="submit" class="btn btn-primary" :disabled="hasError">保存模板</button>
      </div>
    </form>

    <!-- 预览 -->
    <div v-if="previewCode" class="preview-section">
      <h5 class="preview-title">预览效果：</h5>
      <pre class="preview-code">{{ previewCode }}</pre>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDrafts } from '@/hooks/useDrafts'
import { validateTemplate, sanitizeTemplate } from '@/utils/security'
import { createErrorHandler } from '@/utils/helpers'
import { APP_CONFIG } from '@/config/constants'

const errorHandler = createErrorHandler('SettingBox')

// 组件状态
const templateCode = ref('')
const errorMessage = ref('')
const hasError = ref(false)

// 草稿数据
const { draftsInfo } = useDrafts()

// 默认模板
const defaultTemplate = APP_CONFIG.defaultTemplate

/**
 * 预览代码 - 用示例值替换占位符
 */
const previewCode = computed(() => {
  if (!templateCode.value || hasError.value) return ''

  try {
    return templateCode.value.replace(/\{top\}/gi, '20').replace(/\{left\}/gi, '100')
  } catch {
    return ''
  }
})

/**
 * 验证模板代码
 */
const validateTemplateCode = (code: string): void => {
  hasError.value = false
  errorMessage.value = ''

  if (!code.trim()) {
    hasError.value = true
    errorMessage.value = '模板不能为空'
    return
  }

  if (!validateTemplate(code)) {
    hasError.value = true
    errorMessage.value = '模板格式无效或包含不安全的内容'
    return
  }

  if (!code.includes('{top}') || !code.includes('{left}')) {
    hasError.value = true
    errorMessage.value = '模板必须包含 {top} 和 {left} 占位符'
    return
  }
}

/**
 * 保存模板
 */
const saveTemplate = (): void => {
  try {
    if (hasError.value) {
      return
    }

    const sanitized = sanitizeTemplate(templateCode.value)
    draftsInfo.value.templateCode = sanitized

    // 这里可以添加保存成功的提示
    // eslint-disable-next-line no-console
    console.log('模板已保存')
  } catch (error) {
    errorHandler(error as Error)
    hasError.value = true
    errorMessage.value = '保存失败，请检查模板格式'
  }
}

/**
 * 重置为默认模板
 */
const resetToDefault = (): void => {
  templateCode.value = defaultTemplate
  draftsInfo.value.templateCode = defaultTemplate
}

// 监听模板代码变化进行验证
watch(templateCode, validateTemplateCode, { immediate: true })

// 初始化模板代码
watch(
  () => draftsInfo.value?.templateCode,
  (newTemplate) => {
    if (newTemplate && newTemplate !== templateCode.value) {
      templateCode.value = newTemplate
    }
  },
  { immediate: true }
)
</script>

<style lang="less" scoped>
@import '../mixin.less';

.m-setting-box {
  .setting-title {
    font-size: 16px;
    color: #eee;
    margin: 0 0 15px 0;
    font-weight: 600;
  }

  .setting-description {
    margin-bottom: 20px;

    p {
      font-size: 13px;
      line-height: 1.5;
      color: #ccc;
      margin: 0 0 8px 0;

      &:last-child {
        margin-bottom: 0;
      }
    }

    code {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      color: #7cacf8;
    }

    .default-template {
      font-size: 12px;
      color: #999;
    }
  }

  .template-form {
    .form-group {
      margin-bottom: 16px;
    }

    .label {
      display: block;
      font-size: 14px;
      color: #ddd;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .template-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #555;
      border-radius: 6px;
      background: #444;
      color: #fff;
      font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
      line-height: 1.4;
      resize: vertical;
      min-height: 80px;
      transition: border-color 0.2s ease;

      &:focus {
        outline: none;
        border-color: #ff9900;
        box-shadow: 0 0 0 2px rgba(255, 153, 0, 0.2);
      }

      &:hover {
        border-color: #666;
      }

      &.error {
        border-color: #ff4757;
        box-shadow: 0 0 0 2px rgba(255, 71, 87, 0.2);
      }

      &::placeholder {
        color: #888;
      }
    }

    .error-message {
      margin-top: 6px;
      font-size: 12px;
      color: #ff4757;
      line-height: 1.3;
    }

    .help-text {
      margin-top: 8px;

      p {
        font-size: 11px;
        color: #888;
        margin: 2px 0;
        line-height: 1.3;
      }
    }

    .form-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 5px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.btn-secondary {
        background: #666;
        color: #fff;

        &:hover:not(:disabled) {
          background: #777;
        }
      }

      &.btn-primary {
        background: #ff9900;
        color: #fff;

        &:hover:not(:disabled) {
          background: #ffb84d;
        }
      }
    }
  }

  .preview-section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #555;

    .preview-title {
      font-size: 13px;
      color: #ddd;
      margin: 0 0 10px 0;
      font-weight: 500;
    }

    .preview-code {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid #444;
      border-radius: 4px;
      padding: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      color: #7cacf8;
      line-height: 1.4;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}
</style>
