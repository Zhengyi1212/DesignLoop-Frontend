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
const { onConnect, addEdges, removeNodes, getNode } = useVueFlow();
const { onDragOver, onDrop: originalOnDrop } = useDragAndDrop();

// These refs hold the data for the *currently visible* canvas.
// Their content will be swapped in and out.
const nodes = ref([]);
const edges = ref([]);

// This will hold the snapshot of the main canvas when we enter a sub-canvas.
const mainCanvasCache = ref(null);

// These refs track if we are in sub-canvas mode and which node we're editing.
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

    console.log(`Entering sub-canvas for node: ${nodeId}`);

    // 1. Create a deep-copy snapshot of the main canvas.
    mainCanvasCache.value = {
        nodes: JSON.parse(JSON.stringify(nodes.value)),
        edges: JSON.parse(JSON.stringify(edges.value)),
    };

    // 2. Set the active state for the UI overlay.
    activeSubCanvasNodeId.value = nodeId;
    activeSubCanvasNodeName.value = parentNode.data.title || 'Sub-Canvas';

    // 3. Ensure the sub-graph data structure exists on the parent node.
    if (!parentNode.data.subGraph) {
        parentNode.data.subGraph = { nodes: [], edges: [] };
    }
    
    // 4. Load the sub-graph data into the main VueFlow component.
    // We get this data from the *cached* parent node to work with a stable copy.
    const cachedParentNode = mainCanvasCache.value.nodes.find(n => n.id === nodeId);
    nodes.value = cachedParentNode.data.subGraph.nodes;
    edges.value = cachedParentNode.data.subGraph.edges;
}

/**
 * Closes the sub-canvas view, saving its state and restoring the main canvas.
 */
function handleCloseSubCanvas() {
    if (!activeSubCanvasNodeId.value || !mainCanvasCache.value) return;

    console.log(`Closing sub-canvas for node: ${activeSubCanvasNodeId.value}`);

    // 1. Find the parent node within the cached main canvas.
    const parentNode = mainCanvasCache.value.nodes.find(n => n.id === activeSubCanvasNodeId.value);
    
    if (parentNode) {
      // 2. Save the current canvas state (the sub-graph) back into the parent node's data.
      parentNode.data.subGraph = {
          nodes: JSON.parse(JSON.stringify(nodes.value)),
          edges: JSON.parse(JSON.stringify(edges.value)),
      };
    }

    // 3. Restore the main canvas from the snapshot.
    nodes.value = mainCanvasCache.value.nodes;
    edges.value = mainCanvasCache.value.edges;
    
    // 4. Reset the state to exit sub-canvas mode.
    activeSubCanvasNodeId.value = null;
    activeSubCanvasNodeName.value = '';
    mainCanvasCache.value = null;
}

// --- Event Handlers that are Context-Aware ---

/**
 * Handles dropping a new node. The logic differs depending on
 * whether we are on the main canvas or in a sub-canvas.
 */
function onDrop(event) {
    // When we are on the main canvas...
    if (!activeSubCanvasNodeId.value) {
        // ...we create a node and initialize its `subGraph` property.
        originalOnDrop(event, (newNode) => {
            newNode.data.subGraph = { nodes: [], edges: [] };
        });
    } else {
        // When in a sub-canvas, we just create a standard node.
        originalOnDrop(event);
    }
}

/**
 * Deletes a node from whichever canvas (main or sub) is currently active.
 */
function onNodeDelete(nodeId) {
  removeNodes([nodeId]);
  // Note: If you delete a parent node on the main canvas,
  // its sub-graph data is automatically deleted with it, which is correct.
}

/**
 * Toggles the freeze state on whichever canvas is currently active.
 */
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
// (other functions like handleFetchObjective, handlePanelUpdate remain the same)
</script>

<template>
  <div class="app-container">
    <InstructionPanel 
      :panels="instructionPanels" 
      :is-loading="isLoading"
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

      <div v-if="activeSubCanvasNodeId" class="sub-canvas-ui-overlay">
        <div class="sub-canvas-controls">
            <h3>Editing Sub-Canvas for: <span>{{ activeSubCanvasNodeName }}</span></h3>
            <button @click="handleCloseSubCanvas" class="btn-save-close">Save & Close</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* Global styles remain the same */
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/theme-default.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css';

:root {
  --app-bg: #f3f4f6;
  --panel-width: 250px;
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
  flex-grow: 1; height: 100%; width: 100%;
}

/* NEW STYLES for the sub-canvas UI overlay */
.sub-canvas-ui-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    /* A very subtle pointer-events setting to let drop events pass through to the canvas */
    pointer-events: none; 
    z-index: 20; /* Above the canvas but below modals */
    padding: 20px;
}
.sub-canvas-controls {
    pointer-events: all; /* Allow clicking on the control box */
    display: inline-flex;
    align-items: center;
    gap: 20px;
    background-color: rgba(255, 255, 255, 0.95);
    padding: 10px 20px;
    border-radius: 10px;
    border: 1px solid #ccc;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.sub-canvas-controls h3 {
    margin: 0;
    font-size: 16px;
    color: #333;
}
.sub-canvas-controls h3 span {
    color: #007bff;
    font-weight: bold;
}
.btn-save-close {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background-color: #28a745;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
}
.btn-save-close:hover {
    background-color: #218838;
}
</style>