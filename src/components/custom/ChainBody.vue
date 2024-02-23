<script setup lang="ts">
import { toRefs, unref } from "vue";
import { PartData } from "../../data/util";
import themes from "../../data/themes";
import settings from "../../game/settings";
import Text from "../fields/Text.vue";

const _props = defineProps<{
    size: number;
    fillColor: string;
    strokeColor: string;
    data: PartData;
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
    [size, -size],
    [size * spokeSize, -size],
    [0, -size * spokeSize],
    [-size * spokeSize, -size]
]
    .map(d => `${d[0]},${d[1]}`)
    .join(" ");
</script>

<template>
    <polygon class="body" :points="pts" :fill="fillColor" :stroke="strokeColor" :stroke-width="4" />
    <text
        :fill="themes[settings.theme].variables['--foreground']"
        :x="-size / 2"
        class="node-title"
        >{{ unref(props.data).type }}</text
    >
    <text
        :fill="themes[settings.theme].variables['--foreground']"
        :x="-size / 2"
        :y="20"
        class="node-title"
        >{{ unref(props.data).stars + "-Star" }}</text
    >
</template>

<style scoped></style>
