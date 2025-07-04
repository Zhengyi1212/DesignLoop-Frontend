import { useVueFlow } from '@vue-flow/core';

// A simple counter to ensure unique node IDs for nodes created via DnD
let id = 0;
function getId() {
  return `dnd-node-${id++}`;
}

/**
 * A reusable composable for handling drag-and-drop operations.
 */
export default function useDragAndDrop() {
    const { addNodes, screenToFlowCoordinate } = useVueFlow();

    function onDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    /**
     * Handles dropping new nodes onto the canvas background.
     * It will ignore drops that contain snapshot data, as those are handled by the nodes themselves.
     */
    function onDrop(event) {
        // Check if this drop event contains our custom snapshot data. If so, do nothing.
        const snapshotPayload = event.dataTransfer?.getData('application/json/snapshot');
        if (snapshotPayload) {
            return;
        }

        // Handle the original functionality: creating a new node from a type string.
        const type = event.dataTransfer?.getData('application/vueflow');
        if (!type) return;

        const position = screenToFlowCoordinate({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode = {
            id: getId(),
            type,
            position,
            width: 220,
            height: 150,
            data: { title: 'New Node', content: 'Double-click to open...' },
        };

        addNodes([newNode]);
    }

    /**
     * Handles starting the drag operation.
     * If `data` is an object, it's treated as a snapshot and serialized to a specific data type.
     * If it's a string, it's treated as a simple node type for creating new nodes.
     * @param {DragEvent} event The drag event.
     * @param {Object|string} data The data to be transferred.
     */
    function onDragStart(event, data) {
        if (event.dataTransfer) {
            if (typeof data === 'object' && data !== null) {
                // New functionality for dragging snapshot data objects.
                event.dataTransfer.setData('application/json/snapshot', JSON.stringify(data));
                event.dataTransfer.effectAllowed = 'copy';
            } else {
                // Existing functionality for dragging new node types (as strings).
                event.dataTransfer.setData('application/vueflow', data);
                event.dataTransfer.effectAllowed = 'move';
            }
        }
    }

    return {
        onDragStart,
        onDragOver,
        onDrop,
    };
}
