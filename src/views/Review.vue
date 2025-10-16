<template>
  <div class="review-page">
    <nav class="nav"></nav>
    <main class="main">
      <div class="page-list" :class="{ reviewing: status === 'reviewing' }">
        <div class="page-item" :style="{ backgroundImage: `url('${currentImage}')` }"></div>
      </div>
      <div class="progress-track">
        <div class="progress-bar" v-if="currentIndex > 0" :style="{ width: `${progress}%` }">
          <span class="progress-text" v-if="progress">{{ progress }}%</span>
        </div>
      </div>
      <div class="btns" @click="startReview"></div>
    </main>
    <aside class="aside">
      <div class="title-box"></div>
      <div class="code-pic"></div>
      <div class="msg-list" :class="{ anime: status === 'reviewing' || currentIndex > 0 }">
        <div class="msg-item" v-for="i in 7" :key="i"></div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const imageFileNames = [
  '20251015-210926.jpg',
  '20251015-210945.jpg',
  '20251015-210950.jpg',
  '20251015-210955.jpg',
  '20251015-210959.jpg',
  '20251015-211004.jpg',
  '20251015-211008.jpg',
  '20251015-211013.jpg',
  '20251015-211019.jpg',
  '20251015-211024.jpg',
  '20251015-211028.jpg',
  '20251015-211033.jpg',
  '20251015-211038.jpg',
  '20251015-211042.jpg',
  '20251015-211046.jpg',
  '20251015-211052.jpg',
  '20251015-211056.jpg',
  '20251015-211101.jpg',
  '20251015-211105.jpg',
  '20251015-211110.jpg',
  '20251015-211114.jpg',
  '20251015-211118.jpg',
  '20251015-211123.jpg',
  '20251015-211128.jpg',
  '20251015-211132.jpg',
  '20251015-211136.jpg',
  '20251015-211140.jpg',
  '20251015-211145.jpg',
]

function extUrl(path: string): string {
  try {
    // @ts-ignore
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(path)
    }
  } catch {}
  return path
}

const pageImgList = imageFileNames.map((n) => extUrl(`assets/icons/${n}`))
const currentIndex = ref(0)
const status = ref<'waiting' | 'reviewing'>('waiting')
const currentImage = computed(() => pageImgList[currentIndex.value] ?? '')
const progress = computed(() => Math.floor(((currentIndex.value + 1) / pageImgList.length) * 100))
const startReview = () => {
  if (status.value === 'waiting') {
    currentIndex.value = 0
    status.value = 'reviewing'
    const timer = setInterval(() => {
      currentIndex.value++
      if (currentIndex.value >= pageImgList.length - 1) {
        status.value = 'waiting'
        clearInterval(timer)
      }
    }, 500)
  }
}
</script>

<style scoped lang="less">
.review-page {
  width: 100vw;
  height: 100vh;
  background: #000;
  display: flex;
  overflow: hidden;
}
.nav {
  flex-shrink: 0;
  width: 304px;
  height: 100%;
  position: relative;
  background: url('~@/icons/nav-bg.png') no-repeat center/ cover;
  &::before {
    content: '';
    width: 195px;
    height: 603px;
    background: url('~@/icons/nav-text.png') no-repeat center/ 100%;
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translate(-50%, 0);
  }
}
.main {
  flex-shrink: 0;
  width: 578px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  .page-list {
    width: 375px;
    height: 667px;
    border-radius: 17px 17px 0 0;
    position: relative;
    overflow: hidden;
    &.reviewing {
      &::before {
        content: '';
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        position: absolute;
        top: 0;
        left: 0;
        border-radius: 17px 17px 0 0;
        z-index: 1;
      }
      &::after {
        content: '';
        width: 100%;
        height: 10px;
        background: radial-gradient(ellipse at center, #328cec 0%, transparent 90%);
        animation: light-anime 1s linear alternate infinite;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
      }
      @keyframes light-anime {
        0% {
          transform: translateY(0);
        }
        100% {
          transform: translateY(657px);
        }
      }
    }
    .page-item {
      width: 100%;
      height: 100%;
      background: no-repeat 0 0 / 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
  }
  .progress-track {
    width: 375px;
    height: 17px;
    border-radius: 0 0 17px 17px;
    background: #404040;
    .progress-bar {
      height: 100%;
      background: linear-gradient(to right, #89f1a5, #2268f4);
      border-radius: 0 0 17px 17px;
      transition: width 0.5s ease-in-out;
      .progress-text {
        display: block;
        width: 100%;
        height: 100%;
        font-size: 14px;
        color: #fff;
        text-align: right;
        padding-right: 10px;
        box-sizing: border-box;
        line-height: 17px;
      }
    }
  }
  .btns {
    width: 438px;
    height: 110px;
    background: url('~@/icons/btns.png') no-repeat center/ 100%;
    margin-top: 45px;
    cursor: pointer;
  }
}
.aside {
  flex: 1;
  height: 100%;
  background: url('~@/icons/aside-bg.png') no-repeat center/ cover;
  padding-top: 40px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  .title-box {
    width: 600px;
    height: 100px;
    background: url('~@/icons/title-btn.png') no-repeat center/ contain;
    margin-left: 48px;
  }
  .code-pic {
    width: 100%;
    height: 180px;
    background: url('~@/icons/code-pic.png') no-repeat 0 center / contain;
    margin-left: 28px;
  }
  .msg-list {
    flex: 1;
    overflow-y: auto;
    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-track {
      background: #555;
      border-radius: 2px;
    }
    &::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 2px;
    }
    &.anime {
      .msg-item {
        animation: msg-anime 0.2s linear forwards;
      }
    }
    .msg-item {
      background: no-repeat 0 center / contain;
      margin: 0 48px;
      opacity: 0;
      &:nth-child(1) {
        height: 52px;
        background-image: url('~@/icons/error-1.png');
        animation-delay: 3s;
      }
      &:nth-child(2) {
        height: 30px;
        background-image: url('~@/icons/error-2.png');
        margin-top: 17px;
        animation-delay: 5s;
      }
      &:nth-child(3) {
        height: 67px;
        background-image: url('~@/icons/warning-1.png');
        margin-top: 71px;
        animation-delay: 7s;
      }
      &:nth-child(4) {
        height: 67px;
        background-image: url('~@/icons/warning-2.png');
        margin-top: 17px;
        animation-delay: 8s;
      }
      &:nth-child(5) {
        height: 45px;
        background-image: url('~@/icons/warning-3.png');
        margin-top: 17px;
        animation-delay: 9s;
      }
      &:nth-child(6) {
        height: 45px;
        background-image: url('~@/icons/warning-4.png');
        margin-top: 17px;
        animation-delay: 12s;
      }
      &:nth-child(7) {
        height: 45px;
        background-image: url('~@/icons/warning-5.png');
        margin-top: 17px;
        margin-bottom: 50px;
        animation-delay: 14s;
      }
    }
  }
  @keyframes msg-anime {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }
}
// 笔记本屏幕
@media screen and (max-width: 1600px) {
  .nav {
    &::before {
      width: 150px;
      height: 603px;
      top: 20px;
    }
  }

  .main {
    .page-list {
      width: 270px;
      height: 465px;
      &.reviewing {
        @keyframes light-anime {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(465px);
          }
        }
      }
    }
    .progress-track {
      width: 270px;
      height: 12px;
      .progress-bar {
        border-radius: 0 0 12px 12px;
        .progress-text {
          font-size: 10px;
          padding-right: 6px;
          line-height: 12px;
        }
      }
    }
    .btns {
      width: 320px;
      height: 80px;
      margin-top: 30px;
    }
  }

  .aside {
    padding-top: 30px;
    .title-box {
      width: 450px;
      height: 75px;
      margin-left: 36px;
    }
    .code-pic {
      height: 135px;
    }
    .msg-list {
      .msg-item {
        margin: 0 20px;
        &:nth-child(2) {
          height: 24px;
          margin-top: 12px;
        }
        &:nth-child(3) {
          margin-top: 30px;
        }
        &:nth-child(4) {
          margin-top: 0;
        }
        &:nth-child(5) {
          margin-top: 4px;
        }
        &:nth-child(6) {
          height: 28px;
          margin-top: 14px;
        }
        &:nth-child(7) {
          height: 42px;
          margin-top: 14px;
        }
      }
    }
  }
}
</style>
