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


const CustomNode = defineAsyncComponent(() => import('./components/CustomNode.vue'));
const RunNode = defineAsyncComponent(() => import('./components/RunNode.vue'));
const GroupNode = defineAsyncComponent(() => import('./components/GroupNode.vue'));

const RatingNode = defineAsyncComponent(() => import('./components/RatingNode.vue'));


// State
let nodeIdCounter = 0;
let snapshotIdCounter = 0;
const pipelineCounter = ref(-1)
const pipelineOffset = 200;

const { addNodes, addEdges, removeEdges, findNode, removeNodes, project, onPaneMouseMove, getNodes, getSelectedNodes, onSelectionChange } = useVueFlow();
onSelectionChange(({ nodes }) => {
    if (nodes.length === 1 && nodes[0].data && nodes[0].data.color) {
        activeColor.value = nodes[0].data.color;
    }
});

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
const activeColor = ref('#FBF29B');
const isDetailModalVisible = ref(false);
const selectedSnapshotForDetail = ref(null);

const isAddingNode = ref(false);
const isAddingRunNode = ref(false);
const isAddingGroup = ref(false);
const isShowingRunNode = ref(true);

// --- Session
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
const snapshotColorPalette = [
  '#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bfdbfe',
  '#a5f3fc', '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bbf7d0',
  '#fde68a', '#fecdd3', '#e0e7ff', '#fae8ff', '#d1fae5',
  '#fef3c7', '#ffedd5', '#fce7f3', '#f0f9ff', '#ecfdf5'
];
const snapshotColorIndex = ref(0);

// 3. Add this helper function to get the next color
function getNextSnapshotColor() {
  const color = snapshotColorPalette[snapshotColorIndex.value];
  snapshotColorIndex.value = (snapshotColorIndex.value + 1) % snapshotColorPalette.length;
  return color;
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
// color 
watch(activeColor, (newColor) => {
  const selectedNodes = getSelectedNodes.value;

  // 遍历所有选中的节点并更新它们的颜色
  selectedNodes.forEach(node => {
    // 确保节点有 data 对象
    if (node.data) {
      node.data.color = newColor;
    }
  });
});


//
function showSnapshotDetails(snapshot) {
  selectedSnapshotForDetail.value = snapshot;
  isDetailModalVisible.value = true;
}

function closeSnapshotDetails() {
  isDetailModalVisible.value = false;
}


function addRatingNode({ position, type, context = {} }) {
  const id = `rating-${type}-${Date.now()}`;
  const newNode = {
    id,
    type: 'rating',
    position,
    data: { context },
    zIndex: 1000, 
    draggable: true, // 
    selectable: false, 
  };
  addNodes([newNode]);
}

function handleRatingClose(nodeId) {
  removeNodes([nodeId]);
}

async function handleRatingSubmit(payload) {

  console.log('Received payload from RatingNode:', payload);


  const runNodeTitle = payload.context.title;
  const runNodeContent = payload.context.content;
  const ratings = payload.ratings
  try {
    const response = await fetch("/api/submit-rating", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
     
      body: JSON.stringify({
        ratings: ratings,
        node_title: runNodeTitle,
        node_content: runNodeContent,
        user_id: instructionPanels.value[0].content,

      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Backend response:', responseData);

  } catch (error) {
    console.error("Failed to submit rating:", error);
  } finally {
  
    removeNodes([payload.nodeId]);
  }
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
        isSaved : parentNode.data.isSaved
      };
}

function handleCloseSubCanvas(payload) { 
  if (!activeSubCanvasData.value) return;


  const parentNodeId = activeSubCanvasData.value.id;
  const parentNode = findNode(parentNodeId);
  
  if (parentNode && parentNode.data.appliedSnapshotId && payload) {
    const linkedSnapshotId = parentNode.data.appliedSnapshotId;

    const snapshotToUpdate = snapshots.value.find(s => s.id === linkedSnapshotId);

    if (snapshotToUpdate) {
      snapshotToUpdate.data.subGraph = {
        nodes: JSON.parse(JSON.stringify(payload.nodes)),
        edges: JSON.parse(JSON.stringify(payload.edges)),
      };
      
      parentNode.data.isSaved = payload.isSaved;
      snapshotToUpdate.data.instruction = parentNode.data.instruction;
      snapshotToUpdate.data.goal = parentNode.data.goal;
      snapshotToUpdate.goal = parentNode.data.goal;
    }
  }

 
  activeSubCanvasData.value = null; 
}

function handleSubCanvasUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) { 
        parentNode.data.subGraph = { 
            nodes: JSON.parse(JSON.stringify(event.nodes)), 
            edges: JSON.parse(JSON.stringify(event.edges)), 
        }; 
        parentNode.data.isSaved = event.isSaved;
    }
}

function handleSubCanvasDataUpdate(event) {
    const parentNode = findNode(event.nodeId);
    if (parentNode) {
        parentNode.data.instruction = event.instruction;
        parentNode.data.goal = event.goal;
        parentNode.data.chain = event.chain;
        
    }
}

function handleSaveSnapshot(snapshotPayload) {
  const parentNode = findNode(snapshotPayload.parentNodeId);
  if (!parentNode) return;

  // 核心修改: 确保快照数据包含父节点的内容
  // Core change: Ensure snapshot data includes the parent node's content.
  const fullSnapshotData = {
    ...snapshotPayload.data,
    rationales: JSON.parse(JSON.stringify(parentNode.data.rationales || [])),
    content: parentNode.data.content || '',
  };

   const newSnapshot = {
    id: `${snapshotIdCounter++}`,
    parentNodeId: snapshotPayload.parentNodeId,
    parentNodeTitle: snapshotPayload.parentNodeTitle,
    goal: snapshotPayload.data.goal,
    color: getNextSnapshotColor(),
    data: fullSnapshotData // 使用我们增强后的数据
  };


  snapshots.value.push(newSnapshot);


  if (!parentNode.data) parentNode.data = {};
  parentNode.data.appliedSnapshotId = newSnapshot.id;
}

// ✨ 修改: 优化 handleApplySnapshot 逻辑
function handleApplySnapshot({ nodeId, snapshotData }) {
  const targetNode = findNode(nodeId);
  if (!targetNode) return;

  // --- 新增逻辑: 删除旧的快照 ---
  // 1. 获取当前节点关联的旧快照ID
  const oldSnapshotId = targetNode.data.appliedSnapshotId;

  // 2. 如果存在旧快照ID，则从主快照列表中移除
  if (oldSnapshotId) {
    const oldSnapshotIndex = snapshots.value.findIndex(s => s.id === oldSnapshotId);
    if (oldSnapshotIndex !== -1) {
      snapshots.value.splice(oldSnapshotIndex, 1);
    }
  }
  // --- 新增逻辑结束 ---

  const dataToApply = snapshotData.data;
  const newSnapshotId = `${snapshotIdCounter++}`;

  // Update sub-canvas related data
  targetNode.data.instruction = dataToApply.instruction;
  targetNode.data.goal = dataToApply.goal;
  
  // 核心修改: 在应用快照时过滤掉 TextNode
  // Core change: Filter out TextNodes when applying a snapshot.
  if (dataToApply.subGraph && dataToApply.subGraph.nodes) {
    const nodesToApply = dataToApply.subGraph.nodes.filter(n => n.type !== 'text');
    const nodeIdsToKeep = new Set(nodesToApply.map(n => n.id));
    const edgesToApply = (dataToApply.subGraph.edges || []).filter(e => nodeIdsToKeep.has(e.source) && nodeIdsToKeep.has(e.target));
    
    targetNode.data.subGraph = {
        nodes: JSON.parse(JSON.stringify(nodesToApply)),
        edges: JSON.parse(JSON.stringify(edgesToApply)),
    };
  } else {
    targetNode.data.subGraph = { nodes: [], edges: [] };
  }
  
  targetNode.data.chain = dataToApply.chain;

  // 同时更新 rationales 和 content 以确保兼容性
  // Update both rationales and content at the same time to ensure compatibility.
  if (dataToApply.rationales && dataToApply.rationales.length > 0) {
    targetNode.data.rationales = JSON.parse(JSON.stringify(dataToApply.rationales));
    targetNode.data.content = dataToApply.rationales.join('\n');
  } else if (dataToApply.content) { // Fallback for older snapshots
    targetNode.data.content = dataToApply.content;
    targetNode.data.rationales = [dataToApply.content];
  }

  // Update visual indicator
  targetNode.data.hasSnapshot = true;
  targetNode.data.appliedSnapshotId = newSnapshotId;
  
  // Create a full, deep copy of the snapshot to add to the panel
  const newSnapshotCopy = {
    id: newSnapshotId,
    color: snapshotData.color || getNextSnapshotColor(),
    parentNodeId: targetNode.id,
    parentNodeTitle: targetNode.data.title, 
    goal: dataToApply.goal,
    data: JSON.parse(JSON.stringify(dataToApply))
  };
  
  targetNode.data.appliedSnapshotColor = newSnapshotCopy.color;
  
  snapshots.value.push(newSnapshotCopy);
}





// ✨ 修改: 修正节点更新逻辑
function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
    // 使用对象扩展运算符(...)来合并数据，确保所有属性(包括 rationales 和 content)都被正确更新
    // Use the spread operator (...) to merge data, ensuring all properties (including rationales and content) are updated correctly.
    node.data = { ...node.data, ...event.data };
  }
}


async function handleNodeRun(nodeId) {
    const node = findNode(nodeId);
    if (!node || runningNodeId.value) return;

    runningNodeId.value = nodeId;
    node.data.content = 'Running...';
    const successors = findPredecessors(nodeId, nodes.value, edges.value);
    console.log("SU: ",successors)
    console.log("title:",node.data.title)
    try {
        const response = await fetch("/api/brainstorm", {
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
        
       /*
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
*/
    } catch (error) {
        node.data.content = "Error: " + error.message;
    } finally {
        runningNodeId.value = null;
    }
}

function handleShowRating({ nodeId }) {
  const node = findNode(nodeId);
  if (!node) return;

  const position = {
    x: node.position.x + (node.dimensions?.width || 200) + 20,
    y: node.position.y,
  };

  addRatingNode({
    position,
    type: 'run-node-rating',
    context: {
      runNodeId: nodeId, 
      title: node.data.title, 
      content: node.data.content, //
    }
  });
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

//handleFetchPipeline
async function handleFetchPipeline(payload) {
  isFetchingPipeline.value = true;
  try {
    const response = await fetch("/api/pipeline", {
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

  } catch (error) {
    console.error("Error during pipeline request:", error);
  } finally {
    isFetchingPipeline.value = false;
  }
}

// ✨ 修改: 优化 node_chain_autogene 逻辑
async function node_chain_autogene(nodeData) {
  pipelineCounter.value++;
  if (!Array.isArray(nodeData) || nodeData.length === 0) return;
  const newNodes = []; 
  const newEdges = [];
  const startX = 100; 
  const startY = 200 + pipelineOffset * pipelineCounter.value; 
  const gapX = 250;
  
  nodeData.forEach((data, index) => {
    const pipelineContent = data.pipeline_content || ''; // 将内容存为变量
    const newNode = {
      id: `chain-node-${nodeIdCounter++}`, 
      type: 'custom',
      position: { x: startX + index * gapX, y: startY },
      style: { width: '200px', height: '200px' }, 
      data: {
        title: data.pipeline_title || 'Untitled Node',
        // 核心修改: 同时创建 rationales 和 content 保证数据一致性
        // Core change: Create rationales and content at the same time to ensure data consistency.
        rationales: [ pipelineContent ], 
        content: pipelineContent,
        color: newNodeColor.value,
        connections: { in: [], out: [] }, 
        subGraph: { nodes: [], edges: [] },
      },
    };
    newNodes.push(newNode);
  });

  for (let i = 1; i < newNodes.length; i++) {
    const sourceNode = newNodes[i - 1]; 
    const targetNode = newNodes[i];
    const newEdge = {
      id: `chain-edge-${sourceNode.id}-to-${targetNode.id}`, 
      source: sourceNode.id, 
      target: targetNode.id,
      sourceHandle: 'right', 
      targetHandle: 'left', 
      type: 'custom', 
      selectable: true, 
      interactionWidth: 30,
    };
    newEdges.push(newEdge);
    sourceNode.data.connections.out.push({ edgeId: newEdge.id, targetId: targetNode.id, sourceHandle: 'right' });
    targetNode.data.connections.in.push({ edgeId: newEdge.id, sourceId: sourceNode.id, targetHandle: 'left' });
  }
  
  addNodes(newNodes); 
  
  
  // Use nextTick to ensure that nodes are rendered before adding edges to prevent coordinate errors.
  await nextTick();
  
  addEdges(newEdges);
}


async function handleGeneration(payload) {
  isGenerating.value = true;
  try {
    const response = await fetch("/api/generate-node-chain", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        pipeline: instructionPanels.value[3].content,
        design_background: instructionPanels.value[1].content,
        design_goal:instructionPanels.value[2].content
      }),
    });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    if (data) node_chain_autogene(data);

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
            @show-rating="handleShowRating"
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
          
          :is-adding-node="isAddingNode"
          :is-adding-run-node="isAddingRunNode"
          :is-add-group="isAddingGroup"
          
          :is-show="isShowingRunNode"
         
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
        :user-id="instructionPanels[0].content"
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
  left: 58%;
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
