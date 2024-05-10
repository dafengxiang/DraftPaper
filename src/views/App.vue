<!--
 * @Description: popup弹窗主文件
 * @Author: wangfengxiang
 * @Date: 2024-05-10 14:26:24
 * @LastEditTime: 2024-05-10 21:35:22
 * @LastEditors: wangfengxiang
-->
<template>
    <div class="m-extension-popup">
        <h3 class="title">hi,前端稿纸</h3>
        <button
            class="d-handle-btn"
            :class="{ disabled: !isPicking }"
            @click="isPicking = !isPicking"
        ></button>
        <!-- 草稿列表 -->
        <DraftList />
        <!-- 控制面板 -->
        <ControlBox />
    </div>
</template>

<script setup>
import { watch } from 'vue'
import DraftList from './DraftList.vue'
import ControlBox from './ControlBox.vue'

// 页面信息
import { useWindowInfo } from '../hooks/useWindowInfo'
const { tabInfo, initWindowInfo } = useWindowInfo()
initWindowInfo()

// 拾取
import { usePick } from '../hooks/usePick'
const { isPicking } = usePick()

// 草稿状态
import { useDrafts } from '../hooks/useDrafts'
const { currentDraft, initDrafts, updateDraftsStorage } = useDrafts()
initDrafts()
setInterval(() => {
    watch(
        currentDraft,
        (cl) => {
            console.log('cl: ', cl)
            updateDraftsStorage()
        },
        { deep: true }
    )
}, 500)
</script>

<style lang="less">
@import '../mixin.less';
.m-extension-popup {
    height: 100%;
    padding: 10px;
    position: relative;

    .title {
        font-size: 18px;
        font-weight: 600;
    }

    .d-handle-btn {
        .ab(6px, 292px);
        .square(25px);
        background: url('../icons/pick.png') no-repeat 0 0 / contain;

        &.disabled {
            background-image: url('../icons/pick_disabled.png');
        }
    }
}
</style>
