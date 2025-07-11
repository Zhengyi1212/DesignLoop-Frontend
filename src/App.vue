<script setup>
import { ref, onBeforeUnmount, defineAsyncComponent, onMounted, onUnmounted, computed, watch,nextTick } from 'vue';
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
let pipelineCounter = 0;
let pipelineOffset  = 200;
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

// --- NEW: Session Management State ---
const isSessionExpired = ref(false);
const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// In App.vue

function saveState() {
  try {
    // 必须保留这个过滤器，以防止在 nextTick 执行前，幽灵节点被保存
    const nodesToSave = nodes.value.filter(node => node.id !== 'ghost-node');

    const state = {
      nodes: nodesToSave,
      edges: edges.value,
      instructionPanels: instructionPanels.value,
      snapshots: snapshots.value,
      nodeIdCounter: nodeIdCounter,
      snapshotIdCounter: snapshotIdCounter,
    };
    sessionStorage.setItem('appState', JSON.stringify(state));
    sessionStorage.setItem('sessionTimestamp', new Date().getTime().toString());
  } catch (e) {
    console.error("Failed to save state to sessionStorage:", e);
  }
}
/**
 * Loads the application state from sessionStorage.
 */
function loadState() {
  const savedState = sessionStorage.getItem('appState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      nodes.value = state.nodes || [];
      edges.value = state.edges || [];
      instructionPanels.value = state.instructionPanels || instructionPanels.value;
      snapshots.value = state.snapshots || [];
      nodeIdCounter = state.nodeIdCounter || 0;
      snapshotIdCounter = state.snapshotIdCounter || 0;
      console.log("Application state loaded from sessionStorage.");
    } catch (e) {
      console.error("Failed to parse state from sessionStorage:", e);
      sessionStorage.removeItem('appState'); // Clear corrupted data
    }
  }
}

/**
 * Checks the session timestamp. If it's expired, it clears the state
 * and shows an expiration overlay. Otherwise, it loads the state.
 */
function manageSession() {
  const lastActivity = sessionStorage.getItem('sessionTimestamp');
  if (lastActivity) {
    const now = new Date().getTime();
    if (now - parseInt(lastActivity, 10) > SESSION_DURATION) {
      // Session has expired
      isSessionExpired.value = true;
      sessionStorage.removeItem('appState');
      sessionStorage.removeItem('sessionTimestamp');
      console.warn("Session expired. State has been cleared.");
    } else {
      // Session is active, load the state
      loadState();
    }
  }
}

function clearAllStateAndExit() {
  // Clear all reactive state
  nodes.value = [];
  edges.value = [];
  instructionPanels.value.forEach(panel => panel.content = '');
  snapshots.value = [];
  
  // Clear counters
  nodeIdCounter = 0;
  snapshotIdCounter = 0;

  // Clear sessionStorage and reload for a completely fresh start
  sessionStorage.clear();
  location.reload();
}


function startNewSession() {
    isSessionExpired.value = false;
    location.reload();
}

// Watch for any changes in the state and save them to sessionStorage
watch([nodes, edges, instructionPanels, snapshots], saveState, { deep: true });


// --- Right Panel Resizing and Collapsing Logic (Unchanged) ---

const DEFAULT_PANEL_WIDTH = 200;
const MIN_PANEL_WIDTH = 40; 

const rightPanelWidth = ref(DEFAULT_PANEL_WIDTH);
const isResizing = ref(false);


const isRightPanelCollapsed = computed(() => rightPanelWidth.value <= MIN_PANEL_WIDTH);

function startResize(event) {
  event.preventDefault();
  isResizing.value = true;
  window.addEventListener('mousemove', doResize);
  window.addEventListener('mouseup', stopResize);
}


function doResize(event) {
  if (!isResizing.value) return;
  const newWidth = window.innerWidth - event.clientX;
  if (newWidth > MIN_PANEL_WIDTH && newWidth < 600) {
    rightPanelWidth.value = newWidth;
  }
}

function stopResize() {
  isResizing.value = false;
  window.removeEventListener('mousemove', doResize);
  window.removeEventListener('mouseup', stopResize);
  if (rightPanelWidth.value < MIN_PANEL_WIDTH) {
    rightPanelWidth.value = 0;
  }
}

function toggleRightPanel() {
  if (isRightPanelCollapsed.value) {
   
    rightPanelWidth.value = DEFAULT_PANEL_WIDTH;
  } else {
   
    rightPanelWidth.value = 0;
  }
}

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
  console.log(dataToApply.id)
  console.log(snapshotData.data.goal)
  console.log(snapshotData.data.instruction)
  targetNode.data.appliedSnapshotId = snapshotData.id
  const newSubGraph = JSON.parse(JSON.stringify(dataToApply.subGraph));
  targetNode.data.instruction = dataToApply.instruction;
  targetNode.data.goal = dataToApply.goal;
  targetNode.data.subGraph = newSubGraph;
  targetNode.data.title = targetNode.data.title;
  targetNode.data.content = targetNode.data.content;
  targetNode.data.chain = dataToApply.chain
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
    
    const successors = findPredecessors(nodeId, nodes.value, edges.value);
    
    try {
        const url = "/api/brainstorm";
        const payload = {
            design_background: instructionPanels.value[1].content,
            design_goal: instructionPanels.value[2].content,
            node_title: node.data.title,
            successors: successors,
        };
        
        console.log("Passing Successors to backend:", successors);

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

function findPredecessors(startNodeId, allNodes, allEdges) {
  const successors = [];
  const queue = [];
  const visited = new Set([startNodeId]);

  allEdges.forEach(edge => {
    if (edge.target === startNodeId) {
      if (!visited.has(edge.source)) {
        queue.push({ nodeId: edge.source, level: 1 });
        visited.add(edge.source);
      }
    }
  });

  while (queue.length > 0) {
    const { nodeId: currentId, level: currentLevel } = queue.shift();
    const currentNode = allNodes.find(n => n.id === currentId);

    if (currentNode) {
      const content = currentNode.data.content || '';
      const title = currentNode.data.title || '';
      const placeholderTexts = ['Click to edit...', 'Ready to run...', ''];

      if (content && !placeholderTexts.includes(content.trim())) {
        successors.push({
          level: currentLevel,
          title: title,
          content: content
        });
      }

      const outgoingEdges = allEdges.filter(edge => edge.target === currentId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.source)) {
          visited.add(edge.source);
          queue.push({ nodeId: edge.source, level: currentLevel + 1 });
        }
      }
    }
  }

  return successors.sort((a, b) => a.level - b.level);
}
// 在 App.vue 的 <script setup> 区域，确保 nextTick 已经被引入
// import { ref, onBeforeUnmount, ..., nextTick } from 'vue';

function placeNodeOnClick(event) {
    const isRunNode = isAddingRunNode.value;
    if ((!isAddingNode.value && !isRunNode) || event.target.closest('.vue-flow__controls')) {
        return;
    }
    const ghostNode = findNode('ghost-node');
    if (!ghostNode) return;

    // 1. 准备新节点的数据
    const newNode = {
        id: `node-${nodeIdCounter++}`,
        type: isRunNode ? 'run' : 'custom',
        position: { ...ghostNode.position },
        data: {
            title: isRunNode ? '' : '',
            content: isRunNode ? '' : '',
            instruction: '',
            goal: '',
            color: isRunNode ? '#f1c40f' : newNodeColor.value,
            connections: { in: [], out: [] },
            subGraph: { nodes: [], edges: [] },
        },
    };

    // 2. 使用库的函数添加新节点
    addNodes([newNode]);

    // 3. 使用 nextTick 来延迟执行清理工作
    // 这可以确保在执行后续操作之前，Vue 已经完成了添加新节点的状态更新
    nextTick(() => {
        // 现在可以安全地退出“添加模式”，这会自动移除幽灵节点
        if (isRunNode) {
            toggleAddRunNodeMode();
        } else {
            toggleAddNodeMode();
        }
    });
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
  if (activeSubCanvasData.value) {
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleDuplicateNode();
  }
}

// --- MODIFIED: onMounted Lifecycle Hook ---
onMounted(() => { 
  manageSession(); // Manage session and load state on initial load
  window.addEventListener('keydown', handleKeyDown); 
});

onUnmounted(() => { 
  window.removeEventListener('keydown', handleKeyDown); 
  window.removeEventListener('mousemove', doResize);
  window.removeEventListener('mouseup', stopResize);
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
  const newEdge = { 
    ...connection, 
    id: newEdgeId, 
    type: 'custom', 
    interactionWidth: 30, 
    selectable: true,
    // 新增 data 对象，设置默认动画状态
    data: { animated: true, pathType: 'bezier' } 
  };
  if (!sourceNode.data.connections.out) sourceNode.data.connections.out = [];
  sourceNode.data.connections.out.push({ edgeId: newEdge.id, targetId: connection.target, sourceHandle: connection.sourceHandle });
  if (!targetNode.data.connections.in) targetNode.data.connections.in = [];
  targetNode.data.connections.in.push({ edgeId: newEdge.id, sourceId: connection.source, targetHandle: connection.targetHandle });
  addEdges([newEdge]);
}
function handleContentChanged(sourceNodeId) {
  const edgeToUpdate = edges.value.find(edge => {
    if (edge.source !== sourceNodeId) return false;
    const targetNode = findNode(edge.target);
    return targetNode && targetNode.type === 'run';
  });

  if (edgeToUpdate) {
    // 如果 data 对象不存在，先创建它
    if (!edgeToUpdate.data) edgeToUpdate.data = {};
    edgeToUpdate.data.animated = false;
    console.log(`Edge ${edgeToUpdate.id} animation turned OFF.`);
  }
}

function handleRunTriggered(targetNodeId) {
  const edgeToUpdate = edges.value.find(edge => {
    if (edge.target !== targetNodeId) return false;
    const sourceNode = findNode(edge.source);
    return sourceNode && sourceNode.type === 'custom';
  });

  if (edgeToUpdate) {
    if (!edgeToUpdate.data) edgeToUpdate.data = {};
    edgeToUpdate.data.animated = true;
    console.log(`Edge ${edgeToUpdate.id} animation turned ON.`);
  }
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
    const url = "/api/pipeline";
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
      instructionPanels.value[3].content = data.pipeline.join('\n');
    } else {
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
  const startX = 100; const startY = 200 + pipelineOffset *pipelineCounter; const gapX = 250;
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
  pipelineCounter =  pipelineCounter+1;
  addNodes(newNodes); addEdges(newEdges);
}
async function handleGeneration() {
  isGenerating.value = true;
  try {
    const url = "/api/generate-node-chain";
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
        initialEdges: JSON.parse(JSON.stringify(parentNode.data.subGraph.edges)),
        initialChainList : parentNode.data.chain
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

function handleDeleteSnapshot(snapshotIdToDelete) {
  const index = snapshots.value.findIndex(s => s.id === snapshotIdToDelete);
  if (index !== -1) {
    snapshots.value.splice(index, 1);
    console.log(`Snapshot with ID: ${snapshotIdToDelete} has been deleted.`);
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
      <!-- NEW: Exit Button -->
      <button @click="clearAllStateAndExit" class="exit-button" title="清除所有内容并退出">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

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
        :min-zoom="0.1"
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
            @content-changed="handleContentChanged" 
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
            @run-triggered="handleRunTriggered"
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
        :min-zoom="0.2"
      />
    </main>

    <!-- Right Resizable Panel -->
    <div 
      class="right-panel" 
      :style="{ width: rightPanelWidth + 'px' }" 
      :class="{ 'is-collapsed': isRightPanelCollapsed }"
    >
      <div class="resizer" @mousedown="startResize" title="Drag to adjust the suze"></div>
      
      <button class="expand-btn" v-if="isRightPanelCollapsed" @click="toggleRightPanel" title="Expand">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>

      <CanvasNodePanel v-if="!isRightPanelCollapsed" 
      :snapshots="snapshots" 
       @delete-snapshot="handleDeleteSnapshot"/>
    </div>

    <!-- NEW: Session Expiration Overlay -->
    <div v-if="isSessionExpired" class="session-expired-overlay">
      <div class="session-expired-box">
        <h2>Session expired</h2>
        
        <button @click="startNewSession" class="restart-button">Start a new session</button>
      </div>
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
  left: 50%;
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
  overflow: hidden;
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

/* --- NEW STYLES for Exit Button and Session Overlay --- */
.exit-button {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 20; /* Ensure it's above controls but below sub-canvas */
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #343a40;
  transition: all 0.3s ease-in-out;
}
.exit-button:hover {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
  transform: rotate(90deg) scale(1.1);
}

.session-expired-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(5px);
}
.session-expired-box {
  background-color: white;
  padding: 30px 40px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  max-width: 420px;
  border: 1px solid #ddd;
}
.session-expired-box h2 {
  margin-top: 0;
  color: #c0392b;
  font-size: 24px;
}
.session-expired-box p {
  margin-bottom: 30px;
  color: #34495e;
  font-size: 16px;
  line-height: 1.6;
}
.restart-button {
  background-color: #27ae60;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
}
.restart-button:hover {
  background-color: #2ecc71;
  transform: translateY(-2px);
}
</style>
