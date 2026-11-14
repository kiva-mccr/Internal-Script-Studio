import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { applyHelp } from './lib/helptext';

applyHelp();

mount(App, { target: document.getElementById('app')! });
