<template>
  <div class="ai-check">
    <!-- 上：左右并排，左页面截图，右设计稿上传 -->
    <section class="top">
      <div class="panel" @click="captureViewport">
        <div class="panel-title">页面截图（当前视口）</div>
        <div class="panel-body" :class="{ anime: loading }">
          <img v-if="pageShot" :src="pageShot" alt="page" />
          <div v-else class="placeholder">点击获取截图</div>
        </div>
      </div>
      <div class="panel" @click="triggerUpload">
        <div class="panel-title">设计稿（点击上传）</div>
        <div class="panel-body" :class="{ anime: loading }">
          <img v-if="designShot" :src="designShot" alt="design" />
          <div v-else class="placeholder">点击上传本地图片</div>
        </div>
        <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
      </div>
    </section>

    <!-- 中：按钮 -->
    <section class="middle">
      <button class="primary" :class="{ shake: shake }" :disabled="loading" @click="runCheck">
        <template v-if="loading">
          <span class="btn-spinner" aria-hidden="true"></span>
          <span class="nowrap">检测中...</span>
        </template>
        <template v-else>
          <span class="nowrap">
            <template v-if="!pageShot && !designShot">请先获取截图并上传设计稿</template>
            <template v-else-if="!pageShot">请先获取页面截图</template>
            <template v-else-if="!designShot">请先上传设计稿</template>
            <template v-else>开始AI检测</template>
          </span>
        </template>
      </button>
      <div v-if="loading" class="progress">
        <div class="bar"></div>
      </div>
    </section>

    <!-- 下：结果输出 -->
    <section class="bottom">
      <div v-if="result" ref="resultBox" class="result scrollable">{{ result }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const pageShot = ref<string>('')
const designShot = ref<string>('')
const result = ref<string>('')
const loading = ref(false)
const shake = ref(false)
const resultBox = ref<HTMLDivElement | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

function triggerUpload(): void {
  fileInput.value?.click()
}

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    designShot.value = String(reader.result || '')
  }
  reader.readAsDataURL(file)
  // 清除上次结果
  result.value = ''
}

function captureViewport(): void {
  result.value = ''
  try {
    // 优先使用浏览器可见区域截图
    chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
      if (!chrome.runtime.lastError && dataUrl) {
        pageShot.value = dataUrl
        return
      }
      // 回退到内容脚本截图
      if (!window.$currentTab?.id) return
      chrome.tabs.sendMessage(
        window.$currentTab.id,
        { type: 'GET_VIEWPORT_SCREENSHOT' },
        (resp) => {
          if (chrome.runtime.lastError) return
          if (resp && resp.success && resp.dataUrl) {
            pageShot.value = resp.dataUrl
          }
        }
      )
    })
  } catch {}
}

function runCheck(): void {
  if (loading.value) return
  if (!pageShot.value || !designShot.value) {
    const msg =
      !pageShot.value && !designShot.value
        ? '请先获取截图并上传设计稿'
        : !pageShot.value
          ? '请先获取页面截图'
          : '请先上传设计稿'
    result.value = msg
    shake.value = true
    setTimeout(() => {
      shake.value = false
    }, 400)
    return
  }
  result.value = ''
  loading.value = true
  // 模拟 SSE 流式输出
  const chunks: string[] = [
    '设计稿（图 1）与前端实现（图 2）比对后发现以下 UI 还原问题：',
    '蒙层',
    '• 颜色深浅不一致：设计稿约为 #00000040（40% 黑色），实现为更深的 #00000066 左右，导致整体偏暗。',
    '• 透明度不同步，实机上内容干扰阅读。',
    '弹窗主体尺寸与圆角',
    '• 设计稿顶部圆角≈12 px，前端约 16-18 px，圆角过大。',
    '• 整体高度略低于设计稿，底部预留安全区与文案距离不足。',
    '关闭（X）图标',
    '• 大小偏大（约大 2-3 px）；',
    '• 颜色更深（设计稿 #BFBFBF，前端接近 #8C8C8C）；',
    '• 垂直位置偏上，与标题未做到完全居中对齐。',
    '标题「选择支付方式」',
    '• 字体粗细不一致：设计稿为中粗体（500-600），实际为常规体；',
    '• 与顶部边距应为 24 px，前端约 20 px；',
    '• 水平未完全居中，与关闭按钮对称性不足。',
    '价格区域',
    '• “¥” 与数字未对齐：设计稿上基线一致，前端 “90” 有下沉现象；',
    '• 数字字号偏大 2-4 px 且字重更粗；',
    '• 与下方提示文案间距过大（设计稿 12 px，前端约 20 px）。',
    '提示文案「支付成功后…」',
    '• 颜色偏差：设计稿 #FFB84C（亮金色），前端接近 #C69034，显得更暗；',
    '• 设计稿为居中对齐，前端为左对齐；',
    '• 上下留白与分割线距离超出设计规范。',
    '分割线',
    '• 设计稿左右各收缩 16 px，前端满宽铺满；',
    '• 颜色略深（设计 #F0F0F0，前端 #E0E0E0）。',
    '支付渠道行',
    '• 图标尺寸／间距：支付宝、微信图标在前端缩小并与文字间距不足；',
    '• “支付宝支付” 被缩短为 “支付宝”，文案不一致；',
    '• 行高、上下内边距比设计稿多 4-6 px，导致整体被拉长；',
    '• 单选框（Radio）',
    '– 选中态：设计稿外圈 #FFB23A、线宽 2 px、内点直径 8 px；前端外圈颜色更黄、线宽 3 px、内点偏大；',
    '– 未选中态：设计稿外圈 #D9D9D9，前端颜色更浅且外圈半径偏大。',
    'CTA 按钮「立即购买」',
    '• 渐变色不匹配：设计稿从 #FFD96A → #FFC242，前端更亮偏黄；',
    '• 按钮高度少 4 px；',
    '• 圆角过大；',
    '• 文案字体粗细应为 Medium，前端 Regular；',
    '• 文字颜色应纯白 #FFFFFF，前端略带灰度（#F2F2F2 / #EAEAEA）。',
    '底部说明文字',
    '• 设计要求距底部安全区 36 px，前端仅约 18 px；',
    '• 字号偏小、颜色偏灰；',
    '• 文案行高过低导致可读性下降。',
    'Safe-Area / Home Indicator 处理',
    '• 设计稿特别标注“不可挡住 Home Indicator 区域”，前端实际已压到 36 px 以内，真机上可能被遮挡。',
    '全局字体',
    '• 多处字号（标题、提示、按钮文案）均比设计稿大 1-2 px，影响层次。',
    '• 字重未统一，设计稿强调层（标题、价格、按钮）需用 500 以上字重。',
    '交互反馈',
    '• Radio 选中／未选中切换无过渡动画，设计稿标注需 150 ms 缩放-淡入。',
    '• 按钮点击态（深色遮罩或缩放 0.96）未实现。',
    '综上，需从颜色、字号、间距、对齐、组件尺寸及交互等方面进行修正，以达到设计稿 100% 还原。',
  ]

  let idx = 0
  const step = () => {
    if (idx < chunks.length) {
      result.value += (idx ? '\n' : '') + chunks[idx]
      nextTick(() => {
        if (resultBox.value) {
          resultBox.value.scrollTop = resultBox.value.scrollHeight
        }
      })
      idx += 1
      window.setTimeout(step, 60)
    } else {
      loading.value = false
    }
  }
  step()
}
</script>

<style scoped>
.ai-check {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.top {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.panel {
  width: 45%;
  background: #222;
  border: 1px solid #444;
  cursor: pointer;
}
.panel-title {
  padding: 6px 8px;
  border-bottom: 1px solid #444;
  color: #ddd;
  font-size: 12px;
}
.panel-body {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
  position: relative;
  &::before {
    content: '';
    width: 100%;
    height: 10px;
    background: radial-gradient(ellipse at center, #328cec 0%, transparent 90%);
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
  }
  &.anime {
    &::before {
      opacity: 1;
      animation: light-anime 0.8s linear alternate infinite;
    }
  }
  @keyframes light-anime {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(150px);
    }
  }
}
.panel-body img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.placeholder {
  color: #666;
  font-size: 12px;
}
.hidden {
  display: none;
}
.middle {
  display: flex;
  justify-content: center;
}
.primary {
  padding: 8px 14px;
  background: #2d8cf0;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
}
.primary:disabled {
  background: #555;
  cursor: not-allowed;
}
.primary.shake {
  animation: shake 0.4s ease;
}
.nowrap {
  white-space: nowrap;
  display: inline-block;
}
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.progress {
  width: 220px;
  height: 4px;
  background: #444;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
}
.progress .bar {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, #2d8cf0, #69b1ff);
  animation: slide 1.2s ease-in-out infinite;
}
@keyframes slide {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(20%);
  }
  100% {
    transform: translateX(160%);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes shake {
  0% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-3px);
  }
  50% {
    transform: translateX(3px);
  }
  75% {
    transform: translateX(-2px);
  }
  100% {
    transform: translateX(0);
  }
}
.bottom {
  min-height: 80px;
  color: #ddd;
  font-size: 12px;
}
.result {
  white-space: pre-wrap;
}
.result.scrollable {
  max-height: 160px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #444;
  background: #111;
  border-radius: 4px;
}
</style>
