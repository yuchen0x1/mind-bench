import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { LocaleProvider } from './locale.mjs';

createRoot(document.getElementById('root')).render(<React.StrictMode><LocaleProvider><App /></LocaleProvider></React.StrictMode>);
