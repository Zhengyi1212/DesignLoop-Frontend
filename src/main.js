import { createApp } from 'vue';
import { VueFlow } from '@vue-flow/core'; // 我们需要在 main 中也引入 VueFlow
import PrimeVue from 'primevue/config';

import Aura from '@primevue/themes/aura'; // 导入 Aura 主题的预设

// 3. 导入 PrimeIcons，这个保持不变
import 'primeicons/primeicons.css';

import App from './App.vue';

// 创建 Vue 应用实例
const app = createApp(App);

// 将 VueFlow 注册为全局组件，这是 Vue Flow 的推荐做法
// Register VueFlow as a global component, which is the recommended practice for Vue Flow
app.use(VueFlow);
app.use(PrimeVue, {
  theme: {
    preset: Aura, // 将导入的 Aura Preset 在这里应用
    options: {
      // 可选：这里可以添加一些全局配置，例如前缀
      // prefix: 'p', 
      // darkModeSelector: '.my-dark-theme',
    }
  }
});

// 挂载应用
// Mount the application
app.mount('#app');
