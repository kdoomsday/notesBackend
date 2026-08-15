import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/Toast';
import { applyCachedUiConfig, applyUiConfig, loadUiConfig, watchUiConfig } from './config';
import './styles.css';
import './i18n';

function bootstrap() {
  applyCachedUiConfig();
  void loadUiConfig().then((config) => {
    if (config) applyUiConfig(config);
  });
  watchUiConfig();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StrictMode>
  );
}

bootstrap();
