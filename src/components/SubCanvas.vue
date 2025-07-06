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
// NEW: Define vertical offset for the generated text node
const TEXT_NODE_OFFSET_Y = -120;

// ---- Props & Emits ----
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
});

// MODIFIED: Added 'save-snapshot' to the list of emitted events.
const emit = defineEmits(['close', 'update:graph', 'update:data', 'save-snapshot']);

// ---- Local State ----
const isEditModalVisible = ref(false);
const editingNode = ref(null);
const isFrozen = ref(false);
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);
let subNodeIdCounter = 0;
const isAddingNode = ref(false);
const isShowingRunNode = ref(false);
const vueFlowRef = ref(null);
const chainList = ref(null)

const instruction = ref( props.parentNodeInstruction || '');
const goal = ref(props.parentNodeGoal || '');
const isSubCanvasRunning = ref(false);
const isSaveButtonRunning = ref(false)
const runningSubNodeId = ref(null);

const newNodeColor = ref('#34495e');

const subflow = useVueFlow({ id: props.nodeId });

// ---- Logic (Mostly Unchanged) ----

async function handleSaveButton() {
  if (isSaveButtonRunning.value) return;
  isSaveButtonRunning.value = true;

  try {
    const snapshotPayload = {
      title: `Version of: ${goal.value || 'Untitled'}`,
      data: {
        instruction: instruction.value,
        goal: goal.value,
        subGraph: {
          // MODIFIED: Filter out the temporary 'ghost-node' before saving.
          nodes: JSON.parse(JSON.stringify(subflow.getNodes.value.filter(n => n.id !== 'ghost-node'))),
          edges: JSON.parse(JSON.stringify(subflow.getEdges.value)),
        }
      }
    };
    // Emit the 'save-snapshot' event to be caught by App.vue
    emit('save-snapshot', snapshotPayload);
    console.log('Sub-canvas state snapshot emitted successfully!');
  } catch (error) {
    console.error("Error creating sub-canvas snapshot:", error);
  } finally {
    isSaveButtonRunning.value = false;
  }
}

// ... (All other functions from your original file remain here, unchanged)
function placeNodeOnClick(event) {
  if (!isAddingNode.value || event.target.closest('.vue-flow__controls')) {
    return;
  }
  const ghostNode = subflow.findNode('ghost-node');
  if (!ghostNode) return;

  const newNode = {
    id: `sub-node-${props.nodeId}-${subNodeIdCounter++}`,
    type: 'custom',
    position: { ...ghostNode.position },
    data: {
      title: 'New Sub-Node',
      content: 'This is a node in a sub-canvas',
      color: newNodeColor.value,
      connections: { in: [], out: [] },
      subGraph: { nodes: [], edges: [] },
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
    x: position.x + GHOST_NODE_OFFSET_X,
    y: position.y + GHOST_NODE_OFFSET_Y,
  };
  const ghostNode = subflow.findNode('ghost-node');
  if (ghostNode) {
    ghostNode.position = adjustedPosition;
    ghostNode.data.color = newNodeColor.value;
  } else {
    subflow.addNodes([{
      id: 'ghost-node',
      type: 'custom',
      position: adjustedPosition,
      data: {
        title: 'New Node',
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
  if (!Array.isArray(nodeDataList) || nodeDataList.length === 0) return;
  const newNodes = [];
  const newEdges = [];
  const startX = 100;
  const startY = 200;
  const gapX = 250;

  nodeDataList.forEach((element, index) => {
    // Extract the value from the 'step_summary' key for the node's content.
    const content = element.step_summary || '';

    const newNode = {
      id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter++}`,
      type: 'chain',
      position: { x: startX + index * gapX, y: startY },
      width: 200,
      height: 100,
      data: {
        content: content,
        connections: { in: [], out: [] },
        subGraph: { nodes: [], edges: [] },
        detailed_explanation: element.detailed_explanation
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
  subflow.addNodes(newNodes);
  subflow.addEdges(newEdges);
}

function handleGenerateTextNode({ sourceNodeId, position }) {
    const sourceNode = subflow.findNode(sourceNodeId);
    if (!sourceNode) return;

    // --- NEW: Prevent creating a duplicate content node ---
    if (sourceNode.data.generatedContentNodeId && subflow.findNode(sourceNode.data.generatedContentNodeId)) {
        console.log("Content node already exists.");
        return; // Exit if the content node has already been created
    }
    // ---

    const contentNode = {
        id: `sub-text-node-${props.nodeId}-${subNodeIdCounter++}`,
        type: 'chain',
        position: {
            x: position.x - 50, // Center the larger node over the smaller one
            y: position.y + TEXT_NODE_OFFSET_Y - 50, // Adjust vertical position further
        },
        // Make the new node larger
        width: 300,
        height: 160,
        data: {
            // Use the stored fullContent
            content: sourceNode.data.detailed_explanation,
            isTextNode: true, // Flag for different styling
            connections: { in: [], out: [] },
            subGraph: { nodes: [], edges: [] },
        },
    };

    // --- NEW: Create an edge to link the new node to its source ---
    const newEdge = {
        id: `sub-content-edge-${contentNode.id}-to-${sourceNode.id}`,
        // Note: The edge goes FROM the new content node TO the original summary node
        source: contentNode.id,
        target: sourceNode.id,
        sourceHandle: 'bottom', // From the bottom of the new content node
        targetHandle: 'top',   // To the top of the original summary node
        type: 'custom',
        animated: true,
    };
    // ---

    // Update the source node to track its content node
    sourceNode.data.generatedContentNodeId = contentNode.id;

    // Add the new node and the new edge to the canvas
    subflow.addNodes([contentNode]);
    subflow.addEdges([newEdge]);
}

async function handleSubCanvasRun() {
  if (isSubCanvasRunning.value) return;
  isSubCanvasRunning.value = true;
  
  try {
    const userInstruction = instruction.value?.trim();
    const userGoal = goal.value?.trim();

    if (!userInstruction || !userGoal) {
      alert("Please provide both an instruction and a goal for the exploration.");
      return; // Stop the execution
    }

    // --- NEW: Logic to remove previously generated chain nodes and text nodes ---
    const nodesToRemove = subflow.getNodes.value.filter(n => 
        n.id.startsWith('sub-chain-node-') || n.id.startsWith('sub-text-node-')
    );
    if (nodesToRemove.length > 0) {
        subflow.removeNodes(nodesToRemove.map(n => n.id));
    }
    // --- End of new logic ---

    const url = "http://127.0.0.1:7001/generate-thinking-chain";
    const payload = {
      design_background: props.designBackground,
      design_goal: props.designGoal,
      node_title: props.parentNodeTitle,
      node_content: props.parentNodeContent,
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
    chainList.value = data;
    generateNodeChain(data);

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
          <template #node-custom="customProps">
            <CustomNode v-bind="customProps" @delete="subflow.removeNodes([$event])" @open-canvas="handleNodeDoubleClick" />
          </template>
          <template #node-run="runProps">
            <RunNode v-bind="runProps" @delete="subflow.removeNodes([$event])" @run-node="handleSubNodeRun" :is-running="runningSubNodeId === runProps.id" />
          </template>
          <template #node-chain="chainProps">
            <ChainNode
              v-bind="chainProps"
              @delete="subflow.removeNodes([$event])"
              @add-text-node="handleGenerateTextNode"
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
.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  min-width: 120px;
  height: 40px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #28a745;
  background-color: #28a745;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  min-width: 80px;
  height: 40px;
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
