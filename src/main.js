import { createApp } from 'vue';
import { VueFlow } from '@vue-flow/core'; // 我们需要在 main 中也引入 VueFlow

import App from './App.vue';

// 创建 Vue 应用实例
const app = createApp(App);

// 将 VueFlow 注册为全局组件，这是 Vue Flow 的推荐做法
// Register VueFlow as a global component, which is the recommended practice for Vue Flow
app.use(VueFlow);

// 挂载应用
// Mount the application
app.mount('#app');
