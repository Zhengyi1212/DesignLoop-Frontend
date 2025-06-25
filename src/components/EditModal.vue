<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  // v-if 控制显示/隐藏，所以用 'show' prop
  // 'show' prop controls visibility with v-if
  show: Boolean,
  // 需要编辑的节点数据
  // Node data to be edited
  nodeData: Object,
});

const emit = defineEmits(['close', 'save']);

// 将 props 的数据复制到本地 ref，这样我们就可以在不直接修改 prop 的情况下编辑它们
// Copy props data to local refs so we can edit them without directly mutating the prop
const localTitle = ref('');
const localContent = ref('');

// 使用 onMounted 和 watch 来确保输入框在每次打开时都显示正确的最新数据
// Use onMounted and watch to ensure the input fields show the correct latest data each time the modal is opened
onMounted(() => {
    if (props.nodeData?.data) {
        localTitle.value = props.nodeData.data.title;
        localContent.value = props.nodeData.data.content;
    }
});

watch(() => props.nodeData, (newNodeData) => {
  if (newNodeData?.data) {
    localTitle.value = newNodeData.data.title;
    localContent.value = newNodeData.data.content;
  }
});


function onSave() {
  // 保存时，发出 'save' 事件，并携带节点的 ID 和更新后的数据
  // On save, emit the 'save' event with the node's ID and updated data
  emit('save', {
    id: props.nodeData.id,
    data: {
      title: localTitle.value,
      content: localContent.value,
    },
  });
  closeModal();
}

function closeModal() {
  // 发出 'close' 事件来告诉父组件关闭弹窗
  // Emit the 'close' event to tell the parent component to close the modal
  emit('close');
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal-window">
      <div class="modal-header">
        <h3>Edit Node</h3>
        <button @click="closeModal" class="close-button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="title">Title</label>
          <input id="title" v-model="localTitle" type="text" />
        </div>
        <div class="form-group">
          <label for="content">Content</label>
          <textarea id="content" v-model="localContent" rows="5"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">Cancel</button>
        <button @click="onSave" class="btn btn-primary">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-window {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.modal-header h3 {
  margin: 0;
}
.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}
.modal-body .form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #eee;
  padding-top: 20px;
  margin-top: 10px;
}
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
</style>
