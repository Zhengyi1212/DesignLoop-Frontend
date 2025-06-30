<script setup>
import { ref, watch, onUnmounted, onBeforeUnmount } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import CustomNode from './CustomNode.vue';
import EditModal from './EditModal.vue';

// ---- Props & Emits ----
const props = defineProps({
  nodeId: { type: String, required: true },
  nodeName: { type: String, default: 'Sub-Canvas' },
  initialNodes: { type: Array, required: true },
  initialEdges: { type: Array, required: true },
});

const emit = defineEmits(['close', 'update:graph']);

// ---- Local State ----
const isEditModalVisible = ref(false);
const editingNode = ref(null);
const isFrozen = ref(false);
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);
let subNodeIdCounter = 0;
const isAddingNode = ref(false);
const vueFlowRef = ref(null);

// ---- New Feature: Color Picker state for SubCanvas ----
const newNodeColor = ref('#34495e'); // Default color for nodes in this subcanvas

// Get the entire scoped instance to prevent reference errors
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
    // Pass the subcanvas's specific color to the new node
    data: {
      title: 'New Sub-Node',
      content: 'This is a node in a sub-canvas',
      color: newNodeColor.value, // Use the subcanvas's color
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

// Update ghost node with the subcanvas's selected color
subflow.onPaneMouseMove((event) => {
  if (!isAddingNode.value) return;
  const position = subflow.project({ x: event.clientX, y: event.clientY });
  const ghostNode = subflow.findNode('ghost-node');

  if (ghostNode) {
    ghostNode.position = position;
    ghostNode.data.color = newNodeColor.value; // Update color in real-time
  } else {
    subflow.addNodes([{
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

watch([() => props.initialNodes, () => props.initialEdges], () => {
    nodes.value = props.initialNodes;
    edges.value = props.initialEdges;
});

watch([subflow.nodes, subflow.edges], () => {
    emit('update:graph', {
        nodeId: props.nodeId,
        nodes: subflow.getNodes.value,
        edges: subflow.getEdges.value
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

// ---- Window Dragging Logic (unchanged) ----
const subCanvasEl = ref(null);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

function onHeaderMouseDown(event) {
    if (event.target.classList.contains('close-btn')) return;
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
        <span class="title">✏️ Editing Sub-Canvas: {{ nodeName }}</span>
        <button @click="emit('close')" class="close-btn" title="Close Canvas">×</button>
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
            <Background />
            <Controls />
        </VueFlow>
      </div>

      <div class="sub-canvas-toolbar-wrapper">
        <!-- The Toolbar now gets the subcanvas's own color state -->
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
    padding: 12px 20px; background-color: #f8f9fa;
    border-top-left-radius: 11px; border-top-right-radius: 11px;
    border-bottom: 1px solid #dee2e6; display: flex;
    justify-content: space-between; align-items: center;
    cursor: move; user-select: none;
}
.sub-canvas-header .title { font-weight: 600; color: #343a40; }
.close-btn {
    background: none; border: none; font-size: 26px; font-weight: 600;
    cursor: pointer; color: #adb5bd; transition: color 0.2s ease, transform 0.2s ease;
    padding: 0 5px;
}
.close-btn:hover { color: #e74c3c; transform: scale(1.1); }
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
