<script setup lang="ts">
import { computed, toRefs } from "vue";
import { CoercableComponent } from "../../features/feature";
import { chunkArray } from "../../util";
import { render, renderRow, VueFeature } from "../../util/vue";
import Row from "../layout/Row.vue";

const _props = defineProps<{
    components: (VueFeature | CoercableComponent)[];
    chunkSize: number;
}>();

const props = toRefs(_props);

const components = computed(() => {
    return chunkArray(props.components.value, props.chunkSize.value);
});
</script>

<template>
    <!--<Row v-for="chunk in components" :key="components.indexOf(chunk)">
        <template v-for="component in chunk" :key="chunk.indexOf(component)">
            <component :is="component" />
            {{ render(component) }}
        </template>
    </Row>-->
    <template v-for="chunk in components" :key="components.indexOf(chunk)">
        {{ renderRow(...chunk) }}
    </template>
</template>
