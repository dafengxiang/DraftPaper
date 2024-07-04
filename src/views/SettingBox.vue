<!--
 * @Description: 全局设置面板
 * @Author: wangfengxiang
 * @Date: 2024-07-03 16:17:06
 * @LastEditTime: 2024-07-04 10:26:31
 * @LastEditors: wangfengxiang
-->
<template>
    <section class="m-setting-box">
        <div class="setting-title">代码模版</div>

        <div class="setting-subtitle">
            模版中
            <span>{top}</span> 和
            <span>{left}</span> 将被替换为元素位移的top和left值，并自动复制到剪切板中
        </div>
        <div class="setting-subtitle">
            默认：<span>position: absolute; top: {top}px; left: {left}px;</span>
        </div>
        <input
            type="text"
            class="code-input"
            v-model.trim="draftsInfo.templateCode"
            placeholder="请输入代码模版"
        />
    </section>
</template>

<script setup>
import { ref } from 'vue'
import { useDrafts } from '../hooks/useDrafts'
const { draftsInfo } = useDrafts()
</script>

<style lang="less">
@import '../mixin.less';
.m-setting-box {
    padding-top: 10px;
    .setting-title {
        font-size: 16px;
        line-height: 20px;
        color: #eee;
    }
    .setting-subtitle {
        font-size: 12px;
        line-height: 16px;
        margin: 5px 0;
        color: #ccc;
        span {
            color: #7cacf8;
        }
    }
    .code-input {
        .size(100%, 30px);
        border-radius: 5px;
        padding: 3px 10px;
    }
}
</style>
