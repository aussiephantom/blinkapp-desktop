import React from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App-simple';

console.log('React entry point loading...');

const container = document.getElementById('root');
if (container) {
  console.log('Root container found, mounting React app...');
  const root = createRoot(container);
  root.render(<App />);
  console.log('React app mounted successfully');
} else {
  console.error('Root container not found!');
}
