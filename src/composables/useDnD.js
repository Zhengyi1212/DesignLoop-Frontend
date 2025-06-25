// src/composables/useDnD.js

import { useVueFlow } from '@vue-flow/core';

// A simple counter to ensure unique node IDs
let id = 0;
function getId() {
  return `dnd-node-${id++}`;
}

/**
 * A reusable composable for handling drag-and-drop node creation.
 * It intelligently uses the Vue Flow instance of the component it's called from.
 */
export default function useDragAndDrop() {
    // This is the magic: useVueFlow() gets the *scoped* instance.
    // When called in App.vue, it affects the main canvas.
    // When called in SubCanvas.vue, it affects only that sub-canvas.
    const { addNodes, screenToFlowCoordinate } = useVueFlow();

    /**
     * Called when a draggable item is dragged over the canvas.
     * We must prevent the default behavior to allow a drop.
     */
    function onDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    /**
     * Handles the drop event on the canvas.
     * @param {DragEvent} event - The browser's drop event.
     * @param {Function} [callback] - An optional callback to run after the node is created.
     */
    function onDrop(event, callback) {
        const type = event.dataTransfer?.getData('application/vueflow');
        if (!type) return;

        // Convert screen coordinates to flow coordinates
        const position = screenToFlowCoordinate({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode = {
            id: getId(),
            type,
            position,
            // Provide sensible defaults for new nodes
            data: { title: 'New Node', content: 'Double-click to open...' },
        };

        addNodes([newNode]);
        
        // This callback is crucial for App.vue to know that it needs
        // to create a new, empty sub-graph for this new node.
        if (callback && typeof callback === 'function') {
            callback(newNode);
        }
    }
    
    /**
     * Called when the drag starts from the toolbar.
     * It attaches the node type to the drag event.
     */
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