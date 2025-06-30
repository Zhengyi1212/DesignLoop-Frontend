<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { VueFlow, useVueFlow, applyEdgeChanges } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

import InstructionPanel from './components/InstructionPanel.vue';
import Toolbar from './components/Toolbar.vue';
import CustomNode from './components/CustomNode.vue';
import CustomEdge from './components/CustomEdge.vue';
import SubCanvas from './components/SubCanvas.vue';

let nodeIdCounter = 0;

const { addNodes, addEdges, removeEdges, findNode, removeNodes, project, onPaneMouseMove, getNodes } = useVueFlow();

const nodes = ref([]);
const edges = ref([]);
const isFrozen = ref(false);
const activeSubCanvasData = ref(null);
const instructionPanels = ref([
  { title: 'User', content: '' }, { title: 'Design Background', content: '' },
  { title: 'Design Goal', content: '' }, { title: 'Pipeline', content: '' },
]);
const isGenerating = ref(false);
const isFetchingPipeline = ref(false);
const isAddingNode = ref(false);

const newNodeColor = ref('#34495e');

const vueFlowRef = ref(null);

// --- New Feature: Function to handle data updates from nodes ---
function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
    node.data.title = event.data.title;
    node.data.content = event.data.content;
  }
}

function placeNodeOnClick(event) {
  if (!isAddingNode.value || event.target.closest('.vue-flow__controls')) {
    return;
  }

  const ghostNode = findNode('ghost-node');
  if (!ghostNode) return;

  const newNode = {
    id: `node-${nodeIdCounter++}`,
    type: 'custom',
    position: { ...ghostNode.position },
    data: {
      title: '',
      content: '', // Updated placeholder text
      color: newNodeColor.value,
      connections: { in: [], out: [] },
      subGraph: { nodes: [], edges: [] },
    },
  };
  addNodes([newNode]);

  toggleAddNodeMode();
}

function toggleAddNodeMode() {
  isAddingNode.value = !isAddingNode.value;

  const flowElement = vueFlowRef.value?.$el;
  if (!flowElement) return;

  if (isAddingNode.value) {
    flowElement.addEventListener('click', placeNodeOnClick, true);
  } else {
    flowElement.removeEventListener('click', placeNodeOnClick, true);
    removeNodes(['ghost-node']);
  }
}

onPaneMouseMove((event) => {
  if (!isAddingNode.value) return;
  const position = project({ x: event.clientX, y: event.clientY });
  const ghostNode = findNode('ghost-node');
  if (ghostNode) {
    ghostNode.position = position;
    ghostNode.data.color = newNodeColor.value;
  } else {
    addNodes([{
      id: 'ghost-node',
      type: 'custom',
      position,
      data: {
        title: 'New Node',
        content: 'Click to place',
        color: newNodeColor.value
      },
      class: 'ghost-node',
    }]);
  }
});

onBeforeUnmount(() => {
  const flowElement = vueFlowRef.value?.$el;
  if (flowElement) {
    flowElement.removeEventListener('click', placeNodeOnClick, true);
  }
});

function isValidConnection(connection) { return connection.source !== connection.target; }

function onConnect(connection) {
  const sourceNode = findNode(connection.source);
  const targetNode = findNode(connection.target);
  if (!sourceNode || !targetNode) return;
  const newEdgeId = `edge--${connection.source}(${connection.sourceHandle})--${connection.target}(${connection.targetHandle})--${Date.now()}`;
  const newEdge = { ...connection, id: newEdgeId, type: 'custom', interactionWidth: 30, selectable: true };
  if (!sourceNode.data.connections.out) sourceNode.data.connections.out = [];
  sourceNode.data.connections.out.push({ edgeId: newEdge.id, targetId: connection.target, sourceHandle: connection.sourceHandle });
  if (!targetNode.data.connections.in) targetNode.data.connections.in = [];
  targetNode.data.connections.in.push({ edgeId: newEdge.id, sourceId: connection.source, targetHandle: connection.targetHandle });
  addEdges([newEdge]);
}

function removeConnectionData(edge) {
  if (!edge) return;
  const sourceNode = findNode(edge.source);
  if (sourceNode?.data.connections?.out) {
    const outIndex = sourceNode.data.connections.out.findIndex(c => c.edgeId === edge.id);
    if (outIndex !== -1) sourceNode.data.connections.out.splice(outIndex, 1);
  }
  const targetNode = findNode(edge.target);
  if (targetNode?.data.connections?.in) {
    const inIndex = targetNode.data.connections.in.findIndex(c => c.edgeId === edge.id);
    if (inIndex !== -1) targetNode.data.connections.in.splice(inIndex, 1);
  }
}

function onEdgeDelete(edgeId) {
  const edgeToRemove = edges.value.find(edge => edge.id === edgeId);
  removeConnectionData(edgeToRemove);
  removeEdges([edgeId]);
}

function onEdgesChange(changes) {
  const removedChanges = changes.filter(change => change.type === 'remove');
  removedChanges.forEach(removedChange => {
    const edgeToRemove = edges.value.find(edge => edge.id === removedChange.id);
    removeConnectionData(edgeToRemove);
  });
  edges.value = applyEdgeChanges(changes, edges.value);
}

function onNodeDelete(nodeIdToDelete) {
    const edgesToRemove = edges.value.filter(edge => edge.source === nodeIdToDelete || edge.target === nodeIdToDelete);
    edgesToRemove.forEach(edge => { removeConnectionData(edge); });
    removeEdges(edgesToRemove.map(edge => edge.id));
    removeNodes([nodeIdToDelete]);
}

async function handleFetchPipeline() {
  isFetchingPipeline.value = true;
  try {
    const url = "http://127.0.0.1:7001/pipeline";
    const payload = {
      user_id: instructionPanels.value[0].content,
      design_background: instructionPanels.value[1].content,
      design_goal: instructionPanels.value[2].content,
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    const data = await response.json();
    instructionPanels.value[3].content = data.pipeline;
  } catch (error) {
    console.error("Error during generation request:", error);
  } finally {
    isFetchingPipeline.value = false;
  }
}

function node_chain_autogene(nodeData) {
  if (!Array.isArray(nodeData) || nodeData.length === 0) return;
  const newNodes = []; const newEdges = [];
  const startX = 100; const startY = 200; const gapX = 250;
  nodeData.forEach((data, index) => {
    const newNode = {
      id: `chain-node-${nodeIdCounter++}`, type: 'custom',
      position: { x: startX + index * gapX, y: startY },
      data: {
        title: data.pipeline_title || 'Untitled Node', content: data.pipeline_content || '',
        color: newNodeColor.value,
        connections: { in: [], out: [] }, subGraph: { nodes: [], edges: [] },
      },
    };
    newNodes.push(newNode);
  });
  for (let i = 1; i < newNodes.length; i++) {
    const sourceNode = newNodes[i - 1]; const targetNode = newNodes[i];
    const newEdge = {
      id: `chain-edge-${sourceNode.id}-to-${targetNode.id}`, source: sourceNode.id, target: targetNode.id,
      sourceHandle: 'right', targetHandle: 'left', type: 'custom', selectable: true, interactionWidth: 30,
    };
    newEdges.push(newEdge);
    sourceNode.data.connections.out.push({ edgeId: newEdge.id, targetId: targetNode.id, sourceHandle: 'right' });
    targetNode.data.connections.in.push({ edgeId: newEdge.id, sourceId: sourceNode.id, targetHandle: 'left' });
  }
  addNodes(newNodes); addEdges(newEdges);
}

async function handleGeneration() {
  isGenerating.value = true;
  try {
    const url = "http://127.0.0.1:7001/generate-node-chain";
    const payload = {
      pipeline: instructionPanels.value[3].content,
      design_background: instructionPanels.value[1].content,
      design_goal:instructionPanels.value[2].content
    };
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    const data = await response.json();
    if (data && data.nodes) { node_chain_autogene(data.nodes); }
  } catch (error) {
    console.error("Error during node chain request:", error);
  } finally {
    isGenerating.value = false;
  }
}

function handleOpenSubCanvas(nodeId) {
    const parentNode = findNode(nodeId);
    if (!parentNode) return;
    if (!parentNode.data.subGraph) { parentNode.data.subGraph = { nodes: [], edges: [] }; }
    activeSubCanvasData.value = { id: parentNode.id, name: parentNode.data.title || 'Sub-Canvas', initialNodes: JSON.parse(JSON.stringify(parentNode.data.subGraph.nodes)), initialEdges: JSON.parse(JSON.stringify(parentNode.data.subGraph.edges)) };
}

function handleCloseSubCanvas() { activeSubCanvasData.value = null; }

function handleSubCanvasUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) { parentNode.data.subGraph = { nodes: JSON.parse(JSON.stringify(event.nodes)), edges: JSON.parse(JSON.stringify(event.edges)), }; }
}

function toggleFreeze() {
  isFrozen.value = !isFrozen.value;
  const isDraggable = !isFrozen.value;

  for (const node of getNodes.value) {
    if (node.id !== 'ghost-node') {
      node.draggable = isDraggable;
      node.selectable = isDraggable;
    }
  }
}
</script>

<template>
  <div class="app-container">
    <InstructionPanel
      :panels="instructionPanels"
      :is-generating="isGenerating"
      :is-fetching-pipeline="isFetchingPipeline"
      @update-panel-content="(event) => instructionPanels[event.index].content = event.content"
      @generate="handleGeneration"
      @fetch-pipeline="handleFetchPipeline"
    />

    <main class="main-content">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @edges-change="onEdgesChange"
        @connect="onConnect"
        :is-valid-connection="isValidConnection"
        class="flow-canvas"
        :fit-view-on-init="true"
        :delete-key-code="'Backspace'"
        ref="vueFlowRef"
      >
        <defs>
          <marker id="custom-arrow" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
            <path d="M -8 -6 L 8 0 L -8 6 Z" fill="#b1b1b7" />
          </marker>
          <marker id="custom-arrow-selected" viewBox="-10 -10 20 20" refX="0" refY="0" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
            <path d="M -8 -6 L 8 0 L -8 6 Z" fill="#6366F1" />
          </marker>
        </defs>

        <template #node-custom="props">
          <!-- Listen for the new event here -->
          <CustomNode
            v-bind="props"
            @delete="onNodeDelete"
            @open-canvas="handleOpenSubCanvas"
            @update-node-data="handleNodeUpdate"
          />
        </template>

        <template #edge-custom="props">
          <CustomEdge v-bind="props" @delete-edge="onEdgeDelete" />
        </template>

        <Background /> <MiniMap /> <Controls />
      </VueFlow>

      <div class="main-toolbar-wrapper">
        <Toolbar
          :is-frozen="isFrozen"
          :is-adding-node="isAddingNode"
          v-model:newNodeColor="newNodeColor"
          @toggle-freeze="toggleFreeze"
          @toggle-add-node-mode="toggleAddNodeMode"
        />
      </div>

      <SubCanvas
        v-if="activeSubCanvasData"
        :node-id="activeSubCanvasData.id" :node-name="activeSubCanvasData.name"
        :initial-nodes="activeSubCanvasData.initialNodes" :initial-edges="activeSubCanvasData.initialEdges"
        @close="handleCloseSubCanvas" @update:graph="handleSubCanvasUpdate"
      />
    </main>
  </div>
</template>

<style>
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/theme-default.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css';
@import '@vue-flow/node-resizer/dist/style.css';

:root { --app-bg: #f3f4f6; --panel-width: 250px; }
body, html { margin: 0; padding: 0; height: 100%; font-family: 'JetBrains Mono', 'Helvetica Neue', Arial, sans-serif; background-color: var(--app-bg); }
.app-container { display: flex; height: 100vh; }
.main-content { flex-grow: 1; position: relative; display: flex; flex-direction: column; }
.flow-canvas { flex-grow: 1; height: 100%; width: 100%; }

.vue-flow__node.ghost-node {
  opacity: 0.6;
  border-style: dashed;
  cursor: grabbing;
  pointer-events: none;
}

.main-toolbar-wrapper {
  position: fixed;
  bottom: 0;
  left: var(--panel-width);
  right: 0;
  z-index: 10;
}
</style>
