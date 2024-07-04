<!--
 * @Description: 草稿列表
 * @Author: wangfengxiang
 * @Date: 2024-05-10 18:50:23
 * @LastEditTime: 2024-07-04 15:19:59
 * @LastEditors: wangfengxiang
-->
<template>
    <ul class="m-draft-list">
        <li
            class="draft-item"
            :class="{ selected: draftsInfo.selectedIdx === i }"
            v-for="({ pic }, i) in draftsInfo?.list ?? []"
            :style="`background-image: url(${pic});`"
            :key="i"
            @click="draftsInfo.selectedIdx = i"
        >
            <button class="delete-btn" @click.stop="deleteDraft(i)"></button>
        </li>
        <input type="file" accept="image/*" class="draft-item add" @change="handleImageUpload" />
    </ul>
</template>

<script setup>
import { useDrafts } from '../hooks/useDrafts'
const { draftsInfo } = useDrafts(),
    handleImageUpload = (event) => {
        const file = event.target.files[0],
            reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
            const pic = reader.result
            if (!draftsInfo.value?.list?.length) draftsInfo.value.list = []
            draftsInfo.value.list.push({
                pic,
                width: 750,
                top: 0,
                left: 0,
                opacity: 1,
            })
            draftsInfo.value.selectedIdx = draftsInfo.value.list.length - 1
        }
    },
    deleteDraft = (idx) => {
        draftsInfo.value.list.splice(idx, 1)
        if (
            draftsInfo.value.selectedIdx >= idx ||
            (draftsInfo.value.selectedIdx === idx && idx > 0)
        )
            draftsInfo.value.selectedIdx -= 1
    }
</script>

<style lang="less" scoped>
@import '../mixin.less';
.m-draft-list {
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
        filter: grayscale(0.8);
        background: no-repeat 0 0 / cover;
        .delete-btn {
            .square(20px);
            .ab(6px,70px);
            background: url(../icons/delete.png) no-repeat center/20px;
        }
        &.selected {
            filter: grayscale(0);
            border-color: #ff9900;
        }

        &.add {
            font-size: 0;
            position: relative;
            &::after {
                content: '';
                .square(100%);
                .ab(0,0);
                background: #333 url(../icons/add.png) no-repeat center/30px;
            }
        }
    }
}
</style>
