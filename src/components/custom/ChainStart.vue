<script setup lang="ts">
import { toRefs } from "vue";
import { BoardNode } from "../../features/boards/board";
import { LayerState } from "../../data/projEntry";
import ChainBody from "./ChainBody.vue";

const _props = defineProps<{
    size: number;
    fillColor: string;
    strokeColor: string;
    node: BoardNode;
}>();
const props = toRefs(_props);
const size = props.size.value;
const spokeSize = 0.5;
const pts = [
    [-size, -size],
    [-size, size],
    [-size * spokeSize, size],
    [0, size * (1 + spokeSize)],
    [size * spokeSize, size],
    [size, size],
    [size, -size]
]
    .map(d => `${d[0]},${d[1]}`)
    .join(" ");
const data = props.node.value.state as LayerState;
const parts = data.parts;
</script>

<template>
    <polygon class="body" :points="pts" :fill="fillColor" :stroke="strokeColor" :stroke-width="4" />
    <g v-for="(part, i) in parts" :key="i" :transform="'translate(0 ' + (i + 1) * size * 2.5 + ')'">
        <ChainBody
            :fill-color="fillColor"
            :size="size"
            :data="part"
            :stroke-color="strokeColor"
        />
    </g>
</template>

<style scoped></style>
