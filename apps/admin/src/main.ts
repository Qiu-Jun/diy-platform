import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'virtual:uno.css';
import './styles/index.scss';
import App from './App.vue';
import router from './router';

createApp(App).use(router).use(ElementPlus).mount('#app');
