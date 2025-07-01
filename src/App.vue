<script setup>
import { ref, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { VueFlow, useVueFlow, applyEdgeChanges } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

import InstructionPanel from './components/InstructionPanel.vue';
import Toolbar from './components/Toolbar.vue';
import CustomEdge from './components/CustomEdge.vue';
import SubCanvas from './components/SubCanvas.vue';

// Asynchronously load node components for better performance
const CustomNode = defineAsyncComponent(() => import('./components/CustomNode.vue'));
const RunNode = defineAsyncComponent(() => import('./components/RunNode.vue'));


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

// State for adding new nodes
const isAddingNode = ref(false);
const isAddingRunNode = ref(false);

// State for node appearance and behavior
const newNodeColor = ref('#34495e');
const runningNodeId = ref(null); // This will hold the ID of the node that is currently "running"

const vueFlowRef = ref(null);

// --- Event Handlers ---

function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
    node.data.title = event.data.title;
    node.data.content = event.data.content;
  }
}

// Helper function to find all successors of a node and their levels
function findSuccessors(startNodeId, allNodes, allEdges) {
  console.log('%c[Debug] Starting successor search for node:', 'color: blue; font-weight: bold;', startNodeId);

  let successors = [];
  let directSuccessors = new Map();

  // First, find all direct successors (nodes at level 1)
  allEdges.forEach(edge => {
    if (edge.source === startNodeId) {
      if (!directSuccessors.has(edge.target)) {
        const directNode = allNodes.find(n => n.id === edge.target);
        if (directNode) {
          directSuccessors.set(edge.target, { node: directNode, level: 1 });
        }
      }
    }
  });

  console.log('%c[Debug] Found direct successors:', 'color: blue;', Array.from(directSuccessors.keys()));

  // Process each direct successor path individually
  for (let [directSuccessorId, { node, level }] of directSuccessors) {
    let queue = [{ nodeId: directSuccessorId, level: level }];
    // Use a Set to track visited nodes for the current path to handle complex graphs/cycles
    let visitedInPath = new Set([startNodeId]);

    while (queue.length > 0) {
      const { nodeId: currentId, level: currentLevel } = queue.shift();
      
      if (visitedInPath.has(currentId)) continue;
      visitedInPath.add(currentId);
      
      const currentNode = allNodes.find(n => n.id === currentId);
      if (currentNode) {
        const content = currentNode.data.content || '';
        
        const placeholderTexts = ['Click to edit...', 'Ready to run...', ''];
        if (content && !placeholderTexts.includes(content.trim())) {
            successors.push({
              level: currentLevel,
              content: content
            });
        }

        const outgoingEdges = allEdges.filter(edge => edge.source === currentId);
        for (const edge of outgoingEdges) {
          queue.push({ nodeId: edge.target, level: currentLevel + 1 });
        }
      }
    }
  }
  
  const uniqueSuccessors = Array.from(new Map(successors.map(s => [s.content, s])).values())
                                .sort((a, b) => a.level - b.level);
  
  console.log('%c[Debug] Final successors list to be sent:', 'color: green; font-weight: bold;', uniqueSuccessors);
  return uniqueSuccessors;
}



// Handles the 'run' event from RunNode, now with logic to find successors
async function handleNodeRun(nodeId) {
    const node = findNode(nodeId);
    if (!node || runningNodeId.value) return; // Prevent multiple runs at once

    runningNodeId.value = nodeId; // Set the current node as running to show the spinner
    node.data.content = 'Running...'; // Provide immediate feedback

    const successors = findSuccessors(nodeId, getNodes.value, edges.value);

    try {
        const url = "http://127.0.0.1:7001/single-node-regen";
        const payload = {
            design_background: instructionPanels.value[1].content,
            design_goal: instructionPanels.value[2].content,
            node_title: node.data.title,
            successors: successors,
        };

        console.log('%c[Debug] Payload to be sent to backend:', 'color: orange; font-weight: bold;', payload);

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
        console.log('%c[Debug] Received response from backend:', 'color: green;', data);
        
        node.data.content = data.content; 
    } catch (error) {
        console.error("Error during run request:", error);
        node.data.content = "Error: " + error.message;
    } finally {
        runningNodeId.value = null; // Reset the running state to hide the spinner
    }
}


// --- "Add Node" Logic ---

function placeNodeOnClick(event) {
    const isRunNode = isAddingRunNode.value;
  if ((!isAddingNode.value && !isRunNode) || event.target.closest('.vue-flow__controls')) {
    return;
  }

  const ghostNode = findNode('ghost-node');
  if (!ghostNode) return;

  const newNode = {
    id: `node-${nodeIdCounter++}`,
    type: isRunNode ? 'run' : 'custom',
    position: { ...ghostNode.position },
    data: {
      title: isRunNode ? 'Run Node' : 'New Node',
      content: isRunNode ? 'Ready to run...' : 'Click to edit...',
      // MODIFIED: Add instruction and problem fields to the data model for persistence
      instruction: '',
      problem: '',
      color: isRunNode ? '#f1c40f' : newNodeColor.value,
      connections: { in: [], out: [] },
      subGraph: { nodes: [], edges: [] },
    },
  };
  addNodes([newNode]);

  if (isRunNode) {
      toggleAddRunNodeMode();
  } else {
      toggleAddNodeMode();
  }
}

function toggleAddNodeMode() {
  if (isAddingRunNode.value) isAddingRunNode.value = false;
  isAddingNode.value = !isAddingNode.value;
  updateEventListeners();
}

function toggleAddRunNodeMode() {
    if (isAddingNode.value) isAddingNode.value = false;
    isAddingRunNode.value = !isAddingRunNode.value;
    updateEventListeners();
}

function updateEventListeners() {
    const flowElement = vueFlowRef.value?.$el;
    if (!flowElement) return;

    flowElement.removeEventListener('click', placeNodeOnClick, true);
    if (isAddingNode.value || isAddingRunNode.value) {
        flowElement.addEventListener('click', placeNodeOnClick, true);
    } else {
        removeNodes(['ghost-node']);
    }
}

onPaneMouseMove((event) => {
  if (!isAddingNode.value && !isAddingRunNode.value) return;

  const position = project({ x: event.clientX, y: event.clientY });
  const ghostNode = findNode('ghost-node');

  const isRunNode = isAddingRunNode.value;
  const ghostData = {
      title: isRunNode ? 'Run Node' : 'New Node',
      content: 'Click to place',
      color: isRunNode ? '#f1c40f' : newNodeColor.value
  };
  const ghostType = isRunNode ? 'run' : 'custom';

  if (ghostNode) {
    ghostNode.position = position;
    ghostNode.data = ghostData;
    ghostNode.type = ghostType;
  } else {
    addNodes([{
      id: 'ghost-node',
      type: ghostType,
      position,
      data: ghostData,
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


// --- Other Existing Functions (unchanged) ---

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
    console.log("Payload: ",payload)
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
      style: { 
      width: '200px', 
      height: '150px' 
    },
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
    console.log("Payload: ",payload)
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    const data = await response.json();
    console.log(data)
    if (data) { 
      node_chain_autogene(data); 
    }
  } catch (error) {
    console.error("Error during node chain request:", error);
  } finally {
    isGenerating.value = false;
  }
}

// MODIFIED: Pass the node's instruction and problem values to the sub-canvas
function handleOpenSubCanvas(nodeId) {
    const parentNode = findNode(nodeId);
    if (!parentNode) return;
    if (!parentNode.data.subGraph) { parentNode.data.subGraph = { nodes: [], edges: [] }; }
    
    activeSubCanvasData.value = {
        id: parentNode.id,
        name: parentNode.data.title || 'Sub-Canvas',
        parentNodeTitle: parentNode.data.title,
        parentNodeContent: parentNode.data.content,
        // Pass persisted instruction and problem values
        parentNodeInstruction: parentNode.data.instruction,
        parentNodeProblem: parentNode.data.problem,
        initialNodes: JSON.parse(JSON.stringify(parentNode.data.subGraph.nodes)),
        initialEdges: JSON.parse(JSON.stringify(parentNode.data.subGraph.edges))
    };
}

function handleCloseSubCanvas() { activeSubCanvasData.value = null; }

function handleSubCanvasUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) { 
        parentNode.data.subGraph = { 
            nodes: JSON.parse(JSON.stringify(event.nodes)), 
            edges: JSON.parse(JSON.stringify(event.edges)), 
        }; 
    }
}

// NEW: Handler to save instruction/problem data from sub-canvas back to the parent node
function handleSubCanvasDataUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) {
        parentNode.data.instruction = event.instruction;
        parentNode.data.problem = event.problem;
    }
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
          <CustomNode
            v-bind="props"
            @delete="onNodeDelete"
            @open-canvas="handleOpenSubCanvas"
            @update-node-data="handleNodeUpdate"
          />
        </template>
        
        <template #node-run="props">
          <RunNode
            v-bind="props"
            @delete="onNodeDelete"
            @open-canvas="handleOpenSubCanvas"
            @run-node="handleNodeRun"
            :is-running="props.id === runningNodeId"
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
          :is-adding-run-node="isAddingRunNode"
          v-model:newNodeColor="newNodeColor"
          @toggle-freeze="toggleFreeze"
          @toggle-add-node-mode="toggleAddNodeMode"
          @toggle-add-run-node-mode="toggleAddRunNodeMode"
        />
      </div>

      <!-- MODIFIED: Bind new props and event handler for data persistence -->
      <SubCanvas
        v-if="activeSubCanvasData"
        :node-id="activeSubCanvasData.id"
        :node-name="activeSubCanvasData.name"
        :parent-node-title="activeSubCanvasData.parentNodeTitle"
        :parent-node-content="activeSubCanvasData.parentNodeContent"
        :parent-node-instruction="activeSubCanvasData.parentNodeInstruction"
        :parent-node-problem="activeSubCanvasData.parentNodeProblem"
        :initial-nodes="activeSubCanvasData.initialNodes"
        :initial-edges="activeSubCanvasData.initialEdges"
        @close="handleCloseSubCanvas"
        @update:graph="handleSubCanvasUpdate"
        @update:data="handleSubCanvasDataUpdate"
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
