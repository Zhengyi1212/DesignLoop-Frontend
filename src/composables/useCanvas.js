// src/composables/useCanvas.js

import { ref } from 'vue';
import { useVueFlow } from '@vue-flow/core';

/**
 * A composable that encapsulates common Vue Flow canvas logic.
 * @param {string} graphId - A unique ID for the graph instance.
 * @param {object} options - Configuration options for the canvas.
 * @param {string} [options.pathType='bezier'] - The default path type for new edges ('bezier' or 'smoothstep').
 */
export function useCanvas(graphId, options = {}) {
  // --- Default Options ---
  const {
    pathType = 'bezier',
  } = options;

  // --- Vue Flow Instance ---
  // Call useVueFlow only ONCE to get all functions from the same context.
  const {
    addNodes,
    addEdges,
    removeEdges,
    removeNodes,
    findNode,
    getNodes,
    getEdges,
    getSelectedNodes,
    onConnect,
    project,
    vueFlowRef,
    onPaneMouseMove, // Destructure the correct event handler from the single call
  } = useVueFlow({ id: graphId });

  // --- State Management ---
  const isFrozen = ref(false);
  // Simple counter for new nodes to ensure unique IDs within this canvas instance.
  let nodeIdCounter = getNodes.value.length; 

  // --- Core Functionality ---

  /**
   * Handles new connections between nodes.
   * All new edges will use the CustomEdge component and have default styles.
   */
  onConnect((params) => {
    const newEdge = {
      ...params,
      id: `edge--${params.source}(${params.sourceHandle})--${params.target}(${params.targetHandle})--${Date.now()}`,
      type: 'custom',
      interactionWidth: 30,
      selectable: true,
      data: { animated: true, pathType: pathType },
    };
    addEdges([newEdge]);
  });

  /**
   * Deletes a node and all connected edges.
   * @param {string} nodeIdToDelete - The ID of the node to delete.
   */
  function deleteNode(nodeIdToDelete) {
    if (!nodeIdToDelete) return;
    // Find all edges connected to the node (either as a source or a target)
    const edgesToRemove = getEdges.value.filter(
      (edge) => edge.source === nodeIdToDelete || edge.target === nodeIdToDelete
    );
    // Remove the identified edges
    if (edgesToRemove.length > 0) {
      removeEdges(edgesToRemove.map((edge) => edge.id));
    }
    // Remove the node itself
    removeNodes([nodeIdToDelete]);
  }

  /**
   * Deletes a single edge by its ID.
   * @param {string} edgeIdToDelete - The ID of the edge to delete.
   */
  function deleteEdge(edgeIdToDelete) {
    if (!edgeIdToDelete) return;
    removeEdges([edgeIdToDelete]);
  }

  /**
   * Toggles the frozen state of the canvas, preventing or allowing node interaction.
   */
  function toggleFreeze() {
    isFrozen.value = !isFrozen.value;
    const isInteractable = !isFrozen.value;
    getNodes.value.forEach((node) => {
      if (node.id !== 'ghost-node') { // Ghost node should never be interactable
          node.draggable = isInteractable;
          node.selectable = isInteractable;
      }
    });
  }

  /**
   * Duplicates the currently selected node.
   * Creates a deep copy of the node data and places it with an offset.
   */
  function duplicateSelectedNode() {
    const selectedNodes = getSelectedNodes.value;
    // This action is only for single node duplication
    if (selectedNodes.length !== 1) return;
    
    const originalNode = selectedNodes[0];
    // Prevent duplicating the ghost node
    if (originalNode.id === 'ghost-node') return;

    const newNode = {
      id: `node-${graphId}-${nodeIdCounter++}`,
      type: originalNode.type,
      position: {
        x: originalNode.position.x + 40,
        y: originalNode.position.y + 40,
      },
      // Deep copy data, but reset connections
      data: {
        ...JSON.parse(JSON.stringify(originalNode.data)),
        connections: { in: [], out: [] },
      },
      // Preserve dimensions if they exist
      ...(originalNode.width && { width: originalNode.width }),
      ...(originalNode.height && { height: originalNode.height }),
    };
    addNodes([newNode]);
  }

  // --- Return ---
  // Expose all state and methods to be used by the component.
  return {
    // State
    isFrozen,
    vueFlowRef,

    // Methods
    deleteNode,
    deleteEdge,
    toggleFreeze,
    duplicateSelectedNode,
    addNodes,
    addEdges,
    findNode,
    project,
    onPaneMouseMove, // Return the correct handler from the single useVueFlow call
    getNodes,
    getSelectedNodes,
  };
}
