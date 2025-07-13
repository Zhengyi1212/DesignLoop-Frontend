<script setup>
import { ref, onBeforeUnmount, defineAsyncComponent, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { VueFlow, useVueFlow, applyEdgeChanges } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';

import InstructionPanel from './components/InstructionPanel.vue';
import Toolbar from './components/Toolbar.vue';
import CustomEdge from './components/CustomEdge.vue';
import SubCanvas from './components/SubCanvas.vue';
import CanvasNodePanel from './components/CanvasNodePanel.vue';
import SnapshotDetailModal  from './components/SnapshotDetailModal.vue';

// Component Definitions
const CustomNode = defineAsyncComponent(() => import('./components/CustomNode.vue'));
const RunNode = defineAsyncComponent(() => import('./components/RunNode.vue'));
const GroupNode = defineAsyncComponent(() => import('./components/GroupNode.vue'));
// 1. 导入新的 RatingNode 组件
const RatingNode = defineAsyncComponent(() => import('./components/RatingNode.vue'));


// State
let nodeIdCounter = 0;
let snapshotIdCounter = 0;
const pipelineCounter = ref(-1)
const pipelineOffset = 200;

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
const runningNodeId = ref(null);
const vueFlowRef = ref(null);
const snapshots = ref([]);
const newNodeColor = ref('#34495e');
const isDetailModalVisible = ref(false);
const selectedSnapshotForDetail = ref(null);
// Add Mode States
const isAddingNode = ref(false);
const isAddingRunNode = ref(false);
const isAddingGroup = ref(false);
const isShowingRunNode = ref(true);

// --- Session Management (Unchanged) ---
const isSessionExpired = ref(false);
const SESSION_DURATION = 20 * 60 * 1000;

function saveState() {
  try {
    const nodesToSave = nodes.value.filter(node => node.id !== 'ghost-node' && node.type !== 'rating');
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
    } catch (e) {
      console.error("Failed to parse state from sessionStorage:", e);
      sessionStorage.removeItem('appState');
    }
  }
}

function showSnapshotDetails(snapshot) {
  selectedSnapshotForDetail.value = snapshot;
  isDetailModalVisible.value = true;
}

function closeSnapshotDetails() {
  isDetailModalVisible.value = false;
}

// 2. 移除旧的 RatingPanel 逻辑 (activeRatingPanels 等)

// 3. 创建一个通用的函数来添加反馈节点
function addRatingNode({ position, type, context = {} }) {
  const id = `rating-${type}-${Date.now()}`;
  const newNode = {
    id,
    type: 'rating', // 使用新的节点类型
    position,
    data: { context }, // 传递上下文信息
    zIndex: 1000, // 确保反馈节点在最上层
    draggable: true, // 可以拖动
    selectable: false, // 通常不需要选中
  };
  addNodes([newNode]);
}

// 4. 创建处理反馈节点事件的方法
function handleRatingClose(nodeId) {
  removeNodes([nodeId]);
}

function handleRatingSubmit(payload) {
  // 在这里你可以将 payload 发送到后端
  console.log('Submitting rating to backend:', payload);
  // 提交后关闭节点
  removeNodes([payload.nodeId]);
}


function manageSession() {
  const lastActivity = sessionStorage.getItem('sessionTimestamp');
  if (lastActivity) {
    const now = new Date().getTime();
    if (now - parseInt(lastActivity, 10) > SESSION_DURATION) {
      isSessionExpired.value = true;
      sessionStorage.removeItem('appState');
      sessionStorage.removeItem('sessionTimestamp');
    } else {
      loadState();
    }
  }
}

function clearAllStateAndExit() {
  nodes.value = [];
  edges.value = [];
  instructionPanels.value.forEach(panel => panel.content = '');
  snapshots.value = [];
  nodeIdCounter = 0;
  snapshotIdCounter = 0;
  sessionStorage.clear();
  location.reload();
}

function startNewSession() {
    isSessionExpired.value = false;
    location.reload();
}

function ensureGroupAtBottom() {
  const sorted = [
    ...nodes.value.filter(n => n.type === 'group'),
    ...nodes.value.filter(n => n.type !== 'group'),
  ];

  const oldOrder = nodes.value.map(n => n.id).join(',');
  const newOrder = sorted.map(n => n.id).join(',');

  if (oldOrder !== newOrder) {
    nodes.value = sorted;
  }
}


watch(
  [nodes, edges, instructionPanels, snapshots],
  
    saveState,
  { deep: true }
);

// --- Right Panel Resizing (Unchanged) ---
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
}

function toggleRightPanel() {
  rightPanelWidth.value = isRightPanelCollapsed.value ? DEFAULT_PANEL_WIDTH : 0;
}

// --- Add Node Logic (Unchanged) ---
function setAddMode(mode) {
    isAddingNode.value = mode === 'node';
    isAddingRunNode.value = mode === 'run';
    isAddingGroup.value = mode === 'group';
    updateEventListeners();
}

function toggleAddNodeMode() { setAddMode(isAddingNode.value ? null : 'node'); }
function toggleAddRunNodeMode() { setAddMode(isAddingRunNode.value ? null : 'run'); }
function toggleAddGroupMode() { setAddMode(isAddingGroup.value ? null : 'group'); }

function updateEventListeners() {
    const flowElement = vueFlowRef.value?.$el;
    if (!flowElement) return;
    flowElement.removeEventListener('click', placeNodeOnClick, true);
    if (isAddingNode.value || isAddingRunNode.value || isAddingGroup.value) {
        flowElement.addEventListener('click', placeNodeOnClick, true);
    } else {
        removeNodes(['ghost-node']);
    }
}

onPaneMouseMove((event) => {
  if (!isAddingNode.value && !isAddingRunNode.value && !isAddingGroup.value) return;
  const position = project({ x: event.clientX, y: event.clientY });
  const ghostNode = findNode('ghost-node');
  let ghostType = 'custom'; let ghostData = {}; let ghostDimensions = {};

  if (isAddingRunNode.value) {
      ghostType = 'run';
      ghostData = { title: 'Edit instruction...', content: 'Click to place', color: '#f1c40f' };
  } else if (isAddingGroup.value) {
      ghostType = 'group';
      ghostData = { label: 'Group', color: newNodeColor.value };
      ghostDimensions = { width: 380, height: 260 };
  } else {
      ghostType = 'custom';
      ghostData = { title: 'New Node', content: 'Click to place', color: newNodeColor.value };
  }

  if (ghostNode) {
    ghostNode.position = position;
    ghostNode.data = ghostData;
    ghostNode.type = ghostType;
  } else {
    addNodes([{ id: 'ghost-node', type: ghostType, position, data: ghostData, class: 'ghost-node', ...ghostDimensions }]);
  }
});

function placeNodeOnClick(event) {
    if (event.target.closest('.vue-flow__controls')) return;
    const ghostNode = findNode('ghost-node');
    if (!ghostNode) return;

    let newNode = { id: `node-${nodeIdCounter++}`, position: { ...ghostNode.position }, data: { color: newNodeColor.value } };

    if (isAddingGroup.value) {
        newNode = { ...newNode, type: 'group', zIndex: 0, width: 400, height: 300, data: { ...newNode.data, label: 'My Group' } };
    } else if (isAddingRunNode.value) {
        newNode = { ...newNode, type: 'run', zIndex: 1, data: { ...newNode.data, title: 'Edit instruction...', content: 'Ready to run...', instruction: '', goal: '', connections: { in: [], out: [] }, subGraph: { nodes: [], edges: [] }, color: '#f1c40f' } };
    } else {
        newNode = { ...newNode, type: 'custom', zIndex: 1, data: { ...newNode.data, title: 'New Node', content: 'Click to edit...', instruction: '', goal: '', connections: { in: [], out: [] }, subGraph: { nodes: [], edges: [] } } };
    }
    addNodes(newNode);
    nextTick(() => { setAddMode(null); });
}


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

function onEdgeDelete(edgeId) {
  const edgeToRemove = edges.value.find(edge => edge.id === edgeId);
  removeConnectionData(edgeToRemove);
  removeEdges([edgeId]);
}
function removeConnectionData(edge) {
  if (!edge) return;
  const sourceNode = findNode(edge.source);
  if (sourceNode?.data.connections?.out) {
    sourceNode.data.connections.out = sourceNode.data.connections.out.filter(c => c.edgeId !== edge.id);
  }
  const targetNode = findNode(edge.target);
  if (targetNode?.data.connections?.in) {
    targetNode.data.connections.in = targetNode.data.connections.in.filter(c => c.edgeId !== edge.id);
  }
}

// --- Other Handlers (Unchanged) ---

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
  if (activeSubCanvasData.value) return;
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleDuplicateNode();
  }
}

function handleOpenSubCanvas(nodeId) {
    const parentNode = findNode(nodeId);
    if (!parentNode) return;
    activeSubCanvasData.value = {
        id: parentNode.id,
        name: parentNode.data.title || 'Sub-Canvas',
        parentNodeTitle: parentNode.data.title,
        parentNodeContent: parentNode.data.content,
        parentNodeInstruction: parentNode.data.instruction,
        parentNodeGoal: parentNode.data.goal,
        designBackground: instructionPanels.value[1].content,
        designGoal: instructionPanels.value[2].content,
        initialNodes: JSON.parse(JSON.stringify(parentNode.data.subGraph?.nodes || [])),
        initialEdges: JSON.parse(JSON.stringify(parentNode.data.subGraph?.edges || [])),
        initialChainList: parentNode.data.chain,
      };
}

function handleCloseSubCanvas(payload) { // 接收从子画布传来的 payload
  if (!activeSubCanvasData.value) return;

  // 1. 获取刚刚关闭的子画布对应的父节点 ID
  const parentNodeId = activeSubCanvasData.value.id;
  const parentNode = findNode(parentNodeId);

  // 2. 检查父节点是否关联了一个快照
  if (parentNode && parentNode.data.appliedSnapshotId && payload) {
    const linkedSnapshotId = parentNode.data.appliedSnapshotId;

    // 3. 在 snapshots 数组中找到这个快照
    const snapshotToUpdate = snapshots.value.find(s => s.id === linkedSnapshotId);

    // 4. 如果找到了，就用新的图表数据更新它
    if (snapshotToUpdate) {
      // 使用 JSON.parse/stringify 来确保深度复制，避免响应性问题
      snapshotToUpdate.data.subGraph = {
        nodes: JSON.parse(JSON.stringify(payload.nodes)),
        edges: JSON.parse(JSON.stringify(payload.edges)),
      };
      
      // (可选) 你也可以更新 instruction 和 goal
      snapshotToUpdate.data.instruction = parentNode.data.instruction;
      snapshotToUpdate.data.goal = parentNode.data.goal;
      snapshotToUpdate.goal = parentNode.data.goal; // 同时更新顶层的 goal
    }
  }

  // 最后，关闭子画布
  activeSubCanvasData.value = null; 
}

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

function handleSaveSnapshot(snapshotPayload) {
   const newSnapshot = {
    id: `${snapshotIdCounter}`, // 这个 id 是关键
    parentNodeId: snapshotPayload.parentNodeId,
    parentNodeTitle: snapshotPayload.parentNodeTitle,
    goal: snapshotPayload.data.goal,
    data: snapshotPayload.data
  };

  // 2. 将新快照添加到列表中
  snapshots.value.push(newSnapshot);

  // 3. 找到发起保存操作的父节点
  const parentNode = findNode(snapshotPayload.parentNodeId);
  if (parentNode) {
    // 4. 将新快照的ID直接赋值给父节点的 `appliedSnapshotId`
    //    这将立即触发 CustomNode.vue 中您已经写好的 v-if="data.appliedSnapshotId" 逻辑
    if (!parentNode.data) parentNode.data = {};
    parentNode.data.appliedSnapshotId = newSnapshot.id; //
  }
}

function handleApplySnapshot({ nodeId, snapshotData }) {
  const targetNode = findNode(nodeId);
  if (!targetNode) return;
  const dataToApply = snapshotData.data;
  const id = snapshotIdCounter++
  console.log(id+1)
  targetNode.data.appliedSnapshotId = id+1
  targetNode.data.instruction = dataToApply.instruction;
  targetNode.data.goal = dataToApply.goal;
  targetNode.data.subGraph = JSON.parse(JSON.stringify(dataToApply.subGraph));
  targetNode.data.chain = dataToApply.chain;

  // Add a visual indicator to the target node
  targetNode.data.hasSnapshot = true;

  // Create a new snapshot that is a copy of the applied one,
  // but linked to the TARGET node.
  const newSnapshotCopy = {
    id: `${snapshotIdCounter}`,
    // Link to the node it was just applied to
    parentNodeId: targetNode.id,
    parentNodeTitle: targetNode.data.title, 
    // Copy the rest of the data from the original snapshot
    goal: snapshotData.goal,
    data: JSON.parse(JSON.stringify(snapshotData.data))
  };

  // Add the new, copied snapshot to the panel
  snapshots.value.push(newSnapshotCopy);

  
}

function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
    node.data.title = event.data.title;
    node.data.content = event.data.content;
  }
}

// 5. 修改 handleNodeRun
async function handleNodeRun(nodeId) {
    const node = findNode(nodeId);
    if (!node || runningNodeId.value) return;

    runningNodeId.value = nodeId;
    node.data.content = 'Running...';
    const successors = findPredecessors(nodeId, nodes.value, edges.value);
    try {
        const response = await fetch("http://localhost:7001/brainstorm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                design_background: instructionPanels.value[1].content,
                design_goal: instructionPanels.value[2].content,
                node_title: node.data.title,
                successors: successors,
            }),
        });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const data = await response.json();
        node.data.content = data.content; 
        
        // 计算反馈节点的位置：在运行节点右侧
        const position = {
            x: node.position.x + (node.dimensions?.width || 200) + 20,
            y: node.position.y,
        };

        // 调用新的函数添加反馈节点
        addRatingNode({
          position,
          type: 'run-node',
          context: { nodeId: nodeId, result: data.content }
        });

    } catch (error) {
        node.data.content = "Error: " + error.message;
    } finally {
        runningNodeId.value = null;
    }
}

function findPredecessors(startNodeId, allNodes, allEdges) {
  const predecessors = [];
  const queue = [{ nodeId: startNodeId, level: 0 }];
  const visited = new Set([startNodeId]);
  let head = 0;
  while(head < queue.length) {
      const { nodeId: currentId, level } = queue[head++];
      allEdges.forEach(edge => {
          if (edge.target === currentId && !visited.has(edge.source)) {
              visited.add(edge.source);
              const predNode = allNodes.find(n => n.id === edge.source);
              if(predNode) {
                  const content = predNode.data.content || '';
                  const title = predNode.data.title || '';
                  const placeholderTexts = ['Click to edit...', 'Ready to run...', ''];
                  if (content && !placeholderTexts.includes(content.trim())) {
                      predecessors.push({ level: level + 1, title, content });
                  }
                  queue.push({ nodeId: predNode.id, level: level + 1 });
              }
          }
      });
  }
  return predecessors.sort((a, b) => a.level - b.level);
}

function handleContentChanged(sourceNodeId) {
  const edgeToUpdate = edges.value.find(edge => {
    if (edge.source !== sourceNodeId) return false;
    const targetNode = findNode(edge.target);
    return targetNode && targetNode.type === 'run';
  });
  if (edgeToUpdate) {
    if (!edgeToUpdate.data) edgeToUpdate.data = {};
    edgeToUpdate.data.animated = false;
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
  }
}

// 6. 修改 handleFetchPipeline
async function handleFetchPipeline(payload) {
  isFetchingPipeline.value = true;
  try {
    const response = await fetch("http://localhost:7001/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: instructionPanels.value[0].content,
        design_background: instructionPanels.value[1].content,
        design_goal: instructionPanels.value[2].content,
      }),
    });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    instructionPanels.value[3].content = Array.isArray(data.pipeline) ? data.pipeline.join('\n') : String(data.pipeline);
  
    // 将按钮的屏幕坐标转换为主画布坐标
    const buttonRect = payload.event.target.getBoundingClientRect();
    const position = project({ x: buttonRect.right + 202, y: buttonRect.top + 362});

    // 添加反馈节点
    addRatingNode({
        position,
        type: 'fetch-pipeline',
        context: {
            // 可选：添加一些上下文信息
            design_goal: instructionPanels.value[2].content
        }
    });
  
  } catch (error) {
    console.error("Error during pipeline request:", error);
  } finally {
    isFetchingPipeline.value = false;
  }
}


function node_chain_autogene(nodeData) {
  pipelineCounter.value++;
  console.log(pipelineCounter)
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
  
  addNodes(newNodes); addEdges(newEdges);
}

async function handleGeneration(payload) {
  isGenerating.value = true;
  try {
    const response = await fetch("http://localhost:7001/generate-node-chain", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        pipeline: instructionPanels.value[3].content,
        design_background: instructionPanels.value[1].content,
        design_goal:instructionPanels.value[2].content
      }),
    });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    if (data) node_chain_autogene(data);

    const buttonRect = payload.event.target.getBoundingClientRect();
    const position = project({ x: buttonRect.right + 202, y: buttonRect.top + 465});
    
    addRatingNode({
      position,
      type: 'node-chain-generation'
    });

  } catch (error) {
    console.error("Error during node chain request:", error);
  } finally {
    isGenerating.value = false;
  }
}

function handleDeleteSnapshot(snapshotIdToDelete) {
  const index = snapshots.value.findIndex(s => s.id === snapshotIdToDelete);
  if (index !== -1) snapshots.value.splice(index, 1);
}

// Lifecycle Hooks
onMounted(() => {
  manageSession();
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
      <button @click="clearAllStateAndExit" class="exit-button" title="清除所有内容并退出">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @edges-change="onEdgesChange"
        @connect="onConnect"
        class="flow-canvas"
        :fit-view-on-init="true"
        ref="vueFlowRef"
        :min-zoom="0.1"
      >
        <!-- 7. 注册新的 #node-rating 模板 -->
        <template #node-rating="props">
          <RatingNode
            v-bind="props"
            @close="handleRatingClose"
            @submit="handleRatingSubmit"
          />
        </template>

        <!-- Other Node Templates -->
        <template #node-custom="props">
          <CustomNode
            v-bind="props"
            @delete="onNodeDelete"
            @open-canvas="handleOpenSubCanvas"
            @update-node-data="handleNodeUpdate"
            @content-changed="handleContentChanged"
            @snapshot-dropped="handleApplySnapshot"
          />
        </template>
        <template #node-run="props">
          <RunNode
            v-bind="props"
            @delete="onNodeDelete"
            
            @run-node="handleNodeRun"
            @update-node-data="handleNodeUpdate"
            :is-running="props.id === runningNodeId"
            @run-triggered="handleRunTriggered"
          />
        </template>
        <template #node-group="props">
          <GroupNode
            v-bind="props"
            @delete="onNodeDelete"
          />
        </template>

        <!-- Edge Template -->
        <template #edge-custom="props">
          <CustomEdge v-bind="props" @delete-edge="onEdgeDelete" />
        </template>

        <Background />
        <MiniMap />
        <Controls />
      </VueFlow>

      <div class="main-toolbar-wrapper">
        <Toolbar
          :is-frozen="isFrozen"
          :is-adding-node="isAddingNode"
          :is-adding-run-node="isAddingRunNode"
          :is-add-group="isAddingGroup"
          v-model:newNodeColor="newNodeColor"
          :is-show="isShowingRunNode"
          @toggle-freeze="toggleFreeze"
          @toggle-add-node-mode="toggleAddNodeMode"
          @toggle-add-run-node-mode="toggleAddRunNodeMode"
          @toggle-add-group-mode="toggleAddGroupMode"
        />
      </div>

      <SubCanvas
        v-if="activeSubCanvasData"
        :node-id="activeSubCanvasData.id"
        :node-name="activeSubCanvasData.name"
        @save-snapshot="handleSaveSnapshot"
        v-bind="activeSubCanvasData"
        @close="handleCloseSubCanvas" @update:graph="handleSubCanvasUpdate"
        @update:data="handleSubCanvasDataUpdate"
    />
    </main>

    <!-- Right Panel -->
    <div 
      class="right-panel" 
      :style="{ width: rightPanelWidth + 'px' }" 
      :class="{ 'is-collapsed': isRightPanelCollapsed }"
    >
      <div class="resizer" @mousedown="startResize"></div>
      <button class="expand-btn" v-if="isRightPanelCollapsed" @click="toggleRightPanel" title="Expand">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <CanvasNodePanel v-if="!isRightPanelCollapsed" 
        :snapshots="snapshots" 
        @delete-snapshot="handleDeleteSnapshot"
        @show-details="showSnapshotDetails" 


      />
      
    </div>

    <SnapshotDetailModal 
      :show="isDetailModalVisible"
      :snapshot="selectedSnapshotForDetail"
      @close="closeSnapshotDetails"
    />
  </div>
    
    <!-- Session Expiration Overlay -->
    <div v-if="isSessionExpired" class="session-expired-overlay">
      <div class="session-expired-box">
        <h2>Session expired</h2>
        <button @click="startNewSession" class="restart-button">Start a new session</button>
      </div>
    </div>

</template>

<style>
/* Styles are unchanged, so they are omitted for brevity. You can copy them from your original file. */
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
.exit-button {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 20;
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
