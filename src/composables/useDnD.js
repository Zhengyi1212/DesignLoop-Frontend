import { useVueFlow } from '@vue-flow/core';

// A simple counter to ensure unique node IDs
let id = 0;
function getId() {
  return `dnd-node-${id++}`;
}

/**
 * A reusable composable for handling drag-and-drop node creation.
 */
export default function useDragAndDrop() {
    const { addNodes, screenToFlowCoordinate } = useVueFlow();

    function onDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function onDrop(event, callback) {
        const type = event.dataTransfer?.getData('application/vueflow');
        if (!type) return;

        const position = screenToFlowCoordinate({
            x: event.clientX,
            y: event.clientY,
        });

        // 修复点 #2: 为新节点添加初始的 width 和 height 属性
        const newNode = {
            id: getId(),
            type,
            position,
            width: 220,
            height: 150,
            data: { title: 'New Node', content: 'Double-click to open...' },
        };

        addNodes([newNode]);
        
        if (callback && typeof callback === 'function') {
            callback(newNode);
        }
    }
    
    function onDragStart(event, nodeType) {
        if (event.dataTransfer) {
            event.dataTransfer.setData('application/vueflow', nodeType);
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    return {
        onDragStart,
        onDragOver,
        onDrop,
    };
}
