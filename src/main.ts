import '@fontsource/press-start-2p/index.css';
import './style.css';
import { App } from './app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app element in index.html');
new App(root);
