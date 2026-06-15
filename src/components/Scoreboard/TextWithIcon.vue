<script setup lang="ts">
import { useAttrs } from 'vue';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const props = defineProps<{
    text: string
    iconUrl?: string
    mirror?: boolean
}>()
</script>

<template>

    <div class="flex items-center" :class="mirror ? 'flex-row-reverse' : 'flex-row'">
        <img v-if="iconUrl" :src="iconUrl" alt="Icon" v-bind="attrs" class="w-auto object-contain"
            :class="mirror ? 'ml-2' : 'mr-2'" />
        <span class="text-2xl translate-y-1 font-extrabold spcing tracking-tight text-stretch-vertical capitalize">{{
            text }}</span>
    </div>
</template>


<style lang="css" scoped>
.text-stretch-vertical {
    font-weight: 800;
}
</style>