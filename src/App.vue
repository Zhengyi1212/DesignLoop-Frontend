<script setup>
import { ref, onBeforeUnmount, defineAsyncComponent, onMounted, onUnmounted, computed, watch, nextTick, createApp, h } from 'vue';
// --- 核心修改: 不再需要导入 SelectionPane ---
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

// --- PDF 导出功能第一步：引入所需库 ---
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 导入所有子画布需要用到的自定义节点，以便离屏渲染，这至关重要
import ChainNode from './components/ChainNode.vue';
import TextNode from './components/TextNode.vue';
// 导入所有自定义组件，以便离屏渲染主画布时使用
import CustomNode from './components/CustomNode.vue';
import RunNode from './components/RunNode.vue';
import GroupNode from './components/GroupNode.vue';
import RatingNode from './components/RatingNode.vue';


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
const isDetailModalVisible = ref(false);
const selectedSnapshotForDetail = ref(null);

const isAddingNode = ref(false);
const isAddingRunNode = ref(false);
const isAddingGroup = ref(false);
const isShowingRunNode = ref(true);
const isExporting = ref(false); // PDF 导出加载状态

const activeColor = ref('#FBF29B');

/**
 * 捕获并添加子画布到PDF文档中。（此函数保持不变）
 */
async function captureAndAddSubCanvasToPdf(pdf, parentNode) {
  // 1. 创建一个离屏容器
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'absolute',
    left: '-9999px',
    top: '-9999px',
    width: '1280px',
    height: '960px',
    background: 'white',
  });
  document.body.appendChild(container);

  // 2. 创建并配置一个临时的Vue应用实例
  const app = createApp({
    render() {
      return h(VueFlow, {
          modelValue: [
            ...JSON.parse(JSON.stringify(parentNode.data.subGraph.nodes)),
            ...JSON.parse(JSON.stringify(parentNode.data.subGraph.edges)),
          ],
          fitViewOnInit: true,
        },
        {
          'node-chain': (props) => h(ChainNode, props),
          'node-text': (props) => h(TextNode, props),
          'node-group': (props) => h(GroupNode, props),
          'node-rating': (props) => h(RatingNode, props),
          'default': () => h(Background),
        }
      );
    }
  });

  try {
    // 3. 挂载Vue应用并等待渲染完成
    app.mount(container);
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. 执行截图
    const canvas = await html2canvas(container, {
      useCORS: true,
      scale: 2
    });
    const imgData = canvas.toDataURL('image/png');

    // 5. 将截图添加到PDF
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text(`Sub-Canvas of node: '${parentNode.data.title || parentNode.id}'`, 15, 20);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    pdf.addImage(imgData, 'PNG', 15, 30, imgWidth * ratio * 0.9, imgHeight * ratio * 0.9);

  } catch (error) {
    console.error(`Failed to capture sub-canvas for node ${parentNode.id}:`, error);
  } finally {
    // 6. 清理资源
    if (app) {
      app.unmount();
    }
    document.body.removeChild(container);
  }
}

/**
 * Exports the main canvas and all sub-canvases to a multi-page PDF.
 * This function has been corrected to fix the edge clipping bug.
 */
async function exportToPdf() {
  if (isExporting.value) return;
  isExporting.value = true;

  let offscreenApp = null;
  let offscreenContainer = null;

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const mainCanvasElement = vueFlowRef.value?.$el;
    if (mainCanvasElement && nodes.value.length > 0) {
      // Step 1: Precisely calculate the bounding box of all nodes.
      // This is the crucial first step to fixing the problem. We need to know the exact
      // extent of all content.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const PADDING = 100; // Add padding around the content to ensure edges aren't clipped.

      nodes.value.forEach(node => {
        // For the most accurate calculation, we prioritize the node's actual rendered dimensions.
        const renderedNode = findNode(node.id);
        const width = renderedNode?.dimensions?.width || node.width || 200; // Fallback width
        const height = renderedNode?.dimensions?.height || node.height || 150; // Fallback height

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + width);
        maxY = Math.max(maxY, node.position.y + height);
      });

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;

      // Create a bounds object containing all content, to be used by `fitBounds`.
      const bounds = {
        x: minX,
        y: minY,
        width: contentWidth,
        height: contentHeight,
      };

      // Step 2: Create an off-screen container that is proportional to the content.
      // We no longer use the on-screen viewport's dimensions. Instead, we create a
      // container based on the content's actual aspect ratio to ensure the final
      // screenshot is not distorted.
      offscreenContainer = document.createElement('div');
      // To ensure high quality, we set a large base width for rendering and calculate
      // the height proportionally. We add padding to the bounds for the final dimensions.
      const exportWidth = Math.max(1920, bounds.width + PADDING * 2);
      const exportHeight = (exportWidth / (bounds.width + PADDING * 2)) * (bounds.height + PADDING * 2);

      Object.assign(offscreenContainer.style, {
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: `${exportWidth}px`,
        height: `${exportHeight}px`,
      });
      document.body.appendChild(offscreenContainer);

      // Step 3: Create a new Vue app instance for off-screen rendering.
      offscreenApp = createApp({
        render() {
          return h(VueFlow, {
            modelValue: [
              ...JSON.parse(JSON.stringify(nodes.value)),
              ...JSON.parse(JSON.stringify(edges.value)),
            ],
            // --- THE CORE FIX ---
            // We no longer use `fitViewOnInit` as it can cause unpredictable panning.
            // Instead, we use `fitBounds`, telling VueFlow exactly which area to render.
            // VueFlow will automatically calculate the correct zoom and pan to make
            // this `bounds` rectangle fit perfectly within the viewport of the size
            // we provide in `style`, thus preventing any content from being moved
            // outside the capturable area.
            fitBounds: bounds,
            fitBoundsOptions: { padding: PADDING },
            style: { width: `${exportWidth}px`, height: `${exportHeight}px` },
          }, {
            // Register all custom component slots
            'node-custom': (props) => h(CustomNode, props),
            'node-run': (props) => h(RunNode, props),
            'node-group': (props) => h(GroupNode, props),
            'node-rating': (props) => h(RatingNode, props),
            'edge-custom': (props) => h(CustomEdge, props),
            'default': () => h(Background),
          });
        }
      });

      // Step 4: Mount, wait for render, and take the screenshot.
      offscreenApp.mount(offscreenContainer);
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(offscreenContainer, {
        useCORS: true,
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');

      // Add the image to the PDF (this part of the logic is unchanged).
      pdf.setFontSize(20);
      pdf.text('Main Design Canvas', 15, 30);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      pdf.addImage(imgData, 'PNG', 15, 45, imgWidth * ratio * 0.95, imgHeight * ratio * 0.95);

    } else if (mainCanvasElement) {
      // Handle the case where the canvas exists but is empty.
      const canvas = await html2canvas(mainCanvasElement, { useCORS: true, scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      pdf.setFontSize(20);
      pdf.text('Main Design Canvas (Empty)', 15, 30);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      pdf.addImage(imgData, 'PNG', 15, 45, imgWidth * ratio * 0.95, imgHeight * ratio * 0.95);
    }

    // 3. Export all sub-canvases
    for (const node of nodes.value) {
      if (node.data && node.data.subGraph && node.data.subGraph.nodes && node.data.subGraph.nodes.length > 0) {
        await captureAndAddSubCanvasToPdf(pdf, node);
      }
    }

    // 4. Save the PDF
    pdf.save('design-export.pdf');

  } catch (error) {
    console.error('Failed to export to PDF:', error);
    alert('An error occurred while exporting to PDF. Please check the console for details.');
  } finally {
    // 5. Clean up resources thoroughly
    if (offscreenApp) {
      offscreenApp.unmount();
    }
    if (offscreenContainer) {
      document.body.removeChild(offscreenContainer);
    }
    isExporting.value = false;
  }
}


// Watch for selection changes to update the color picker
watch(getSelectedNodes, (selectedNodes) => {
  // When only one node is selected, update the color picker to match its color
  if (selectedNodes.length === 1 && selectedNodes[0].data && selectedNodes[0].data.color) {
    activeColor.value = selectedNodes[0].data.color;
  }
});

// Watch for color changes and apply them to selected nodes
watch(activeColor, (newColor) => {
  const selectedNodes = getSelectedNodes.value;
  selectedNodes.forEach(node => {
    // IMPORTANT: Only apply color changes to nodes of type 'custom' or 'group'
    // This prevents changing the color of 'RunNode' or other special nodes.
    if (node.data && (node.type === 'custom' || node.type === 'group')) {
      node.data.color = newColor;
    }
  });
});


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
    draggable: true,
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
      ghostData = { label: 'Group', color: activeColor.value };
      ghostDimensions = { width: 380, height: 260 };
  } else {
      ghostType = 'custom';
      ghostData = { title: 'New Node', content: 'Click to place', color: activeColor.value };
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

    let newNode = { id: `node-${nodeIdCounter++}`, position: { ...ghostNode.position }, data: { color: activeColor.value } };

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
    data: fullSnapshotData
  };
  snapshots.value.push(newSnapshot);
  if (!parentNode.data) parentNode.data = {};
  parentNode.data.appliedSnapshotId = newSnapshot.id;
}

function handleApplySnapshot({ nodeId, snapshotData }) {
  const targetNode = findNode(nodeId);
  if (!targetNode) return;
  const oldSnapshotId = targetNode.data.appliedSnapshotId;
  if (oldSnapshotId) {
    const oldSnapshotIndex = snapshots.value.findIndex(s => s.id === oldSnapshotId);
    if (oldSnapshotIndex !== -1) {
      snapshots.value.splice(oldSnapshotIndex, 1);
    }
  }
  const dataToApply = snapshotData.data;
  const newSnapshotId = `${snapshotIdCounter++}`;
  targetNode.data.instruction = dataToApply.instruction;
  targetNode.data.goal = dataToApply.goal;
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
  if (dataToApply.rationales && dataToApply.rationales.length > 0) {
    targetNode.data.rationales = JSON.parse(JSON.stringify(dataToApply.rationales));
    targetNode.data.content = dataToApply.rationales.join('\n');
  } else if (dataToApply.content) {
    targetNode.data.content = dataToApply.content;
    targetNode.data.rationales = [dataToApply.content];
  }
  targetNode.data.hasSnapshot = true;
  targetNode.data.appliedSnapshotId = newSnapshotId;
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

function handleNodeUpdate(event) {
  const node = findNode(event.id);
  if (node) {
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
      content: node.data.content,
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

async function node_chain_autogene(nodeData) {
  pipelineCounter.value++;
  if (!Array.isArray(nodeData) || nodeData.length === 0) return;
  const newNodes = [];
  const newEdges = [];
  const startX = 100;
  const startY = 200 + pipelineOffset * pipelineCounter.value;
  const gapX = 250;
  nodeData.forEach((data, index) => {
    const pipelineContent = data.pipeline_content || '';
    const newNode = {
      id: `chain-node-${nodeIdCounter++}`,
      type: 'custom',
      position: { x: startX + index * gapX, y: startY },
      style: { width: '200px', height: '200px' },
      data: {
        title: data.pipeline_title || 'Untitled Node',
        rationales: [ pipelineContent ],
        content: pipelineContent,
        color: activeColor.value,
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
    <InstructionPanel
      :panels="instructionPanels"
      :is-generating="isGenerating"
      :is-fetching-pipeline="isFetchingPipeline"
      @update-panel-content="(event) => instructionPanels[event.index].content = event.content"
      @generate="handleGeneration"
      @fetch-pipeline="handleFetchPipeline"
    />

    <main class="main-content">
      <div class="top-right-actions">
        <button @click="exportToPdf" class="action-button pdf-export-button" title="Export to PDF" :disabled="isExporting">
          <svg v-if="!isExporting" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <div v-else class="spinner"></div>
        </button>
        <button @click="clearAllStateAndExit" class="action-button exit-button" title="清除所有内容并退出">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        @edges-change="onEdgesChange"
        @connect="onConnect"
        class="flow-canvas"
        :fit-view-on-init="true"
        ref="vueFlowRef"
        :min-zoom="0.1"
        selection-mode="full"
        :selection-key-code="'Shift'"
      >
        <template #node-rating="props">
          <RatingNode
            v-bind="props"
            @close="handleRatingClose"
            @submit="handleRatingSubmit"
          />
        </template>

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
          v-model:activeColor="activeColor"
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

    <div v-if="isSessionExpired" class="session-expired-overlay">
      <div class="session-expired-box">
        <h2>Session expired</h2>
        <button @click="startNewSession" class="restart-button">Start a new session</button>
      </div>
    </div>

</template>

<style>
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/theme-default.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/controls@latest/dist/style.css';
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/minimap@latest/dist/style.css';
/*@import '@vue-flow/node-resizer/dist/style.css';*/
/* 框选功能的样式依然需要导入 */
@import 'https://cdn.jsdelivr.net/npm/@vue-flow/core@1.45.0/dist/selection-pane.css';


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

.top-right-actions {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 20;
  display: flex;
  gap: 10px;
}
.action-button {
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
.action-button:hover:not(:disabled) {
    background-color: #007bff;
    color: white;
    border-color: #007bff;
    transform: scale(1.1);
}
.action-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.exit-button:hover {
  background-color: #e74c3c;
  color: white;
  border-color: #e74c3c;
  transform: rotate(90deg) scale(1.1);
}
.spinner {
    border: 3px solid rgba(0, 0, 0, 0.2);
    border-left-color: #343a40;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    animation: spin 1s linear infinite;
}
.pdf-export-button:hover:not(:disabled) .spinner {
    border-left-color: white;
}
@keyframes spin {
  to { transform: rotate(360deg); }
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
/* Optional: Style the selection pane for better visibility */
.vue-flow__selectionpane {
  background: rgba(0, 102, 255, 0.08);
  border: 1px dotted rgba(0, 102, 255, 0.8);
}
.vue-flow__resize-control {
  /* 核心修复：让控制器脱离文档流，不再占据空间 */
  position: absolute !important; 
  width: 16px;    /* 控制器的大小 */
  height: 16px;
  background: transparent; /* 将背景设置为透明 */
  border: none;  /* 控制器的边框色 */
  border-radius: 2px;
  z-index: 10;      /* 确保它显示在节点内容之上 */
}

/* 2. 分别定位四个角的控制器 */
.vue-flow__resize-control.top.left {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.vue-flow__resize-control.top.right {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.vue-flow__resize-control.bottom.right {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.vue-flow__resize-control.bottom.left {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}

</style>