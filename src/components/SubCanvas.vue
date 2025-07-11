<script setup>
import { ref, watch, onUnmounted, onBeforeUnmount, onMounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import EditModal from './EditModal.vue';
import CustomEdge from './CustomEdge.vue';
// 导入 ChainNode 和新的 TextNode
import ChainNode from './ChainNode.vue';
import TextNode from './TextNode.vue'; // 1. 导入新的 TextNode 组件

const TEXT_NODE_OFFSET_Y = -120; // 调整偏移量以适应新节点

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
let subNodeIdCounter = ref(props.initialNodes.length); // 初始化计数器
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

// 新增：处理从 TextNode 传来的 rationales 更新
function handleRationalesUpdate({ nodeId, newRationales }) {
  const node = subflow.findNode(nodeId);
  if (node) {
    node.data.rationales = newRationales;
    console.log(`TextNode ${nodeId} rationales updated.`);
  }
}

// 新增：处理从 TextNode 创建新 ChainNode 的逻辑
function handleCreateNodeFromText(text, sourceTextNode) {
  if (!text || !sourceTextNode) return;

  const { position, dimensions } = sourceTextNode;
  const nodeWidth = dimensions?.width || 250; // TextNode 的宽度

  const newNode = {
    id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter.value++}`,
    type: 'chain',
    position: {
      x: position.x + nodeWidth + 60, // 放置在 TextNode 右侧
      y: position.y,
    },
    width: 120,
    height: 80,
    data: {
      content: text, // 使用传递过来的文本
      color: newNodeColor.value,
      connections: { in: [], out: [] },
      subGraph: { nodes: [], edges: [] },
      isManual: true, // 标记为手动创建
    },
  };
  subflow.addNodes([newNode]);
  console.log('Created new ChainNode from TextNode with content:', text);
}


function handleChainNodeContentUpdate({ id, content }) {
  const node = subflow.findNode(id);
  if (node) {
    node.data.content = content;
    console.log(`Node ${id} content updated.`);
  }
}

async function handleSaveButton() {
  if (isSaveButtonRunning.value) return;
  isSaveButtonRunning.value = true;

  try {
    const allNodes = subflow.getNodes.value;
    const allEdges = subflow.getEdges.value;

    const textNodeIds = new Set(
      allNodes
        .filter(n => n.type === 'text') // 过滤 TextNode
        .map(n => n.id)
    );

    const nodesForSnapshot = allNodes.filter(n =>
      n.id !== 'ghost-node' && !textNodeIds.has(n.id)
    );

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
    id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter.value++}`,
    type: 'chain',
    position: { ...ghostNode.position },
    width: 120,
    height: 80,
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
    x: position.x - 60,
    y: position.y - 40,
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
      width: 120,
      height: 80,
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
    id: `sub-node-${props.nodeId}-${subNodeIdCounter.value++}`,
    type: originalNode.type,
    position: {
      x: originalNode.position.x + 60,
      y: originalNode.position.y + 40,
    },
    width: originalNode.width,
    height: originalNode.height,
    style: originalNode.style ? { ...originalNode.style } : undefined,
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

function onSubCanvasConnect(params) {
  const newEdge = {
    ...params,
    type: 'custom',
    data: { animated: true, pathType: 'smoothstep' } // SubCanvas 中手动连接默认用 smoothstep
  };
  subflow.addEdges([newEdge]);
}

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
    return;
  }
  const newNodes = [];
  const newEdges = [];
  const startX = 100;
  const startY = 200;
  const gapX = 250;

  nodeDataList.forEach((element, index) => {
    const content = element || '';
    const newNode = {
      id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter.value++}`,
      type: 'chain',
      position: { x: startX + index * gapX, y: startY },
      width: 120,
      height: 80,
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
      data: { animated: true, pathType: 'bezier' } 
    };
    newEdges.push(newEdge);
  }
  subflow.addNodes(newNodes);
  subflow.addEdges(newEdges);
}

function findDirectPredecessorsWithText(startNodeId, allNodes, allEdges) {
    const directPredecessors = [];
    for (const edge of allEdges) {
        if (edge.target === startNodeId) {
            const predNode = allNodes.find(n => n.id === edge.source);
            if (predNode && predNode.type !== 'text') { // 确保前驱不是 TextNode
                directPredecessors.push(predNode);
            }
        }
    }

    if (directPredecessors.length === 0) {
        return [];
    }

    const results = directPredecessors.map(predNode => {
        let foundTextNodeContent = '';
        // 寻找与前驱节点直接相连的 TextNode
        for (const edge of allEdges) {
            let connectedNodeId = null;
            if (edge.source === predNode.id) {
                connectedNodeId = edge.target;
            } else if (edge.target === predNode.id) {
                connectedNodeId = edge.source;
            }
            
            if (connectedNodeId && connectedNodeId !== startNodeId) {
                const connectedNode = allNodes.find(n => n.id === connectedNodeId);
                // 检查连接的节点是否是我们想要的 TextNode
                if (connectedNode && connectedNode.type === 'text') {
                    // 由于 TextNode 的内容是数组，这里我们先返回一个提示
                    foundTextNodeContent = `[Rationale List with ${connectedNode.data.rationales?.length || 0} items]`;
                    break;
                }
            }
        }
        return {
            node_content: predNode.data.content,
            text_content: foundTextNodeContent,
        };
    });
    return results;
}


// =================================================================
// 2. 重构 handleGenerateTextNode 函数
// =================================================================
async function handleGenerateTextNode({ sourceNodeId, position }) {
    const sourceNode = subflow.findNode(sourceNodeId);
    if (!sourceNode || isGeneratingRationaleNodeId.value) return;

    isGeneratingRationaleNodeId.value = sourceNodeId;
    try {
        const predecessors = findDirectPredecessorsWithText(sourceNodeId, subflow.getNodes.value, subflow.getEdges.value);
        const formattedChain = (chainList.value || []).map(item => ({ content: item }));
        const payload = {
            parent_node_title: props.parentNodeTitle,
            parent_node_content: props.parentNodeContent,
            goal: goal.value,
            instruction: instruction.value,
            current_node_content: sourceNode.data.content,
            chain: formattedChain,
            predecessor_chain: predecessors,
            design_background: props.designBackground,
            design_goal: props.designGoal
        };

        const response = await fetch('http://localhost:7001/generate-rationale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch' }));
            throw new Error(errorData.detail);
        }
        const data = await response.json();
        
        // 使用正则表达式去除每个字符串中的 [], {} 符号
        //.map(item => item.text.replace(/[\[\]{}]/g, ''))
        const rationaleList = data.rationale;
        if (!Array.isArray(rationaleList) || rationaleList.length === 0) {
            console.log("API did not return a valid list of rationales.");
            return;
        }

        
        const headerHeight = 35;      // 节点头部的大约高度
        const itemPaddingY = 24;      // 每个文本块上下的内边距总和
        const itemGapY = 8;           // 文本块之间的间距
        const avgCharsPerLine = 35;   // 在当前宽度下，每行大约能容纳的字符数
        const lineHeight = 16;        // 文本行高

        let totalContentHeight = 0;
        rationaleList.forEach(text => {
            const lineCount = Math.ceil((text.length || 1) / avgCharsPerLine);
            totalContentHeight += (lineCount * lineHeight) + itemPaddingY + itemGapY;
        });
        
        // 最终高度 = 头部高度 + 内容总高度，并设置一个最大和最小限制
        const calculatedHeight = headerHeight + totalContentHeight;
        const finalHeight = Math.min(Math.max(calculatedHeight, 150), 500); // 最小150px, 最大500px


        const existingTextNodeId = sourceNode.data.generatedRationaleNodeId;
        const existingTextNode = existingTextNodeId ? subflow.findNode(existingTextNodeId) : null;

        if (existingTextNode) {
            // 如果已存在 TextNode，则更新其内容和高度
            existingTextNode.data.rationales = rationaleList;
            existingTextNode.dimensions.height = finalHeight;
        } else {
            // 如果不存在，则创建一个新的 TextNode 容器
            const newTextNode = {
                id: `sub-text-node-${props.nodeId}-${subNodeIdCounter.value++}`,
                type: 'text', // 使用新的节点类型 'text'
                position: { x: position.x, y: position.y + TEXT_NODE_OFFSET_Y },
                width: 250,
                height: finalHeight, // 使用计算出的高度
                data: {
                    rationales: rationaleList, // 将整个列表传递给 data
                },
            };
            const newEdge = {
                id: `sub-content-edge-${newTextNode.id}-to-${sourceNode.id}`,
                source: newTextNode.id,
                target: sourceNode.id,
                sourceHandle: 'bottom', // 从 TextNode 顶部连接
                targetHandle: 'top', // 连接到 ChainNode 底部
                type: 'smoothstep',
                animated: true,
            };
            // 在源节点中存储新创建的 TextNode 的 ID
            sourceNode.data.generatedRationaleNodeId = newTextNode.id;
            subflow.addNodes([newTextNode]);
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

    const allNodes = subflow.getNodes.value;
    const allEdges = subflow.getEdges.value;

    // 同时移除旧的 text node 和 chain node
    const nodesToRemove = allNodes.filter(n =>
      (n.type === 'chain' && !n.data.isManual) || n.type === 'text'
    );

    if (nodesToRemove.length > 0) {
        const nodeIdsToRemove = nodesToRemove.map(n => n.id);
        const edgesToRemove = allEdges.filter(e => nodeIdsToRemove.includes(e.source) || nodeIdsToRemove.includes(e.target));
        
        if (edgesToRemove.length > 0) {
          subflow.removeEdges(edgesToRemove.map(e => e.id));
        }
        subflow.removeNodes(nodeIdsToRemove);
    }

    const url = "http://localhost:7001/generate-thinking-chain";
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
    generateNodeChain(data.chain);

  } catch (error) {
    console.error("Error during sub-canvas run:", error);
    alert(`An error occurred: ${error.message}`);
  } finally {
    isSubCanvasRunning.value = false;
  }
}
function onEdgeDeleteInSubCanvas(edgeId) {
    subflow.removeEdges([edgeId]);
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
          <button @click="emit('close')"  class="close-btn" title="Close Canvas">×</button>
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
        <VueFlow 
        :id="props.nodeId" 
        v-model:nodes="nodes" 
        v-model:edges="edges" 
        :fit-view-on-init="true" 
        class="sub-flow" 
        ref="vueFlowRef"
        @connect="onSubCanvasConnect"
        
        >
          
          <!-- ChainNode 模板 -->
          <template #node-chain="chainProps">
            <ChainNode
              v-bind="chainProps"
              @delete="subflow.removeNodes([$event])"
              @add-text-node="handleGenerateTextNode"
              @update-content="handleChainNodeContentUpdate"
              :is-generating-rationale="isGeneratingRationaleNodeId === chainProps.id"
            />
          </template>

          <template #edge-custom="props">
              <CustomEdge v-bind="props" @delete-edge="onEdgeDeleteInSubCanvas" />
          </template>
          <template #node-text="textProps">
            <TextNode
              v-bind="textProps"
              @update:rationales="handleRationalesUpdate"
              @create-node-from-text="handleCreateNodeFromText($event, textProps)"
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
  width: 85vw;
  height: 90vh;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  position: absolute;
  border: 1px solid #dee2e6;
}
.sub-canvas-header {
  padding: 6px 12px;
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
  font-size: 11px;
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
.run-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  height: 40px;
}
.save-btn, .run-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  height: 30px;
}
.save-btn {
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  font-weight: 300;
  width: 60px;
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
  height: 8%;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  overflow: hidden;
}
</style>
