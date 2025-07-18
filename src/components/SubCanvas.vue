<script setup>
import { ref, watch, onUnmounted, onBeforeUnmount, onMounted, defineAsyncComponent, nextTick } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import Toolbar from './Toolbar.vue';
import EditModal from './EditModal.vue';
import CustomEdge from './CustomEdge.vue';
import ChainNode from './ChainNode.vue';
import TextNode from './TextNode.vue';

// 1. 异步加载 GroupNode 组件
const GroupNode = defineAsyncComponent(() => import('./GroupNode.vue'));
const RatingNode = defineAsyncComponent(() => import('./RatingNode.vue'));

const TEXT_NODE_OFFSET_Y = -280;

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
  userId: { type: String, required: true },
  isSaved: {type: Boolean, default: false}
});

const emit = defineEmits(['close', 'update:graph', 'update:data', 'save-snapshot']);

const isEditModalVisible = ref(false);
const editingNode = ref(null);
//const isFrozen = ref(false);
const nodes = ref(props.initialNodes);
const edges = ref(props.initialEdges);
let subNodeIdCounter = ref(props.initialNodes.length > 0 ? Math.max(...props.initialNodes.map(n => parseInt(n.id.split('-').pop()) || 0)) + 1 : 0);
const isAddingNode = ref(false);
const isAddingGroup = ref(false); 
const isShowingRunNode = ref(false);
const vueFlowRef = ref(null);
const chainList = ref(null || props.initialChainList)

const instruction = ref( props.parentNodeInstruction || '');
const goal = ref(props.parentNodeGoal || '');
const isSubCanvasRunning = ref(false);
const isSaveButtonRunning = ref(false);
const isSaved = ref(props.isSaved)

const runBtnRef = ref(null);
const newNodeColor = ref('#fffffff');

const isGeneratingRationaleNodeId = ref(null);

const subflow = useVueFlow({ id: props.nodeId });


function handleRatingClose(nodeId) {
  subflow.removeNodes([nodeId]);
}


async function handleRatingSubmit(payload) {
  console.log('Submitting SubCanvas rating to backend:', payload);

  try {
    const response = await fetch("/api/submit-rating-subcanvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ratings: payload.ratings,
        instruction: payload.context.instruction,
        goal: payload.context.goal,
        chainList: payload.context.chainList,
        user_id: props.userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Backend response:', responseData);

  } catch (error) {
    console.error("Failed to submit SubCanvas rating:", error);
  } finally {
    subflow.removeNodes([payload.nodeId]);
  }
}


function handleShowSubCanvasRating() {
    if (!vueFlowRef.value) return;
    const { x, y, zoom } = subflow.getViewport();
    const { width } = vueFlowRef.value.dimensions;
    const ratingNodeWidth = 260;
    const padding = 20;
    const position = {
        x: x + (width / zoom) - ratingNodeWidth - padding*2,
        y: y + padding
    };
    subflow.addNodes([{
        id: `rating-subcanvas-${props.nodeId}`,
        type: 'rating',
        position,
        data: {
            context: {
                instruction: instruction.value,
                goal: goal.value,
                chainList: chainList.value,
            }
        },
        zIndex: 1000,
        draggable: true,
        selectable: false,
    }]);
}

// ✨ 新增: 用于处理 TextNode 数据更新的通用函数
function handleNodeDataUpdate({ id, data }) {
  const node = subflow.findNode(id);
  if (node) {
    // 使用合并的方式更新数据，以保留可能存在的其他未传回的属性
    node.data = { ...node.data, ...data };
    isSaved.value = false; // 将画布标记为有未保存的更改
  }
}

async function handleTextNodeSendData({ id, title, rationales, parent_content }) {
  console.log("Received data from TextNode for regeneration:", { id, title, rationales, parent_content });

  // 1. 查找需要更新的目标节点
  const nodeToUpdate = subflow.findNode(id);
  if (!nodeToUpdate) {
    console.error(`Failed to find node with ID: ${id}`);
    alert(`操作失败：未找到目标节点。`);
    return;
  }
  
  // 2. 构造发送到后端的完整载荷
  const payload = {
    parent_content,
    title,
    rationales,
    instruction: instruction.value,
    goal: goal.value,
    user_id: props.userId, 
    design_background: props.designBackground,
    design_goal: props.designGoal,
    parent_node_content: props.parentNodeContent,
    parent_node_title:props.parentNodeTitle
  };

  console.log("Preparing to send payload to backend:", payload);

  try {
    // 3. 发送请求到后端
    const response = await fetch("/api/textnode-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Successfully received data from backend:', responseData);

    // 4. 解析后端返回的数据 (逻辑复用自 handleGenerateTextNode)
    const dataString = JSON.stringify(responseData.rationale);
    const regex = /"([^"]+)"|'([^']+)'/g;
    let matches;
    const extractedBlocks = [];

    while ((matches = regex.exec(dataString)) !== null) {
      const content = matches[1] || matches[2];
      extractedBlocks.push(content);
    }
    const newRationaleList = extractedBlocks.filter(block => block.length > 15);

    if (newRationaleList.length === 0) {
      console.warn(`No valid new rationales were found in the response.`);
      alert('未从后端获取到有效的新论据。');
      return;
    }
    
    // 5. 将新的论据追加到现有节点的 rationales 数组中
    if (!Array.isArray(nodeToUpdate.data.rationales)) {
      nodeToUpdate.data.rationales = [];
    }
    nodeToUpdate.data.rationales.push(...newRationaleList);

    // 6. 重新计算并更新节点的高度 (逻辑复用自 handleGenerateTextNode)
    const headerHeight = 35; const itemPaddingY = 24; const itemGapY = 8;
    const avgCharsPerLine = 35; const lineHeight = 16;
    let totalContentHeight = 0;
    
    nodeToUpdate.data.rationales.forEach(text => {
      const lineCount = Math.ceil((text.length || 1) / avgCharsPerLine);
      totalContentHeight += (lineCount * lineHeight) + itemPaddingY + itemGapY;
    });
    
    const calculatedHeight = headerHeight + totalContentHeight;
    const finalHeight = Math.min(Math.max(calculatedHeight, 150), 600);

    // 确保 dimensions 对象存在
    if (!nodeToUpdate.dimensions) {
      nodeToUpdate.dimensions = { width: nodeToUpdate.width || 250, height: 0 };
    }
    nodeToUpdate.dimensions.height = finalHeight;

    // 7. 将画布标记为有未保存的更改
    isSaved.value = false;
    
    //alert('新的论据已成功追加！');

  } catch (error) {
    console.error("Failed to send or process TextNode data:", error);
    alert(`处理数据时出错: ${error.message}`);
  }
}

// ✨ Major Refactor: 此函数现在创建 TextNode 而不是 ChainNode
function handleCreateNodeFromText(text, sourceTextNode) {
  if (!text || !sourceTextNode) return;

  const { position, dimensions } = sourceTextNode;
  const nodeWidth = dimensions?.width || 250;
  
  const newNode = {
    // 1. ID 和类型已更新为 'text'
    id: `sub-text-node-${props.nodeId}-${subNodeIdCounter.value++}`,
    type: 'text',
    
    // 2. 将新节点放置在源节点旁边，以获得良好的用户体验
    position: { x: position.x + nodeWidth + 60, y: position.y },
    
    // 3. 为新的 TextNode 设置合理的默认尺寸
    width: 400,
    height: sourceTextNode.height,
    
    // 4. 将传入的文本作为新节点的第一个 rationale 项
    data: { rationales: [text] },
  };

  subflow.addNodes([newNode]);
}


watch(chainList, (newChainList) => {
    emit('update:data', {
        nodeId: props.nodeId,
        instruction: instruction.value,
        goal: goal.value,
        chain: newChainList,
    });
}, { deep: true });

function handleChainNodeContentUpdate({ id, content }) {
  const node = subflow.findNode(id);
  if (node) {
    node.data.content = content;
  }
}

async function handleSaveButton() {
  if (isSaveButtonRunning.value) return;
  isSaveButtonRunning.value = true;
  try {
    const allNodes = subflow.getNodes.value;
    const allEdges = subflow.getEdges.value;
    const textNodeIds = new Set(allNodes.filter(n => n.type === 'text').map(n => n.id));
    const nodesForSnapshot = allNodes.filter(n => n.id !== 'ghost-node' && !textNodeIds.has(n.id) && n.type !== 'rating');
    const edgesForSnapshot = allEdges.filter(e => !textNodeIds.has(e.source) && !textNodeIds.has(e.target));
    const snapshotPayload = {
      parentNodeId: props.nodeId,
      parentNodeTitle: props.parentNodeTitle,
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
    isSaved.value = true;
  } catch (error) {
    console.error("Error creating sub-canvas snapshot:", error);
  } finally {
    isSaveButtonRunning.value = false;
  }
}

// 2. 将添加节点/分组的逻辑集中管理
function setAddMode(mode) {
    isAddingNode.value = mode === 'node';
    isAddingGroup.value = mode === 'group';
    updateEventListeners();
}

function toggleAddNodeMode() { setAddMode(isAddingNode.value ? null : 'node'); }
function toggleAddGroupMode() { setAddMode(isAddingGroup.value ? null : 'group'); }

function updateEventListeners() {
    const flowElement = vueFlowRef.value?.$el;
    if (!flowElement) return;
    flowElement.removeEventListener('click', placeNodeOnClick, true);
    if (isAddingNode.value || isAddingGroup.value) {
        flowElement.addEventListener('click', placeNodeOnClick, true);
    } else {
        subflow.removeNodes(['ghost-node']);
    }
}

subflow.onPaneMouseMove((event) => {
  // 3. 更新 onPaneMouseMove 以处理分组预览
  if (!isAddingNode.value && !isAddingGroup.value) return;

  const flowRect = vueFlowRef.value.$el.getBoundingClientRect();
  const relativeMousePos = { x: event.clientX - flowRect.left, y: event.clientY - flowRect.top };
  const position = subflow.project(relativeMousePos);

  const ghostNode = subflow.findNode('ghost-node');
  let ghostType = 'chain';
  let ghostData = {};
  let ghostDimensions = { width: 120, height: 80 };
  let ghostPosition = { x: position.x - ghostDimensions.width / 2, y: position.y - ghostDimensions.height / 2 };


  if (isAddingGroup.value) {
      ghostType = 'group';
      ghostData = { label: 'Group', color: newNodeColor.value };
      ghostDimensions = { width: 380, height: 260 };
      ghostPosition = { x: position.x - ghostDimensions.width / 2, y: position.y - ghostDimensions.height / 2 };
  } else { // isAddingNode
      ghostType = 'chain';
      ghostData = { content: 'Click to place', color: newNodeColor.value, isManual: true };
      ghostDimensions = { width: 120, height: 80 };
      ghostPosition = { x: position.x - ghostDimensions.width / 2, y: position.y - ghostDimensions.height / 2 };
  }


  if (ghostNode) {
    ghostNode.position = ghostPosition;
    ghostNode.data = ghostData;
    ghostNode.type = ghostType;
    ghostNode.width = ghostDimensions.width;
    ghostNode.height = ghostDimensions.height;
  } else {
    subflow.addNodes([{
      id: 'ghost-node', type: ghostType, position: ghostPosition, ...ghostDimensions,
      data: ghostData, class: 'ghost-node',
    }]);
  }
});


function placeNodeOnClick(event) {
  // 4. 更新 placeNodeOnClick 以创建分组节点
  if (event.target.closest('.vue-flow__controls, .tool-button')) return;
  const ghostNode = subflow.findNode('ghost-node');
  if (!ghostNode) return;

  let newNode;
  const baseNode = {
      id: `sub-node-${props.nodeId}-${subNodeIdCounter.value++}`,
      position: { ...ghostNode.position },
      data: { color: newNodeColor.value }
  };

  if (isAddingGroup.value) {
      newNode = {
          ...baseNode,
          type: 'group',
          zIndex: 0,
          width: 400,
          height: 300,
          data: { ...baseNode.data, label: 'My Group' }
      };
  } else if (isAddingNode.value) {
      newNode = {
          ...baseNode,
          type: 'chain',
          width: 120,
          height: 60,
          data: { ...baseNode.data, content: '', connections: { in: [], out: [] }, subGraph: { nodes: [], edges: [] }, isManual: true },
      };
  }

  if(newNode) {
    subflow.addNodes([newNode]);
  }
  
  nextTick(() => { setAddMode(null); });
}


function handleDuplicateSubNode() {
  const selectedNodes = subflow.getSelectedNodes.value;
  if (selectedNodes.length !== 1) return;
  const originalNode = selectedNodes[0];
  if (originalNode.id === 'ghost-node') return;
  const newNode = {
    id: `sub-node-${props.nodeId}-${subNodeIdCounter.value++}`,
    type: originalNode.type,
    position: { x: originalNode.position.x + 60, y: originalNode.position.y + 40 },
    width: originalNode.width, height: originalNode.height,
    style: originalNode.style ? { ...originalNode.style } : undefined,
    data: { ...JSON.parse(JSON.stringify(originalNode.data)), connections: { in: [], out: [] } },
  };
  subflow.addNodes([newNode]);
}

function handleKeyDown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleDuplicateSubNode();
  }
}

onMounted(() => { window.addEventListener('keydown', handleKeyDown); });
onBeforeUnmount(() => {
  const flowElement = vueFlowRef.value?.$el;
  if (flowElement) { flowElement.removeEventListener('click', placeNodeOnClick, true); }
  window.removeEventListener('keydown', handleKeyDown);
});

function onSubCanvasConnect(params) {
  const newEdge = { ...params, type: 'custom', data: { animated: true, pathType: 'smoothstep' } };
  subflow.addEdges([newEdge]);
}

watch([subflow.nodes, subflow.edges], () => {
  emit('update:graph', {
    nodeId: props.nodeId,
    nodes: subflow.getNodes.value.filter(n => n.type !== 'rating'),
    edges: subflow.getEdges.value,
    isSaved : isSaved.value
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
  if (!subflow) return;
  if (!Array.isArray(nodeDataList) || nodeDataList.length === 0) return;
  const newNodes = []; const newEdges = [];
  const startX = 100; const startY = 200; const gapX = 250;
  nodeDataList.forEach((element, index) => {
    const content = element || '';
    const newNode = {
      id: `sub-chain-node-${props.nodeId}-${subNodeIdCounter.value++}`, type: 'chain',
      position: { x: startX + index * gapX, y: startY }, width: 120, height: 70,
      data: { content: content, connections: { in: [], out: [] } },
    };
    newNodes.push(newNode);
  });
  for (let i = 1; i < newNodes.length; i++) {
    const sourceNode = newNodes[i - 1]; const targetNode = newNodes[i];
    const newEdge = {
      id: `sub-chain-edge-${sourceNode.id}-to-${targetNode.id}`, source: sourceNode.id, target: targetNode.id,
      sourceHandle: 'right', targetHandle: 'left', type: 'custom', data: { animated: true, pathType: 'bezier' }
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
            if (predNode && predNode.type !== 'text') {
                directPredecessors.push(predNode);
            }
        }
    }
    if (directPredecessors.length === 0) return [];
    const results = directPredecessors.map(predNode => {
        let foundTextNodeContent = '';
        for (const edge of allEdges) {
            let connectedNodeId = null;
            if (edge.source === predNode.id) connectedNodeId = edge.target;
            else if (edge.target === predNode.id) connectedNodeId = edge.source;
            if (connectedNodeId && connectedNodeId !== startNodeId) {
                const connectedNode = allNodes.find(n => n.id === connectedNodeId);
                if (connectedNode && connectedNode.type === 'text') {
                    foundTextNodeContent = `[Rationale List with ${connectedNode.data.rationales?.length || 0} items]`;
                    break;
                }
            }
        }
        return { node_content: predNode.data.content, text_content: foundTextNodeContent };
    });
    return results;
}

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

        const response = await fetch('/api/generate-rationale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch or parse error response' }));
            throw new Error(errorData.detail);
        }

        const data = await response.json();
        const dataString = JSON.stringify(data.rationale);
        const regex = /"([^"]+)"|'([^']+)'/g;
        let matches;
        const extractedBlocks = [];

        while ((matches = regex.exec(dataString)) !== null) {
            const content = matches[1] || matches[2];
            extractedBlocks.push(content);
        }
        const rationaleList = extractedBlocks.filter(block => block.length > 15);

        if (rationaleList.length === 0) {
            console.warn(`No text blocks longer than 15 characters were found inside single or double quotes. Total blocks extracted: ${extractedBlocks.length}`);
            return;
        }

        const headerHeight = 35; const itemPaddingY = 24; const itemGapY = 8;
        const avgCharsPerLine = 35; const lineHeight = 16;
        let totalContentHeight = 0;
        rationaleList.forEach(text => {
            const lineCount = Math.ceil((text.length || 1) / avgCharsPerLine);
            totalContentHeight += (lineCount * lineHeight) + itemPaddingY + itemGapY;
        });
        const calculatedHeight = headerHeight + totalContentHeight;
        const finalHeight = Math.min(Math.max(calculatedHeight, 150), 600);

        const existingTextNodeId = sourceNode.data.generatedRationaleNodeId;
        const existingTextNode = existingTextNodeId ? subflow.findNode(existingTextNodeId) : null;

        if (existingTextNode) {
            existingTextNode.data.rationales = rationaleList;
            existingTextNode.data.parent_content = sourceNode.data.content
            console.log(sourceNode.data.content)
            if (!existingTextNode.dimensions) existingTextNode.dimensions = { width: 250, height: 0 };
            existingTextNode.dimensions.height = finalHeight;
        } else {
            const newTextNode = {
                id: `sub-text-node-${props.nodeId}-${subNodeIdCounter.value++}`, type: 'text',
                position: { x: position.x, y: position.y + TEXT_NODE_OFFSET_Y },
                width: 250, height: finalHeight, 
                
                data: { rationales: rationaleList,
                  parent_content : sourceNode.data.content
                 },
            };
            console.log(sourceNode.data.content)
            const newEdge = {
                id: `sub-content-edge-${newTextNode.id}-to-${sourceNode.id}`, source: newTextNode.id, target: sourceNode.id,
                sourceHandle: 'bottom', targetHandle: 'top', type: 'smoothstep', animated: true,
            };
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
    const nodesToRemove = allNodes.filter(n => (n.type === 'chain' && !n.data.isManual) || n.type === 'text');
    if (nodesToRemove.length > 0) {
        const nodeIdsToRemove = nodesToRemove.map(n => n.id);
        const edgesToRemove = allEdges.filter(e => nodeIdsToRemove.includes(e.source) || nodeIdsToRemove.includes(e.target));
        if (edgesToRemove.length > 0) subflow.removeEdges(edgesToRemove.map(e => e.id));
        subflow.removeNodes(nodeIdsToRemove);
    }
    const url = "/api/generate-thinking-chain";
    const payload = {
      design_background: props.designBackground, design_goal: props.designGoal,
      parent_node_content: props.parentNodeContent, parent_node_title : props.parentNodeTitle,
      instruction: userInstruction, goal: userGoal,
    };
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
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
  dragOffset.value = { x: event.clientX - rect.left, y: event.clientY - rect.top };
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
           <button class="save-btn" @click="handleSaveButton" :disabled="isSaveButtonRunning || isSaved" title="Save this LLM Chain">
            <div v-if="isSaveButtonRunning" class="spinner"></div>
            <span v-else>Save</span>
          </button>
          <button @click="emit('close', { nodes: subflow.getNodes.value, edges: subflow.getEdges.value, isSaved: isSaved.valueOf })"  class="close-btn" title="Close Canvas">×</button>
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
          <button ref="runBtnRef" class="run-btn" @click="handleSubCanvasRun" :disabled="isSubCanvasRunning" title="Run Sub-Canvas Logic">
            <div v-if="isSubCanvasRunning" class="spinner"></div>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
            </svg>
            <span>Generate</span>
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
          <!-- 5. 添加 GroupNode 的模板 -->
          <template #node-group="groupProps">
            <GroupNode
              v-bind="groupProps"
              @delete="subflow.removeNodes([$event])"
            />
          </template>
          <template #node-rating="props">
            <RatingNode
              v-bind="props"
              @close="handleRatingClose"
              @submit="handleRatingSubmit"
            />
          </template>
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
              @update-node-data="handleNodeDataUpdate"
              @regenerate="handleTextNodeSendData"
              @create-node-from-text="handleCreateNodeFromText($event, textProps)"
            />
          </template>

          <Background />
          <Controls />
        </VueFlow>
      </div>
      <div class="sub-canvas-toolbar-wrapper">
        <Toolbar
        :is-add-group="isAddingGroup"
        :is-adding-node="isAddingNode"
        :is-show="isShowingRunNode"
        v-model:newNodeColor="newNodeColor"
         @toggle-add-group-mode="toggleAddGroupMode"
         @toggle-add-node-mode="toggleAddNodeMode"
         :show-rate-button="true"
         @rate-clicked="handleShowSubCanvasRating"
         />
      </div>
    </div>
    <EditModal :show="isEditModalVisible" :node-data="editingNode" @close="isEditModalVisible = false" @save="handleNodeSave" />
  </div>

</template>

<style scoped>
/* Styles are unchanged, so they are omitted for brevity. You can copy them from your original file. */
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
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
  border: 1px solid #5661F6;
  background-color: #5661F6;
  color: white;
  min-width: 80px;
}
.run-btn:hover:not(:disabled) {
  background-color: #323ee6;
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
