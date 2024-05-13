<!--
 * @Description: popup弹窗主文件
 * @Author: wangfengxiang
 * @Date: 2024-05-10 14:26:24
 * @LastEditTime: 2024-05-13 18:58:44
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
import { watch, onUnmounted } from 'vue'
import DraftList from './DraftList.vue'
import ControlBox from './ControlBox.vue'

// 草稿数据
import { openDB, closeDB } from '../utils/database'
import { useDrafts } from '../hooks/useDrafts'
const { draftsInfo, initDrafts, updateDraftsDB } = useDrafts(),
    { host, pathname } = window.$currentUrl
watch(
    draftsInfo,
    () => {
        updateDraftsDB()
        chrome.tabs.sendMessage(
            window.$currentTab.id,
            {
                type: 'UPDATE_DRAFTS',
                payload: {
                    dbKey: host + pathname,
                    draftsInfo: JSON.stringify(draftsInfo.value),
                },
            },
            (response) => {
                console.log('draftsInfo updatated')
            }
        )
    },
    { deep: true }
)
openDB().then(() => initDrafts())
onUnmounted(closeDB)

// 拾取
import { usePick } from '../hooks/usePick'
const { isPicking } = usePick()

// 链接改变关闭popup
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'URL_CHANGE') {
        request.payload.dbKey !== window.$currentUrl.host + window.$currentUrl.pathname &&
            window.close()
    }
    return true
})
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
