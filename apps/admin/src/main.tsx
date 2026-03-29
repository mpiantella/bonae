import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ConfigMissing from './ConfigMissing';
import { readAdminEnv } from './config';
import './index.css';

const env = readAdminEnv();
const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    {env.ok ? <App /> : <ConfigMissing missing={env.missing} />}
  </StrictMode>,
);
