import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initialize } from './store';
import { initializePwa } from './pwa';
import { initializeCloud, cloudStartPending } from './cloud/runtime';
import './ui/styles.css';
createRoot(document.getElementById('root')!).render(<App />);
void initialize(cloudStartPending()).then(initializeCloud);
initializePwa();
