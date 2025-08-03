<!--
 * @Description: 草稿控制表单
 * @Author: wangfengxiang
 * @Date: 2024-05-10 15:36:57
 * @LastEditTime: 2024-05-14 10:24:58
 * @LastEditors: wangfengxiang
-->
<template>
  <section class="m-control-box">
    <h4 class="section-title">草稿控制</h4>
    
    <div v-if="!hasDraft" class="no-draft">
      <p>暂无草稿，请先添加草稿图片</p>
    </div>
    
    <form v-else class="control-form" @submit.prevent>
      <div class="form-group">
        <label for="width-input" class="label">宽度 (px):</label>
        <input
          id="width-input"
          v-model.number="currentDraft!.width"
          type="number"
          class="number-input"
          min="100"
          max="3000"
          step="1"
        />
      </div>
      
      <div class="form-group">
        <label for="top-input" class="label">顶部 (px):</label>
        <input
          id="top-input"
          v-model.number="currentDraft!.top"
          type="number"
          class="number-input"
          step="1"
        />
      </div>
      
      <div class="form-group">
        <label for="left-input" class="label">左侧 (px):</label>
        <input
          id="left-input"
          v-model.number="currentDraft!.left"
          type="number"
          class="number-input"
          step="1"
        />
      </div>
      
      <div class="form-group">
        <label for="opacity-input" class="label">
          透明度: {{ (currentDraft!.opacity * 100).toFixed(0) }}%
        </label>
        <input
          id="opacity-input"
          v-model.number="currentDraft!.opacity"
          type="range"
          class="range-input"
          min="0"
          max="1"
          step="0.05"
        />
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDrafts } from '@/hooks/useDrafts'
import type { DraftItem } from '@/types'

const { draftsInfo } = useDrafts()

/**
 * 当前选中的草稿
 */
const currentDraft = computed((): DraftItem | undefined => {
  const list = draftsInfo.value?.list
  const selectedIdx = draftsInfo.value?.selectedIdx
  
  if (!list || typeof selectedIdx !== 'number' || selectedIdx < 0 || selectedIdx >= list.length) {
    return undefined
  }
  
  return list[selectedIdx]
})

/**
 * 是否有草稿可编辑
 */
const hasDraft = computed((): boolean => {
  return !!currentDraft.value
})
</script>

<style lang="less" scoped>
@import '../mixin.less';

.m-control-box {
  .section-title {
    font-size: 14px;
    color: #ccc;
    margin: 0 0 15px 0;
    font-weight: 500;
  }

  .no-draft {
    text-align: center;
    padding: 20px;
    color: #888;
    font-style: italic;

    p {
      margin: 0;
      font-size: 14px;
    }
  }

  .control-form {
    .form-group {
      margin-bottom: 16px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }

    .label {
      display: block;
      font-size: 13px;
      color: #ddd;
      margin-bottom: 6px;
      font-weight: 500;
    }

    .number-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #555;
      border-radius: 6px;
      background: #444;
      color: #fff;
      font-size: 14px;
      transition: border-color 0.2s ease;

      &:focus {
        outline: none;
        border-color: #ff9900;
        box-shadow: 0 0 0 2px rgba(255, 153, 0, 0.2);
      }

      &:hover {
        border-color: #666;
      }

      // 移除数字输入框的默认箭头
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &[type=number] {
        -moz-appearance: textfield;
      }
    }

    .range-input {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #555;
      outline: none;
      -webkit-appearance: none;
      cursor: pointer;

      // WebKit 浏览器滑块样式
      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ff9900;
        cursor: pointer;
        border: 2px solid #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: background 0.2s ease;

        &:hover {
          background: #ffb84d;
        }
      }

      // Firefox 滑块样式
      &::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ff9900;
        cursor: pointer;
        border: 2px solid #fff;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

        &:hover {
          background: #ffb84d;
        }
      }

      &::-moz-range-track {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: #555;
        border: none;
      }
    }
  }
}
</style>
