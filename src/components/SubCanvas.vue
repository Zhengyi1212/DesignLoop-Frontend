<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import CustomNode from './CustomNode.vue';
import useDragAndDrop from '../composables/useDnD.js';

// ---- Props & Emits ----
const props = defineProps({
  nodeId: { type: String, required: true },
  nodeName: { type: String, default: 'Sub-Canvas' },
  initialNodes: { type: Array, required: true },
  initialEdges: { type: Array, required: true },
});

const emit = defineEmits(['close', 'update:graph']);

// ---- State & Scoped Vue Flow Instance ----
// By calling useVueFlow here, we get a NEW, ISOLATED instance of Vue Flow.
// Its state and controls are completely separate from the main canvas in App.vue.
const { onConnect, addEdges, getNodes, getEdges } = useVueFlow();

// The internal state for the nodes and edges of this sub-canvas.
// We initialize it with the data passed down from the parent (App.vue).
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);

// ---- Drag and Drop for Sub-Canvas ----
// It uses the same composable, but since it's called within this component's setup,
// it only affects this sub-canvas instance.
const { onDragOver, onDrop } = useDragAndDrop();

// ---- Component Logic ----

// Handle new connections made *within* this sub-canvas.
onConnect((params) => addEdges(params));

// Freeze/unfreeze nodes *only within* this sub-canvas.
function toggleFreeze() {
  const isCurrentlyFrozen = nodes.value.every(n => n.draggable === false);
  nodes.value = nodes.value.map(node => ({
    ...node,
    draggable: isCurrentlyFrozen,
    selectable: isCurrentlyFrozen,
  }));
}

// This is the data "interface" for passing data from the sub-canvas back to the parent.
// It watches for any changes to this canvas's internal nodes or edges and emits
// an 'update:graph' event, so App.vue always has the latest data.
watch([nodes, edges], () => {
    emit('update:graph', { 
        nodeId: props.nodeId, 
        nodes: getNodes.value, 
        edges: getEdges.value 
    });
}, { deep: true });

// ---- Window Dragging Logic (for a better user experience) ----
const subCanvasEl = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

function onHeaderMouseDown(event) {
    isDragging.value = true;
    const rect = subCanvasEl.value.getBoundingClientRect();
    dragOffset.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
}

function onDragMove(event) {
    if (!isDragging.value) return;
    subCanvasEl.value.style.left = `${event.clientX - dragOffset.value.x}px`;
    subCanvasEl.value.style.top = `${event.clientY - dragOffset.value.y}px`;
}

function onDragEnd() {
    isDragging.value = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
}

onUnmounted(() => {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
    <div class="sub-canvas-overlay">
        <div class="sub-canvas-window" ref="subCanvasEl">
            <div class="sub-canvas-header" @mousedown="onHeaderMouseDown">
                <span class="title">Sub-Canvas: {{ nodeName }}</span>
                <button @click="emit('close')" class="close-btn" title="Close Canvas">×</button>
            </div>
            <div class="sub-canvas-content">
                 <VueFlow
                    v-model:nodes="nodes"
                    v-model:edges="edges"
                    @dragover="onDragOver"
                    @drop="onDrop"
                    :fit-view-on-init="true"
                 >
                    <template #node-custom="customProps">
                      <CustomNode v-bind="customProps" @open-canvas="() => {}" />
                    </template>
                    <Background />
                    <Controls />
                 </VueFlow>
            </div>
            <Toolbar @toggle-freeze="toggleFreeze" />
        </div>
    </div>
</template>

<style scoped>
.sub-canvas-overlay {
    position: fixed; /* Use fixed to cover the whole viewport */
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(44, 62, 80, 0.3);
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
}
.sub-canvas-window {
    width: 65vw;
    height: 75vh;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 15px 40px rgba(0,0,0,0.25);
    display: flex;
    flex-direction: column;
    position: absolute; /* Necessary for dragging */
}
.sub-canvas-header {
    padding: 12px 20px;
    background-color: #f8f9fa;
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
}
.sub-canvas-header .title {
    font-weight: 600;
    color: #343a40;
}
.close-btn {
    background: none; border: none; font-size: 26px;
    font-weight: 600; cursor: pointer; color: #adb5bd;
    transition: color 0.2s ease;
}
.close-btn:hover { color: #212529; }
.sub-canvas-content {
    flex-grow: 1;
    position: relative;
}
/* Use :deep() to style the child Toolbar component from here */
.sub-canvas-content + :deep(.toolbar) {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    border-top: 1px solid #dee2e6;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
}
</style>