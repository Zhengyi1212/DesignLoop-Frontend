<script setup>
import { ref, onBeforeUnmount, defineAsyncComponent, onMounted, onUnmounted, computed } from 'vue';
import { VueFlow, useVueFlow, applyEdgeChanges } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

import InstructionPanel from './components/InstructionPanel.vue';
import Toolbar from './components/Toolbar.vue';
import CustomEdge from './components/CustomEdge.vue';
import SubCanvas from './components/SubCanvas.vue';
import CanvasNodePanel from './components/CanvasNodePanel.vue';

const CustomNode = defineAsyncComponent(() => import('./components/CustomNode.vue'));
const RunNode = defineAsyncComponent(() => import('./components/RunNode.vue'));

let nodeIdCounter = 0;
let snapshotIdCounter = 0;

const { addNodes, addEdges, removeEdges, findNode, removeNodes, project, onPaneMouseMove, getNodes, getSelectedNodes } = useVueFlow();

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
const isAddingRunNode = ref(false);
const isShowingRunNode = ref(true);
const newNodeColor = ref('#34495e');
const runningNodeId = ref(null);
const vueFlowRef = ref(null);
const snapshots = ref([]);

// --- NEW: Right Panel Resizing and Collapsing Logic ---

const DEFAULT_PANEL_WIDTH = 200; // 默认宽度
const MIN_PANEL_WIDTH = 40; // 面板被视为“折叠”的最小宽度

const rightPanelWidth = ref(DEFAULT_PANEL_WIDTH);
const isResizing = ref(false);


const isRightPanelCollapsed = computed(() => rightPanelWidth.value <= MIN_PANEL_WIDTH);

// drag --> snpt window
function startResize(event) {
  event.preventDefault();
  isResizing.value = true;
  // 在 window 上添加事件监听器，以便在页面任何地方拖动
  window.addEventListener('mousemove', doResize);
  window.addEventListener('mouseup', stopResize);
}


function doResize(event) {
  if (!isResizing.value) return;
  // 根据鼠标位置计算新的面板宽度
  const newWidth = window.innerWidth - event.clientX;
  // 限制最大和最小宽度
  if (newWidth > MIN_PANEL_WIDTH && newWidth < 600) {
    rightPanelWidth.value = newWidth;
  }
}

// 停止拖拽的函数
function stopResize() {
  isResizing.value = false;
  window.removeEventListener('mousemove', doResize);
  window.removeEventListener('mouseup', stopResize);
  // 如果宽度小于最小阈值，则自动折叠
  if (rightPanelWidth.value < MIN_PANEL_WIDTH) {
    rightPanelWidth.value = 0;
  }
}

// 切换面板展开/折叠状态的函数
function toggleRightPanel() {
  if (isRightPanelCollapsed.value) {
   
    rightPanelWidth.value = DEFAULT_PANEL_WIDTH;
  } else {
   
    rightPanelWidth.value = 0;
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', doResize);
  window.removeEventListener('mouseup', stopResize);
});


// --- Snapshot Handling Logic (Unchanged) ---

function handleSaveSnapshot(snapshotPayload) {
  const newSnapshot = {
    id: `${snapshotIdCounter++}`,
    goal: snapshotPayload.data.goal,
    data: snapshotPayload.data
  };
  console.log("Goal: ", snapshotPayload.data.goal)
  snapshots.value.push(newSnapshot);
  console.log('Snapshot saved in main-canvas:', newSnapshot);
}

function handleApplySnapshot({ nodeId, snapshotData }) {
  const targetNode = findNode(nodeId);
  if (!targetNode) {
    console.error(`Could not find target node with ID: ${nodeId}`);
    return;
  }
  const dataToApply = snapshotData.data;
  console.log(snapshotData.data.goal)
  const newSubGraph = JSON.parse(JSON.stringify(dataToApply.subGraph));
  targetNode.data.instruction = dataToApply.instruction;
  targetNode.data.goal = dataToApply.goal;
  targetNode.data.subGraph = newSubGraph;
  targetNode.data.title = targetNode.data.title;
  targetNode.data.content = targetNode.data.content;
}


// --- Existing Logic (Unchanged) ---
function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
    node.data.title = event.data.title;
    node.data.content = event.data.content;
  }
}
async function handleNodeRun(nodeId) {
    const node = findNode(nodeId);
    if (!node || runningNodeId.value) return;
    runningNodeId.value = nodeId;
    node.data.content = 'Running...';
    const successors = findSuccessors(nodeId, getNodes.value, edges.value);
    try {
        const url = "http://127.0.0.1:7001/brainstorm";
        const payload = {
            design_background: instructionPanels.value[1].content,
            design_goal: instructionPanels.value[2].content,
            node_title: node.data.title,
            successors: successors,
        };
        console.log("Su:", successors)
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
        node.data.content = data.content; 
    } catch (error) {
        console.error("Error during run request:", error);
        node.data.content = "Error: " + error.message;
    } finally {
        runningNodeId.value = null;
    }
}
function findSuccessors(startNodeId, allNodes, allEdges) {
  let successors = [];
  let directSuccessors = new Map();
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
  for (let [directSuccessorId, { node, level }] of directSuccessors) {
    let queue = [{ nodeId: directSuccessorId, level: level }];
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
  return Array.from(new Map(successors.map(s => [s.content, s])).values()).sort((a, b) => a.level - b.level);
}
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
      instruction: '',
      goal: '',
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
function handleDuplicateNode() {
  const selectedNodes = getSelectedNodes.value;
  if (selectedNodes.length !== 1) return; 
  const originalNode = selectedNodes[0];
  if (originalNode.id === 'ghost-node') return;
  const newNode = {
    id: `node-${nodeIdCounter++}`,
    type: originalNode.type,
    position: {
      x: originalNode.position.x + 40,
      y: originalNode.position.y + 40,
    },
    data: { ...JSON.parse(JSON.stringify(originalNode.data)), connections: { in: [], out: [] } },
  };
  addNodes([newNode]);
}
function handleKeyDown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleDuplicateNode();
  }
}
onMounted(() => { window.addEventListener('keydown', handleKeyDown); });
onUnmounted(() => { window.removeEventListener('keydown', handleKeyDown); });
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
    console.log("Sending payload to /pipeline:", payload);
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
    console.log("Received raw pipeline data:", data.pipeline);

    if (Array.isArray(data.pipeline)) {
      // 2. Join the array elements with a newline character ('\n')
      instructionPanels.value[3].content = data.pipeline.join('\n');
    } else {
      // Fallback for safety, in case the data is not an array
      instructionPanels.value[3].content = String(data.pipeline);
    }

  } catch (error) {
    console.error("Error during pipeline request:", error);
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
      style: { width: '200px', height: '150px' },
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
    console.log("Payload:",payload)
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
    }
    const data = await response.json();
    console.log("Generation data:",data)
    if (data) { node_chain_autogene(data); }
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
    activeSubCanvasData.value = {
        id: parentNode.id,
        name: parentNode.data.title || 'Sub-Canvas',
        parentNodeTitle: parentNode.data.title,
        parentNodeContent: parentNode.data.content,
        parentNodeInstruction: parentNode.data.instruction,
        parentNodeGoal: parentNode.data.goal,
        designBackgroud : instructionPanels.value[1].content,
        designGoal: instructionPanels.value[2].content,
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
function handleSubCanvasDataUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) {
        parentNode.data.instruction = event.instruction;
        parentNode.data.goal = event.goal;
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
  <div class="app-container" :class="{ 'is-resizing': isResizing }">
    <!-- Left Panel -->
    
      <InstructionPanel
        :panels="instructionPanels"
        :is-generating="isGenerating"
        :is-fetching-pipeline="isFetchingPipeline"
        @update-panel-content="(event) => instructionPanels[event.index].content = event.content"
        @generate="handleGeneration"
        @fetch-pipeline="handleFetchPipeline"
      />
   

    <!-- Main Content Area -->
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
            @snapshot-dropped="handleApplySnapshot"
          />
        </template>
        
        <template #node-run="props">
          <RunNode
            v-bind="props"
            @delete="onNodeDelete"
            @open-canvas="handleOpenSubCanvas"
            @run-node="handleNodeRun"
            @update-node-data="handleNodeUpdate"
            :is-running="props.id === runningNodeId"
            @snapshot-dropped="handleApplySnapshot"
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
          :is-show="isShowingRunNode"
          @toggle-freeze="toggleFreeze"
          @toggle-add-node-mode="toggleAddNodeMode"
          @toggle-add-run-node-mode="toggleAddRunNodeMode"
        />
      </div>

      <SubCanvas
        v-if="activeSubCanvasData"
        :node-id="activeSubCanvasData.id"
        :node-name="activeSubCanvasData.name"
        @save-snapshot="handleSaveSnapshot"
        v-bind="activeSubCanvasData"
        @close="handleCloseSubCanvas"
        @update:graph="handleSubCanvasUpdate"
        @update:data="handleSubCanvasDataUpdate"
      />
    </main>

    <!-- Right Resizable Panel -->
    <div 
      class="right-panel" 
      :style="{ width: rightPanelWidth + 'px' }" 
      :class="{ 'is-collapsed': isRightPanelCollapsed }"
    >
      <div class="resizer" @mousedown="startResize" title="拖动来调整大小"></div>
      
      <button class="expand-btn" v-if="isRightPanelCollapsed" @click="toggleRightPanel" title="展开面板">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>

      <CanvasNodePanel v-if="!isRightPanelCollapsed" :snapshots="snapshots" />
    </div>
  </div>
</template>

<style>
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/theme-default.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css';
@import '@vue-flow/node-resizer/dist/style.css';

:root {
  --app-bg: #f3f4f6;
  --left-panel-width: 300px;
  --border-color: #e0e0e0;
}
body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'JetBrains Mono', 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--app-bg);
  overflow: hidden;
  /* 阻止在拖拽时选中文本 */
  user-select: none;
}
.app-container.is-resizing {
  cursor: col-resize;
}
.app-container {
  display: flex;
  height: 100vh;
}

/* Left Panel */
.left-panel {
  width: var(--left-panel-width);
  flex-shrink: 0;
  height: 100vh;
  border-right: 1px solid var(--border-color);
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

/* Main Content */
.main-content {
  flex-grow: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}
.flow-canvas {
  flex-grow: 1;
  height: 100%;
  width: 100%;
}
.vue-flow__node.ghost-node {
  opacity: 0.6;
  border-style: dashed;
  cursor: grabbing;
  pointer-events: none;
}
.main-toolbar-wrapper {
  position: absolute;
  bottom: 0px;
  left: 49.5%;
  border-radius: 25px;
  width: 700px;
  transform: translateX(-50%);
  z-index: 10;
}

.main-toolbar-wrapper :deep(.toolbar-container) {
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* Right Resizable Panel */
.right-panel {
  position: relative;
  flex-shrink: 0;
  height: 100vh;
  background-color: #ffffff;
  border-left: 1px solid var(--border-color);
  transition: width 0.2s ease-in-out;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 隐藏面板内部溢出的内容 */
}
.right-panel.is-collapsed {
  border-left: 1px solid transparent;
}

.resizer {
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 20;
  background-color: transparent;
  transition: background-color 0.2s;
}
.resizer:hover {
  background-color: #007bff;
}

.expand-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  transition: all 0.2s ease;
}
.expand-btn:hover {
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 123, 255, 0.5);
}
</style>
