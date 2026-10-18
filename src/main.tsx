import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installTestHook } from './engine/testHook';

installTestHook();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
