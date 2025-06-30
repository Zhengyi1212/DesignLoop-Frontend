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
  <g>
    <path 
      :style="{ strokeWidth: selected ? 3 : 2, stroke: selected ? '#6366F1' : '#b1b1b7' }" 
      class="vue-flow__edge-path" 
      :d="pathData[0]" 
      :marker-end="markerUrl" 
    />
    
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
  </g>
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
