<!--
 * @Description: popup弹窗主文件
 * @Author: wangfengxiang
 * @Date: 2024-05-10 14:26:24
 * @LastEditTime: 2024-05-10 15:37:50
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
        <section class="draft-list">
            <div class="draft-item"></div>
            <div class="draft-item"></div>
            <div class="draft-item"></div>
            <div class="draft-item add"></div>
        </section>
        <!-- 控制面板 -->
        <ControlBox />
    </div>
</template>

<script setup>
import ControlBox from './ControlBox.vue'
import { usePick } from '../hooks/usePick'
const { isPicking } = usePick()

// 拾取
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

    .draft-list {
        width: 100%;
        height: 177px;
        overflow: hidden;
        display: flex;
        flex-wrap: no-wrap;
        align-items: center;
        margin: 20px 0 10px;

        .draft-item {
            flex-shrink: 0;
            .size(100px, 177px);
            border-radius: 10px;
            margin-right: 4px;
            border: 1px solid #e6e6e6;
            background: no-repeat 0 0 / cover;

            &.add {
                background: url(../icons/add.png) no-repeat center/30px;
            }
        }
    }
}
</style>
