<script setup>
import { computed } from 'vue';
import { getBezierPath } from '@vue-flow/core';
import Button from 'primevue/button';

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  selected: { type: Boolean, required: false },
  // MODIFICATION: Added interactionWidth to the props.
  // Now this component can receive the interaction width from App.vue.
  interactionWidth: { type: Number, required: false, default: 20 },
});

const emit = defineEmits(['delete-edge']);

const pathData = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  sourcePosition: props.sourcePosition,
  targetX: props.targetX,
  targetY: props.targetY,
  targetPosition: props.targetPosition,
}));

const markerUrl = computed(() => props.selected ? 'url(#custom-arrow-selected)' : 'url(#custom-arrow)');


function onDeleteEdge() {
  emit('delete-edge', props.id);
}
</script>

<template>
  <!-- MODIFICATION: This group now contains two paths. -->
  
  <!-- Path 1: The visible edge. -->
  <!-- This is the line you see on the screen. -->
  <path 
    :style="{ strokeWidth: selected ? 3 : 2, stroke: selected ? '#6366F1' : '#b1b1b7' }" 
    class="vue-flow__edge-path" 
    :d="pathData[0]" 
    :marker-end="markerUrl" 
  />
  
  <!-- Path 2: The invisible interaction edge. -->
  <!-- This path is transparent but has a large stroke-width to make it easy to click. -->
  <!-- Its width is now correctly bound to the `interactionWidth` prop. -->
  <path
    :d="pathData[0]"
    fill="none"
    stroke-opacity="0"
    :stroke-width="interactionWidth"
  />

  <foreignObject 
    v-if="selected"
    width="32" 
    height="32" 
    :x="pathData[1] - 16" 
    :y="pathData[2] - 16" 
    class="edgebutton-foreignobject"
  >
    <div class="edge-button-container">
      <Button 
        icon="pi pi-times" 
        rounded 
        text 
        severity="danger" 
        @click="onDeleteEdge" 
        title="Delete Edge"
      />
    </div>
  </foreignObject>
</template>

<style scoped>
.edge-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
}
</style>
