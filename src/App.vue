<script setup>
import { ref } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

// Import our components and composables
import InstructionPanel from './components/InstructionPanel.vue';
import Toolbar from './components/Toolbar.vue';
import CustomNode from './components/CustomNode.vue';
import useDragAndDrop from './composables/useDnD.js';

// ---- State Management ----

// This single `useVueFlow` instance controls our one and only canvas.
const { onConnect, addEdges, removeNodes } = useVueFlow();
const { onDragOver, onDrop: originalOnDrop } = useDragAndDrop();

// These refs hold the data for the *currently visible* canvas.
const nodes = ref([]);
const edges = ref([]);

// This will hold the snapshot of the main canvas when we enter a sub-canvas.
const mainCanvasCache = ref(null);

// These refs track if we are in sub-canvas mode.
const activeSubCanvasNodeId = ref(null);
const activeSubCanvasNodeName = ref('');

// --- Sub-Canvas Logic (State-Swapping Method) ---

/**
 * Opens a sub-canvas by swapping the VueFlow state.
 * @param {string} nodeId - The ID of the node to open.
 */
function handleOpenSubCanvas(nodeId) {
    const parentNode = nodes.value.find(n => n.id === nodeId);
    if (!parentNode) return;

    mainCanvasCache.value = {
        nodes: JSON.parse(JSON.stringify(nodes.value)),
        edges: JSON.parse(JSON.stringify(edges.value)),
    };

    activeSubCanvasNodeId.value = nodeId;
    activeSubCanvasNodeName.value = parentNode.data.title || 'Sub-Canvas';

    if (!parentNode.data.subGraph) {
        parentNode.data.subGraph = { nodes: [], edges: [] };
    }
    
    const cachedParentNode = mainCanvasCache.value.nodes.find(n => n.id === nodeId);
    nodes.value = cachedParentNode.data.subGraph.nodes;
    edges.value = cachedParentNode.data.subGraph.edges;
}

/**
 * Saves the current sub-canvas state without closing it.
 */
function handleSaveSubCanvas() {
    if (!activeSubCanvasNodeId.value || !mainCanvasCache.value) return;

    const parentNode = mainCanvasCache.value.nodes.find(n => n.id === activeSubCanvasNodeId.value);
    
    if (parentNode) {
      parentNode.data.subGraph = {
          nodes: JSON.parse(JSON.stringify(nodes.value)),
          edges: JSON.parse(JSON.stringify(edges.value)),
      };
    }
    // You could add a "Saved!" confirmation toast here.
}

/**
 * Closes the sub-canvas view, saving its state and restoring the main canvas.
 */
function handleCloseSubCanvas() {
    handleSaveSubCanvas();
    
    if (!mainCanvasCache.value) return;
    nodes.value = mainCanvasCache.value.nodes;
    edges.value = mainCanvasCache.value.edges;
    
    // Reset the state to exit sub-canvas mode
    activeSubCanvasNodeId.value = null;
    activeSubCanvasNodeName.value = '';
    mainCanvasCache.value = null;
}


// --- Event Handlers ---

function onDrop(event) {
    if (!activeSubCanvasNodeId.value) {
        originalOnDrop(event, (newNode) => {
            if (!newNode.data) newNode.data = {};
            newNode.data.subGraph = { nodes: [], edges: [] };
        });
    } else {
        originalOnDrop(event);
    }
}

function onNodeDelete(nodeId) {
  removeNodes([nodeId]);
}

function toggleFreeze() {
  const isCurrentlyFrozen = nodes.value.every(n => n.draggable === false);
  nodes.value = nodes.value.map(node => ({
      ...node,
      draggable: isCurrentlyFrozen,
      selectable: isCurrentlyFrozen,
  }));
}

// ---- Standard Setup ----
onConnect((params) => addEdges(params));
const isLoading = ref(false);
const instructionPanels = ref([
  { title: 'User', content: '' },
  { title: 'Design Background', content: '' },
  { title: 'Design Goal', content: '' },
  { title: 'Pipeline', content: '' },
]);

function handlePanelUpdate({ index, content }) {
  instructionPanels.value[index].content = content;
}

async function handleFetchObjective() {
    isLoading.value = true;
    instructionPanels.value[3].content = 'Processing...';
    await new Promise(resolve => setTimeout(resolve, 1500));
    instructionPanels.value[3].content = 'Pipeline process complete!';
    isLoading.value = false;
}

</script>

<template>
  <div class="app-container">
    <InstructionPanel 
      :panels="instructionPanels" 
      :is-loading="isLoading"
      @update-panel-content="handlePanelUpdate" 
      @fetch-objective="handleFetchObjective"
    />

    <main class="main-content">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        class="flow-canvas"
        @dragover="onDragOver"
        @drop="onDrop"
        :fit-view-on-init="true"
      >
        <template #node-custom="props">
          <CustomNode 
            v-bind="props"
            @delete="onNodeDelete" 
            @open-canvas="handleOpenSubCanvas" 
          />
        </template>
        
        <Background />
        <MiniMap />
        <Controls />
      </VueFlow>

      <Toolbar @toggle-freeze="toggleFreeze" />

      <!-- The new UI for the simulated sub-canvas window -->
      <transition name="sub-canvas-fade">
        <div v-if="activeSubCanvasNodeId">
          <!-- The key change: A clipping overlay that cuts a hole to the canvas -->
          <div class="sub-canvas-clipping-overlay"></div>
          
          <!-- This decorative frame sits around the hole -->
          <div class="sub-canvas-window-frame">
            <div class="sub-canvas-header">
              <span class="header-title">✏️ Editing Node: {{ activeSubCanvasNodeName }}</span>
            </div>
            <div class="sub-canvas-footer">
                <button @click="handleSaveSubCanvas" class="btn-save">💾 Save Progress</button>
                <button @click="handleCloseSubCanvas" class="btn-close">✅ Done</button>
            </div>
          </div>
        </div>
      </transition>
    </main>
  </div>
</template>

<style>
/* Import base styles */
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/theme-default.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css';

:root {
  --app-bg: #f3f4f6;
  --panel-width: 250px;
  /* Define window dimensions for easy reuse */
  --sub-canvas-width: 70vw;
  --sub-canvas-height: 75vh;
  --sub-canvas-top: calc((100vh - var(--sub-canvas-height)) / 2);
  --sub-canvas-left: calc((100vw - var(--sub-canvas-width) - var(--panel-width)) / 2 + var(--panel-width));
}
body, html {
  margin: 0; padding: 0; height: 100%;
  font-family: 'JetBrains Mono', 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--app-bg);
}
.app-container {
  display: flex; height: 100vh;
}
.main-content {
  flex-grow: 1; position: relative; display: flex; flex-direction: column;
}
.flow-canvas {
  flex-grow: 1;
}

/* NEW STYLES FOR SIMULATED WINDOW (CLIP-PATH METHOD) */

/* This is the dark overlay. It has a hole punched in it. */
.sub-canvas-clipping-overlay {
    position: absolute;
    top: 0;
    left: 0; /* Changed from panel-width to 0 to cover everything */
    right: 0;
    bottom: 0;
    background-color: rgba(23, 32, 42, 0.7);
    z-index: 20;
    pointer-events: none; /* Let all clicks go through to the canvas underneath */
    
    /* This is the magic: It creates a cutout rectangle */
    clip-path: polygon(
      evenodd,
      0 0, 0 100%, 100% 100%, 100% 0, 0 0, /* Outer path (full screen) */
      var(--sub-canvas-left) var(--sub-canvas-top), /* Inner path (the hole) */
      calc(var(--sub-canvas-left) + var(--sub-canvas-width)) var(--sub-canvas-top),
      calc(var(--sub-canvas-left) + var(--sub-canvas-width)) calc(var(--sub-canvas-top) + var(--sub-canvas-height)),
      var(--sub-canvas-left) calc(var(--sub-canvas-top) + var(--sub-canvas-height)),
      var(--sub-canvas-left) var(--sub-canvas-top)
    );
}

/* This is just the decorative frame around the hole */
.sub-canvas-window-frame {
    position: absolute;
    top: var(--sub-canvas-top);
    left: var(--sub-canvas-left);
    width: var(--sub-canvas-width);
    height: var(--sub-canvas-height);
    z-index: 21; /* Sits on top of the overlay */
    pointer-events: none; /* The frame itself is not clickable */
    
    border: 3px solid #6c757d;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    justify-content: space-between; /* Pushes header to top, footer to bottom */
}

.sub-canvas-header, .sub-canvas-footer {
    pointer-events: all; /* BUT the header and footer ARE clickable */
}

/* The title bar of the window */
.sub-canvas-header {
    background-color: #343a40;
    color: white;
    padding: 10px 20px;
    border-top-left-radius: 11px;
    border-top-right-radius: 11px;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
}

/* The footer bar of the window */
.sub-canvas-footer {
    background-color: #f8f9fa;
    padding: 12px 20px;
    border-bottom-left-radius: 11px;
    border-bottom-right-radius: 11px;
    border-top: 1px solid #dee2e6;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 15px;
}

.btn-save, .btn-close {
    padding: 9px 18px;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.btn-save {
    background-color: #007bff;
    color: white;
}
.btn-save:hover {
    background-color: #0069d9;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.btn-close {
    background-color: #28a745;
    color: white;
}
.btn-close:hover {
    background-color: #218838;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

/* A calm fade transition for the window appearing/disappearing */
.sub-canvas-fade-enter-active,
.sub-canvas-fade-leave-active {
  transition: opacity 0.3s ease;
}
.sub-canvas-fade-enter-from,
.sub-canvas-fade-leave-to {
  opacity: 0;
}
</style>
