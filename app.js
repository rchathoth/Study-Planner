// Import the secret API key from the local-only config.js file
import { API_KEY } from './config.js';

// --- Gemini API Configuration ---
// The API_KEY is now imported from config.js
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

// --- DOM Elements ---
const studyForm = document.getElementById('study-form');
// ... (the rest of your app.js file remains exactly the same)
// ...

