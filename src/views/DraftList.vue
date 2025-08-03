<!--
 * @Description: 草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 18:50:23
 * @LastEditTime: 2024-07-04 15:19:59
 * @LastEditors: wangfengxiang
-->
<template>
  <section class="m-draft-list">
    <h4 class="section-title">草稿列表</h4>
    <ul class="draft-grid" role="list">
      <li
        v-for="(draft, index) in draftsInfo?.list ?? []"
        :key="`draft-${index}`"
        class="draft-item"
        :class="{ selected: draftsInfo.selectedIdx === index }"
        :style="getDraftItemStyle(draft.pic)"
        role="listitem"
        :aria-label="`草稿 ${index + 1}`"
        @click="selectDraft(index)"
      >
        <button
          class="delete-btn"
          :aria-label="`删除草稿 ${index + 1}`"
          title="删除草稿"
          @click.stop="handleDeleteDraft(index)"
        ></button>
      </li>
      
      <!-- 添加新草稿 -->
      <li class="draft-item add-item">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="file-input"
          :disabled="isUploading"
          @change="handleImageUpload"
        />
        <div class="add-content">
          <div v-if="isUploading" class="uploading">
            <div class="spinner"></div>
            <span>上传中...</span>
          </div>
          <div v-else class="add-icon">+</div>
        </div>
      </li>
    </ul>
    
    <!-- 错误提示 -->
    <div v-if="uploadError" class="error-tip">
      {{ uploadError }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDrafts } from '@/hooks/useDrafts'
import { sanitizeUrl, validateImageFile } from '@/utils/security'
import { compressImage, createErrorHandler } from '@/utils/helpers'
import { APP_CONFIG } from '@/config/constants'

const errorHandler = createErrorHandler('DraftList')

// 组件状态
const isUploading = ref(false)
const uploadError = ref('')
const fileInputRef = ref<HTMLInputElement>()

// 草稿数据
const { draftsInfo, addDraft, deleteDraft } = useDrafts()

/**
 * 获取草稿项样式
 * @param pic - 图片数据
 */
const getDraftItemStyle = computed(() => (pic: string) => {
  if (!pic) return {}
  
  const safePic = sanitizeUrl(pic)
  return safePic ? { backgroundImage: `url(${safePic})` } : {}
})

/**
 * 选择草稿
 * @param index - 草稿索引
 */
const selectDraft = (index: number): void => {
  try {
    if (index >= 0 && index < (draftsInfo.value?.list?.length ?? 0)) {
      draftsInfo.value.selectedIdx = index
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}

/**
 * 处理图片上传
 * @param event - 文件输入事件
 */
const handleImageUpload = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return

  try {
    isUploading.value = true
    uploadError.value = ''

    // 验证文件
    const validation = validateImageFile(
      file,
      APP_CONFIG.maxImageSize,
      APP_CONFIG.supportedImageTypes
    )

    if (!validation.valid) {
      throw new Error(validation.error || '文件验证失败')
    }

    // 压缩图片
    const compressedImage = await compressImage(file, 0.8, 1920)
    
    // 添加到草稿列表
    addDraft(compressedImage)
    
    // 清空文件输入
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  } catch (error) {
    errorHandler(error as Error)
    uploadError.value = (error as Error).message
    
    // 清空文件输入
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  } finally {
    isUploading.value = false
  }
}

/**
 * 处理删除草稿
 * @param index - 要删除的草稿索引
 */
const handleDeleteDraft = (index: number): void => {
  try {
    // 确认删除
    if (window.confirm('确定要删除这个草稿吗？')) {
      deleteDraft(index)
    }
  } catch (error) {
    errorHandler(error as Error)
  }
}
</script>

<style lang="less" scoped>
@import '../mixin.less';

.m-draft-list {
  margin-bottom: 20px;

  .section-title {
    font-size: 14px;
    color: #ccc;
    margin: 0 0 10px 0;
    font-weight: 500;
  }

  .draft-grid {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 5px 0;
    
    // 自定义滚动条
    &::-webkit-scrollbar {
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: #555;
      border-radius: 2px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 2px;
      
      &:hover {
        background: #aaa;
      }
    }
  }

  .draft-item {
    position: relative;
    .size(80px, 120px);
    border-radius: 8px;
    border: 2px solid #555;
    background: #444 no-repeat center / cover;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    filter: grayscale(0.6);

    &:hover {
      filter: grayscale(0.3);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    &.selected {
      filter: grayscale(0);
      border-color: #ff9900;
      box-shadow: 0 0 0 2px rgba(255, 153, 0, 0.3);
    }

    .delete-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      .square(18px);
      background: rgba(0, 0, 0, 0.7) url(../icons/delete.png) no-repeat center / 12px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;

      &:hover {
        background-color: rgba(255, 0, 0, 0.8);
      }
    }

    &:hover .delete-btn {
      opacity: 1;
    }
  }

  .add-item {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #555 !important;
    border-style: dashed !important;
    filter: none !important;

    &:hover {
      background: #666 !important;
      filter: none !important;
    }

    .file-input {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
      }
    }

    .add-content {
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .add-icon {
      font-size: 24px;
      color: #aaa;
      font-weight: 300;
    }

    .uploading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #666;
        border-top: 2px solid #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      span {
        font-size: 10px;
        color: #aaa;
      }
    }

    &:hover .add-icon {
      color: #fff;
    }
  }

  .error-tip {
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid #ff4757;
    border-radius: 4px;
    color: #ff4757;
    font-size: 12px;
    line-height: 1.4;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
