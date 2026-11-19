import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Auth: public. */}
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
