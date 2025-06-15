<!--
 * @Description: popup弹窗主文件
 * @Author: wangfengxiang
 * @Date: 2024-05-10 14:26:24
 * @LastEditTime: 2024-07-03 16:45:40
 * @LastEditors: wangfengxiang
-->
<template>
    <div class="m-extension-popup">
        <h3 class="title">前端稿纸</h3>
        <button
            class="d-handle-btn"
            :class="{ disabled: !draftsInfo.isCanPick }"
            @click="draftsInfo.isCanPick = !draftsInfo.isCanPick"
        ></button>
        <button
            class="d-setting-btn"
            :class="{ disabled: !isSetting }"
            @click="isSetting = !isSetting"
        ></button>
        <!-- 设置面板 -->
        <SettingBox v-if="isSetting" />
        <template v-else>
            <!-- 草稿列表 -->
            <DraftList />
            <!-- 控制面板 -->
            <ControlBox />
        </template>
    </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import DraftList from './DraftList.vue'
import ControlBox from './ControlBox.vue'
import SettingBox from './SettingBox.vue'

const isSetting = ref(false)

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

// 链接改变关闭popup
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'URL_CHANGE') {
        request.payload.dbKey !== window.$currentUrl.host + window.$currentUrl.pathname &&
            window.close()
    }
    return true
})
</script>

<style lang="less" scoped>
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
        .ab(6px, 262px);
        .square(25px);
        background: url('../icons/pick.png') no-repeat 0 0 / contain;

        &.disabled {
            background-image: url('../icons/pick_disabled.png');
        }
    }
    .d-setting-btn {
        .ab(6px, 292px);
        .square(25px);
        background: url('../icons/setting.png') no-repeat 0 0 / contain;

        &.disabled {
            background-image: url('../icons/setting_disabled.png');
        }
    }
}
</style>
