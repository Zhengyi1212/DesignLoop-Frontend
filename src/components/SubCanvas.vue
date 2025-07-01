<script setup>
import { ref, watch, onUnmounted, onBeforeUnmount } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import CustomNode from './CustomNode.vue';
import RunNode from './RunNode.vue'; // Import RunNode
import EditModal from './EditModal.vue';

// --- 您可以在这里调整偏移量 ---
const GHOST_NODE_OFFSET_X = -100;
const GHOST_NODE_OFFSET_Y = -75;
// ------------------------------

// ---- Props & Emits ----
const props = defineProps({
  nodeId: { type: String, required: true },
  nodeName: { type: String, default: 'Sub-Canvas' },
  initialNodes: { type: Array, required: true },
  initialEdges: { type: Array, required: true },
  parentNodeTitle: { type: String, default: '' },
  parentNodeContent: { type: String, default: '' },
  // NEW: Receive persisted instruction and problem values
  parentNodeInstruction: { type: String, default: '' },
  parentNodeProblem: { type: String, default: '' },
});

// NEW: Add 'update:data' to emits for persistence
const emit = defineEmits(['close', 'update:graph', 'update:data']);

// ---- Local State ----
const isEditModalVisible = ref(false);
const editingNode = ref(null);
const isFrozen = ref(false);
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);
let subNodeIdCounter = 0;
const isAddingNode = ref(false);
const vueFlowRef = ref(null);
const chainList = ref(null)

const instruction = ref(props.parentNodeInstruction || '');
const problem = ref(props.parentNodeProblem || '');
const isSubCanvasRunning = ref(false);
const runningSubNodeId = ref(null); // To handle running state for nodes inside sub-canvas

const newNodeColor = ref('#34495e');

const subflow = useVueFlow({ id: props.nodeId });

// ---- "Add Node" Logic for SubCanvas ----
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

onBeforeUnmount(() => {
  const flowElement = vueFlowRef.value?.$el;
  if (flowElement) {
    flowElement.removeEventListener('click', placeNodeOnClick, true);
  }
});


// ---- Other Sub-Canvas Logic ----
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
        problem: problem.value,
    });
}

// NEW: Function to generate a chain of Run Nodes inside the sub-canvas
function generateNodeChain(nodeContents) {
  if (!Array.isArray(nodeContents) || nodeContents.length === 0) return;
  const newNodes = []; 
  const newEdges = [];
  const startX = 100; 
  const startY = 200; 
  const gapX = 250;

  nodeContents.forEach((content, index) => {
    const newNode = {
      id: `sub-run-node-${props.nodeId}-${subNodeIdCounter++}`,
      type: 'run', // Use the 'run' type
      position: { x: startX + index * gapX, y: startY },
      style: { 
        width: '200px', 
        height: '150px' 
      },
      data: {
        title: `Generated Step ${index + 1}`,
        content: content,
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

// NEW: A simple handler for when a run node *inside* the sub-canvas is clicked
async function handleSubNodeRun(nodeId) {
    const node = subflow.findNode(nodeId);
    if (!node || runningSubNodeId.value) return;

    runningSubNodeId.value = nodeId;
    const originalContent = node.data.content;
    node.data.content = 'Running...';

    try {
        const url = "http://127.0.0.1:7001/thinking-chain-node"; // Example backend endpoint
        const payload = {
            // Data from the parent node
            //parent_title: props.parentNodeTitle,
            //parent_content: props.parentNodeContent,
            // Data from the sub-canvas text fields
            instruction: instruction.value,
            problem: problem.value,
            chain : chainList,
            // Data specific to the node being run
            node_content: originalContent,
        };

        console.log(`%c[Sub-Canvas] Running node ${nodeId} with payload:`, 'color: #3498db; font-weight: bold;', payload);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Server responded with ${response.status}: ${errorData.message || 'Unknown error'}`);
        }

        const result = await response.json();
        // Assuming the backend returns a new content string in a field like 'output'
        node.data.content = result.output || 'Finished.';
        console.log(`%c[Sub-Canvas] Node ${nodeId} finished with result:`, 'color: #2ecc71;', result);

    } catch (error) {
        console.error(`Error running sub-node ${nodeId}:`, error);
        node.data.content = `Error: ${error.message}`;
    } finally {
        runningSubNodeId.value = null;
    }
}

async function handleSubCanvasRun() {
    if (isSubCanvasRunning.value) return;
    isSubCanvasRunning.value = true;

    try {
        const url = "http://127.0.0.1:7001/generate-thinking-chain";
        const payload = {
            node_title: props.parentNodeTitle,
            node_content: props.parentNodeContent,
            instruction: instruction.value,
            problem: problem.value,
            //subgraph: {
              //  nodes: subflow.getNodes.value,
                //edges: subflow.getEdges.value,
           // }
        };
         
        console.log('%c[Sub-Canvas] Running with payload:', 'color: purple; font-weight: bold;', payload);
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
        
        console.log(data)
        // MODIFIED: Call the new function with mock data after the "API call"
        chainList.value = data
        generateNodeChain(data);

    } catch (error) {
        console.error("Error during sub-canvas run:", error);
    } finally {
        isSubCanvasRunning.value = false;
    }
}


// ---- Window Dragging Logic (unchanged) ----
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
            <div class="run-button-wrapper">
                <button 
                    class="run-btn"
                    @click="handleSubCanvasRun" 
                    :disabled="isSubCanvasRunning"
                    title="Run Sub-Canvas Logic"
                >
                    <div v-if="isSubCanvasRunning" class="spinner"></div>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                    </svg>
                    <span>Run</span>
                </button>
            </div>
            <button @click="emit('close')" class="close-btn" title="Close Canvas">×</button>
        </div>
      </div>

      <div class="sub-canvas-fields">
        <div class="field">
            <label for="instruction">Instruction</label>
            <textarea id="instruction" v-model="instruction" @blur="onFieldBlur" :placeholder="'Enter instructions here...'" rows="3"></textarea>
        </div>
        <div class="field">
            <label for="problem">Problem</label>
            <textarea id="problem" v-model="problem" @blur="onFieldBlur" :placeholder="'Describe the problem here...'" rows="3"></textarea>
        </div>
      </div>

      <div class="sub-canvas-content">
        <VueFlow
            :id="props.nodeId"
            v-model:nodes="nodes"
            v-model:edges="edges"
            :fit-view-on-init="true"
            class="sub-flow"
            ref="vueFlowRef"
        >
            <template #node-custom="customProps">
              <CustomNode v-bind="customProps" @delete="subflow.removeNodes([$event])" @open-canvas="handleNodeDoubleClick" />
            </template>
            <!-- NEW: Template for rendering Run Nodes inside the sub-canvas -->
            <template #node-run="runProps">
              <RunNode v-bind="runProps" @delete="subflow.removeNodes([$event])" @run-node="handleSubNodeRun" :is-running="runningSubNodeId === runProps.id" />
            </template>
            <Background />
            <Controls />
        </VueFlow>
      </div>

      <div class="sub-canvas-toolbar-wrapper">
        <Toolbar
            :is-frozen="isFrozen"
            :is-adding-node="isAddingNode"
            v-model:newNodeColor="newNodeColor"
            @toggle-freeze="toggleFreeze"
            @toggle-add-node-mode="toggleAddNodeMode"
        />
      </div>
    </div>

    <EditModal
      :show="isEditModalVisible"
      :node-data="editingNode"
      @close="isEditModalVisible = false"
      @save="handleNodeSave"
    />
  </div>
</template>

<style scoped>
.sub-canvas-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(44, 62, 80, 0.4); z-index: 100;
    display: flex; justify-content: center; align-items: center;
}
.sub-canvas-window {
    width: 70vw; height: 80vh; background-color: white;
    border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.25);
    display: flex; flex-direction: column; position: absolute;
    border: 1px solid #dee2e6;
}
.sub-canvas-header {
    padding: 10px 20px; background-color: #f8f9fa;
    border-top-left-radius: 11px; border-top-right-radius: 11px;
    border-bottom: 1px solid #dee2e6; display: flex;
    justify-content: space-between; align-items: center;
    cursor: move; user-select: none;
}
.sub-canvas-header .title { font-weight: 600; color: #343a40; }
.header-actions {
    display: flex;
    align-items: center;
    gap: 15px;
}
.close-btn {
    background: none; border: none; font-size: 26px; font-weight: 600;
    cursor: pointer; color: #adb5bd; transition: color 0.2s ease, transform 0.2s ease;
    padding: 0 5px; line-height: 1;
}
.close-btn:hover { color: #e74c3c; transform: scale(1.1); }

.sub-canvas-fields {
    padding: 15px 20px;
    background-color: #fdfdfd;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    flex-direction: row;
    gap: 20px;
}
.field {
    width: calc(50% - 10px); 
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.field label {
    font-weight: 500;
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
    box-sizing: border-box;
}
.field textarea:focus {
    outline: none;
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.run-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 6px 14px;
    border: 1px solid #28a745;
    background-color: #28a745;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    min-width: 80px;
    height: 32px;
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
  border: 3px solid rgba(255,255,255,0.3);
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

.sub-canvas-content { flex-grow: 1; position: relative; }
.sub-flow { border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; }

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
