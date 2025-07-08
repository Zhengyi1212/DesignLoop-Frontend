<script setup>
import { ref, watch, onUnmounted, onBeforeUnmount, onMounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import CustomNode from './CustomNode.vue';
import RunNode from './RunNode.vue';
import EditModal from './EditModal.vue';

import ChainNode from './ChainNode.vue';


const GHOST_NODE_OFFSET_X = -100;
const GHOST_NODE_OFFSET_Y = -75;
const TEXT_NODE_OFFSET_Y = -120;

const props = defineProps({
  nodeId: { type: String, required: true },
  nodeName: { type: String, default: 'Sub-Canvas' },
  initialNodes: { type: Array, required: true },
  initialEdges: { type: Array, required: true },
  parentNodeTitle: { type: String, default: '' },
  parentNodeContent: { type: String, default: '' },
  parentNodeInstruction: { type: String, default: '' },
  parentNodeGoal: { type: String, default: '' },
  designBackground : { type: String, default: '' },
  designGoal : { type: String, default: '' },
  initialChainList: { type: Array, required: true },
});

const emit = defineEmits(['close', 'update:graph', 'update:data', 'save-snapshot']);

const isEditModalVisible = ref(false);
const editingNode = ref(null);
const isFrozen = ref(false);
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);
let subNodeIdCounter = 0;
const isAddingNode = ref(false);
const isShowingRunNode = ref(false);
const vueFlowRef = ref(null);
const chainList = ref(null || props.initialChainList)

const instruction = ref( props.parentNodeInstruction || '');
const goal = ref(props.parentNodeGoal || '');
const isSubCanvasRunning = ref(false);
const isSaveButtonRunning = ref(false)
const runningSubNodeId = ref(null);

const newNodeColor = ref('#ffffff');

const isGeneratingRationaleNodeId = ref(null);

const subflow = useVueFlow({ id: props.nodeId });

function handleChainNodeContentUpdate({ id, content }) {
  const node = subflow.findNode(id);
  if (node) {
    node.data.content = content;
    console.log(`Node ${id} content updated.`);
  }
}

// [REVISED] A more robust implementation for filtering out text nodes before saving.
async function handleSaveButton() {
  if (isSaveButtonRunning.value) return;
  isSaveButtonRunning.value = true;

  try {
    const allNodes = subflow.getNodes.value;
    const allEdges = subflow.getEdges.value;

    // 1. Identify text nodes by their unique ID prefix, which is more reliable.
    const textNodeIds = new Set(
      allNodes
        .filter(n => n.id.startsWith('sub-text-node-'))
        .map(n => n.id)
    );

    // 2. Filter nodes to exclude text nodes and the ghost node.
    const nodesForSnapshot = allNodes.filter(n =>
      n.id !== 'ghost-node' && !textNodeIds.has(n.id)
    );

    // 3. Filter edges to exclude any that connect to a text node.
    const edgesForSnapshot = allEdges.filter(e =>
      !textNodeIds.has(e.source) && !textNodeIds.has(e.target)
    );

    const snapshotPayload = {
      title: `Version of: ${goal.value || 'Untitled'}`,
      data: {
        instruction: instruction.value,
        goal: goal.value,
        chain : chainList.value,
        subGraph: {
          nodes: JSON.parse(JSON.stringify(nodesForSnapshot)),
          edges: JSON.parse(JSON.stringify(edgesForSnapshot)),
        }
      }
    };
    emit('save-snapshot', snapshotPayload);
    console.log('Sub-canvas state snapshot emitted successfully!');
  } catch (error) {
    console.error("Error creating sub-canvas snapshot:", error);
  } finally {
    isSaveButtonRunning.value = false;
  }
}

function placeNodeOnClick(event) {
  if (!isAddingNode.value || event.target.closest('.vue-flow__controls, .tool-button')) {
    return;
  }
  const ghostNode = subflow.findNode('ghost-node');
  if (!ghostNode) return;

  const newNode = {
    id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter++}`,
    type: 'chain',
    position: { ...ghostNode.position },
    width: 120,
    height: 120,
    data: {
      content: '',
      color: newNodeColor.value,
      connections: { in: [], out: [] },
      subGraph: { nodes: [], edges: [] },
      isManual: true, 
    },
  };
  subflow.addNodes([newNode]);
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
    subflow.removeNodes(['ghost-node']);
  }
}

subflow.onPaneMouseMove((event) => {
  if (!isAddingNode.value) return;
  const flowRect = vueFlowRef.value.$el.getBoundingClientRect();
  const relativeMousePos = {
    x: event.clientX - flowRect.left,
    y: event.clientY - flowRect.top,
  };
  const position = subflow.project(relativeMousePos);
  const adjustedPosition = {
    x: position.x - 100,
    y: position.y - 50,
  };
  const ghostNode = subflow.findNode('ghost-node');
  if (ghostNode) {
    ghostNode.position = adjustedPosition;
    ghostNode.data.color = newNodeColor.value;
  } else {
    subflow.addNodes([{
      id: 'ghost-node',
      type: 'chain',
      position: adjustedPosition,
      width: 200,
      height: 100,
      data: {
        content: 'Click to place',
        color: newNodeColor.value
      },
      class: 'ghost-node',
    }]);
  }
});

function handleDuplicateSubNode() {
  const selectedNodes = subflow.getSelectedNodes.value;
  if (selectedNodes.length !== 1) return;
  const originalNode = selectedNodes[0];
  if (originalNode.id === 'ghost-node') return;
  const newNode = {
    id: `sub-node-${props.nodeId}-${subNodeIdCounter++}`,
    type: originalNode.type,
    position: {
      x: originalNode.position.x + 40,
      y: originalNode.position.y + 40,
    },
    data: {
      ...JSON.parse(JSON.stringify(originalNode.data)),
      connections: { in: [], out: [] },
    },
  };
  subflow.addNodes([newNode]);
}

function handleKeyDown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleDuplicateSubNode();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  const flowElement = vueFlowRef.value?.$el;
  if (flowElement) {
    flowElement.removeEventListener('click', placeNodeOnClick, true);
  }
  window.removeEventListener('keydown', handleKeyDown);
});

subflow.onConnect((params) => subflow.addEdges(params));

function toggleFreeze() {
  isFrozen.value = !isFrozen.value;
  const isDraggable = !isFrozen.value;
  for (const node of subflow.getNodes.value) {
    if (node.id !== 'ghost-node') {
      node.draggable = isDraggable;
      node.selectable = isDraggable;
    }
  }
}

watch([subflow.nodes, subflow.edges], () => {
  emit('update:graph', {
    nodeId: props.nodeId,
    nodes: subflow.getNodes.value,
    edges: subflow.getEdges.value,
  });
}, { deep: true });

function handleNodeDoubleClick(nodeId) {
  editingNode.value = subflow.findNode(nodeId);
  isEditModalVisible.value = true;
}

function handleNodeSave(event) {
  const node = subflow.findNode(event.id);
  if (node) {
    node.data.title = event.data.title;
    node.data.content = event.data.content;
  }
  isEditModalVisible.value = false;
  editingNode.value = null;
}

function onFieldBlur() {
  emit('update:data', {
    nodeId: props.nodeId,
    instruction: instruction.value,
    goal: goal.value,
  });
}

function generateNodeChain(nodeDataList) {
  if (!subflow) {
    console.error("[SubCanvas] Vue Flow instance (subflow) is not available!");
    return;
  }

  if (!Array.isArray(nodeDataList) || nodeDataList.length === 0) {
    console.log("[SubCanvas] nodeDataList is empty, skipping new chain generation.");
    return;
  }
  
  console.log("[SubCanvas] Generating new chain with data:", nodeDataList);

  const newNodes = [];
  const newEdges = [];
  const startX = 100;
  const startY = 200;
  const gapX = 250;

  nodeDataList.forEach((element, index) => {
    const content = element || '';
    const newNode = {
      id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter++}`,
      type: 'chain',
      position: { x: startX + index * gapX, y: startY },
      style: { width: '200px', height: '100px' },
      data: {
        content: content,
        connections: { in: [], out: [] },
      },
    };
    newNodes.push(newNode);
  });

  for (let i = 1; i < newNodes.length; i++) {
    const sourceNode = newNodes[i - 1];
    const targetNode = newNodes[i];
    const newEdge = {
      id: `sub-chain-edge-${sourceNode.id}-to-${targetNode.id}`,
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'custom',
      selectable: true,
      interactionWidth: 30,
    };
    newEdges.push(newEdge);
  }
  
  console.log("[SubCanvas] Adding new nodes:", newNodes);
  console.log("[SubCanvas] Adding new edges:", newEdges);

  subflow.addNodes(newNodes);
  subflow.addEdges(newEdges);
}
function findDirectPredecessorsWithText(startNodeId, allNodes, allEdges) {
  
  // 1. 直接遍历所有边，找到所有以 startNodeId 为目标的边，其源头就是 level 1 的前驱节点。
  const directPredecessors = [];
  for (const edge of allEdges) {
    if (edge.target === startNodeId) {
      const predNode = allNodes.find(n => n.id === edge.source);
      // 确保找到的这个前驱节点本身不是一个 Text Node
      if (predNode && !predNode.data.isTextNode) {
        directPredecessors.push(predNode);
      }
    }
  }

  // 如果没有找到任何符合条件的直接前驱节点，返回空数组。
  if (directPredecessors.length === 0) {
    return [];
  }

  // 2. 为每个找到的直接前驱节点，查找其相连的 Text Node。
  const results = directPredecessors.map(predNode => {
    let foundTextNodeContent = ''; // 默认为空字符串

    // 遍历所有边，寻找连接了当前前驱节点（predNode）和某个 Text Node 的边
    for (const edge of allEdges) {
      let connectedNodeId = null;

      // 确定这条边连接的另一个节点的ID
      if (edge.source === predNode.id) {
        connectedNodeId = edge.target;
      } else if (edge.target === predNode.id) {
        connectedNodeId = edge.source;
      }
      
      // 必须确保我们找到的“另一个节点”不是最初的 startNodeId，避免找回去
      if (connectedNodeId && connectedNodeId !== startNodeId) {
        const connectedNode = allNodes.find(n => n.id === connectedNodeId);
        
        // 如果这个连接的节点是 Text Node，我们就找到了
        if (connectedNode && connectedNode.data.isTextNode) {
          foundTextNodeContent = connectedNode.data.content || '';
          break; // 找到后就跳出内层循环，继续为下一个前驱节点查找
        }
      }
    }

    // 返回最终的对象
    return {
      node_content: predNode.data.content,
      text_content: foundTextNodeContent,
    };
  });

  return results;
}

async function handleGenerateTextNode({ sourceNodeId, position }) {
    const sourceNode = subflow.findNode(sourceNodeId);
    if (!sourceNode || isGeneratingRationaleNodeId.value) return;

    isGeneratingRationaleNodeId.value = sourceNodeId;
    try {
        // --- MODIFICATION: Find predecessors before calling the backend ---
        //const predecessors = findChainNodePredecessors(sourceNodeId, subflow.getNodes.value, subflow.getEdges.value);
        //console.log(`[SubCanvas] Found ${predecessors.length} predecessors for node ${sourceNodeId}:`, predecessors);
        const predecessors = findDirectPredecessorsWithText(sourceNodeId, subflow.getNodes.value, subflow.getEdges.value)
        console.log(predecessors[0])
        const formattedChain = (chainList.value || []).map(item => ({ content: item }));
        const payload = {
            parent_node_title: props.parentNodeTitle,
            parent_node_content: props.parentNodeContent,
            goal: goal.value,
            instruction: instruction.value,
            current_node_content: sourceNode.data.content,
            chain: formattedChain, // This is the chain generated by the main "Run" button
            predecessor_chain: predecessors, // --- MODIFICATION: Pass the specific predecessor chain to the backend ---
            design_background: props.designBackground,
            design_goal:props.designGoal
        };

        const response = await fetch('/api/generate-rationale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch rationale or parse error response.' }));
            const readableError = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail, null, 2);
            throw new Error(readableError);
        }
        const data = await response.json();
        const rationaleContent = data.rationale || 'No rationale provided.';

        const existingTextNodeId = sourceNode.data.generatedContentNodeId;
        const existingTextNode = existingTextNodeId ? subflow.findNode(existingTextNodeId) : null;

        if (existingTextNode) {
            existingTextNode.data.content = rationaleContent;
        } else {
            const contentNode = {
                id: `sub-text-node-${props.nodeId}-${subNodeIdCounter++}`,
                type: 'chain',
                position: { x: position.x - 50, y: position.y + TEXT_NODE_OFFSET_Y - 50, },
                width: 300,
                height: 160,
                data: {
                    content: rationaleContent,
                    isTextNode: true,
                    connections: { in: [], out: [] },
                    subGraph: { nodes: [], edges: [] },
                },
            };
            const newEdge = {
                id: `sub-content-edge-${contentNode.id}-to-${sourceNode.id}`,
                source: contentNode.id,
                target: sourceNode.id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
                type: 'custom',
                animated: true,
            };
            sourceNode.data.generatedContentNodeId = contentNode.id;
            subflow.addNodes([contentNode]);
            subflow.addEdges([newEdge]);
        }
    } catch (error) {
        console.error("Error generating rationale:", error);
        alert(`Failed to generate rationale: ${error.message}`);
    } finally {
        isGeneratingRationaleNodeId.value = null;
    }
}


async function handleSubCanvasRun() {
  if (isSubCanvasRunning.value) return;
  isSubCanvasRunning.value = true;
  
  try {
    const userInstruction = instruction.value?.trim();
    const userGoal = goal.value?.trim();

    if (!userInstruction || !userGoal) {
      alert("Please provide both an instruction and a goal for the exploration.");
      isSubCanvasRunning.value = false;
      return;
    }

    console.log("[SubCanvas] Clearing previously generated nodes and edges.");
    const allNodes = subflow.getNodes.value;
    const allEdges = subflow.getEdges.value;

    const nodesToRemove = allNodes.filter(n =>
      n.type === 'chain' && (!n.data.isManual || n.data.isTextNode)
    );

    if (nodesToRemove.length > 0) {
        const nodeIdsToRemove = nodesToRemove.map(n => n.id);
        const edgesToRemove = allEdges.filter(e => nodeIdsToRemove.includes(e.source) || nodeIdsToRemove.includes(e.target));
        
        console.log("[SubCanvas] Removing edge IDs:", edgesToRemove.map(e => e.id));
        console.log("[SubCanvas] Removing node IDs:", nodeIdsToRemove);
        
        if (edgesToRemove.length > 0) {
          subflow.removeEdges(edgesToRemove.map(e => e.id));
        }
        subflow.removeNodes(nodeIdsToRemove);
    } else {
        console.log("[SubCanvas] No auto-generated nodes found to clear.");
    }

    const url = "/api/generate-thinking-chain";
    const payload = {
      design_background: props.designBackground,
      design_goal: props.designGoal,
      parent_node_content: props.parentNodeContent,
      parent_node_title : props.parentNodeTitle,
      instruction: userInstruction,
      goal: userGoal,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(`Server responded with ${response.status}: ${errorData.detail || response.statusText}`);
    }

    const data = await response.json();
    
    chainList.value = data.chain;
    console.log("chainList:", chainList)
    generateNodeChain(data.chain);

  } catch (error) {
    console.error("Error during sub-canvas run:", error);
    alert(`An error occurred: ${error.message}`);
  } finally {
    isSubCanvasRunning.value = false;
  }
}

const subCanvasEl = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

function onHeaderMouseDown(event) {
  if (event.target.closest('button, input, .run-button-wrapper')) return;
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
        <span class="title">✏️ {{ nodeName }}</span>
        <div class="header-actions">
           <button class="save-btn" @click="handleSaveButton" :disabled="isSaveButtonRunning" title="Save Sub-Canvas as a reusable snapshot">
            <div v-if="isSaveButtonRunning" class="spinner"></div>
            <span v-else>Save</span>
          </button>
          <button @click="emit('close')" class="close-btn" title="Close Canvas">×</button>
        </div>
      </div>
      <div class="upper-area">
        <div class="sub-canvas-fields">
          <div class="field">
            <label for="goal">Goal</label>
            <textarea id="goal" v-model="goal" @blur="onFieldBlur" :placeholder="'描述需要探索或解决什么问题'" rows="3"></textarea>
          </div>
          <div class="field">
            <label for="instruction">Instruction</label>
            <textarea id="instruction" v-model="instruction" @blur="onFieldBlur" :placeholder="'描述推理应如何展开，如线性推理、替代推理、特定视角推理或分支推理'" rows="3"></textarea>
          </div>
        </div>
        <div class="run-button-wrapper">
          <button class="run-btn" @click="handleSubCanvasRun" :disabled="isSubCanvasRunning" title="Run Sub-Canvas Logic">
            <div v-if="isSubCanvasRunning" class="spinner"></div>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
            </svg>
            <span>Run</span>
          </button>
        </div>
      </div>
      <div class="sub-canvas-content">
        <VueFlow :id="props.nodeId" v-model:nodes="nodes" v-model:edges="edges" :fit-view-on-init="true" class="sub-flow" ref="vueFlowRef">
          
          <template #node-chain="chainProps">
            <ChainNode
              v-bind="chainProps"
              @delete="subflow.removeNodes([$event])"
              @add-text-node="handleGenerateTextNode"
              @update-content="handleChainNodeContentUpdate"
              :is-generating-rationale="isGeneratingRationaleNodeId === chainProps.id"
            />
          </template>

          <Background />
          <Controls />
        </VueFlow>
      </div>
      <div class="sub-canvas-toolbar-wrapper">
        <Toolbar :is-frozen="isFrozen" :is-adding-node="isAddingNode" :is-show="isShowingRunNode" v-model:newNodeColor="newNodeColor" @toggle-freeze="toggleFreeze" @toggle-add-node-mode="toggleAddNodeMode" />
      </div>
    </div>
    <EditModal :show="isEditModalVisible" :node-data="editingNode" @close="isEditModalVisible = false" @save="handleNodeSave" />
  </div>

</template>

<style scoped>
.sub-canvas-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(44, 62, 80, 0.4);
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
}
.sub-canvas-window {
  width: 75vw;
  height: 85vh;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  position: absolute;
  border: 1px solid #dee2e6;
}
.sub-canvas-header {
  padding: 10px 20px;
  background-color: #f8f9fa;
  border-top-left-radius: 11px;
  border-top-right-radius: 11px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}
.sub-canvas-header .title {
  font-weight: 600;
  color: #343a40;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}
.close-btn {
  background: none;
  border: none;
  font-size: 26px;
  font-weight: 600;
  cursor: pointer;
  color: #adb5bd;
  transition: color 0.2s ease, transform 0.2s ease;
  padding: 0 5px;
  line-height: 1;
}
.close-btn:hover {
  color: #e74c3c;
  transform: scale(1.1);
}
.upper-area {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid #e9ecef;
}
.sub-canvas-fields {
  padding: 15px 20px;
  background-color: #fdfdfd;
  display: flex;
  flex-direction: row;
  gap: 20px;
  flex-grow: 1;
}
.field {
  width: calc(50% - 10px);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field label {
  font-weight: 600;
  font-size: 13px;
  color: #495057;
}
.field textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #ced4da;
  font-family: 'JetBrains Mono', sans-serif;
  font-size: 14px;
  resize: vertical;
  min-height: 40px;
  height : 40px;
  box-sizing: border-box;
}
.field textarea:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, .25);
}
.run-button-wrapper{
  display: flex;
  align-items: center;
  padding: 0 20px;
}
.save-btn, .run-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  height: 40px;
}
.save-btn {
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  font-weight: 500;
  min-width: 120px;
}
.save-btn:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}
.save-btn:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}
.run-btn {
  border: 1px solid #28a745;
  background-color: #28a745;
  color: white;
  min-width: 80px;
}
.run-btn:hover:not(:disabled) {
  background-color: #218838;
  border-color: #1e7e34;
}
.run-btn:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.sub-canvas-content {
  flex-grow: 1;
  position: relative;
}
.sub-flow {
  border-bottom-left-radius: 11px;
  border-bottom-right-radius: 11px;
}
.sub-canvas-toolbar-wrapper {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  overflow: hidden;
}
</style>
