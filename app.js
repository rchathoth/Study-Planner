// --- CONFIGURATION IMPORT ---
// NOTE: This line imports the API_KEY from a local file named 'config.js'.
// This ensures your key is kept off GitHub, as 'config.js' will be in your .gitignore.
import { API_KEY } from './config.js'; 

// --- Gemini API Configuration ---
// The API_KEY is now securely imported.
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;

// --- DOM Elements ---
const studyForm = document.getElementById('study-form');
const testNameInput = document.getElementById('test-name');
const testDateInput = document.getElementById('test-date');
const materialsInput = document.getElementById('study-materials');
const generatePlanBtn = document.getElementById('generate-plan-btn');
const generateTestBtn = document.getElementById('generate-test-btn');
const planOutput = document.getElementById('study-plan-output');
const testOutput = document.getElementById('practice-test-output');

// --- State ---
let currentMaterials = ""; // Store materials for the practice test
let currentTestName = "";

// --- Utility Functions ---

/**
 * Shows a loading spinner and message in a target element.
 * @param {HTMLElement} element - The element to show loading in.
 * @param {string} message - The message to display.
 */
function showLoading(element, message) {
    element.innerHTML = `
        <div class="loading-container">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Displays an error message in a target element.
 * @param {HTMLElement} element - The element to show the error in.
 * @param {string} message - The error message.
 */
function displayError(element, message) {
    element.innerHTML = `
        <div class="error-message">
            <strong>Error:</strong>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Validates the main form inputs.
 * @returns {string|null} An error message if invalid, or null if valid.
 */
function validateInputs() {
    if (!testNameInput.value.trim()) {
        return "Please enter a test name.";
    }
    if (!testDateInput.value) {
        return "Please select a test date.";
    }
    const today = new Date().setHours(0, 0, 0, 0);
    const selectedDate = new Date(testDateInput.value).getTime();
    if (selectedDate <= today) {
        return "Please select a future date for the test.";
    }
    if (!materialsInput.value.trim()) {
        return "Please enter your study materials.";
    }
    return null;
}

/**
 * Calls the Gemini API with exponential backoff.
 * @param {object} payload - The payload to send to the API.
 * @param {number} maxRetries - Maximum number of retries.
 * @returns {Promise<object>} - The API response.
 */
async function callApiWithBackoff(payload, maxRetries = 3) {
    let delay = 1000; // Start with 1 second
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();

            // Check for safety ratings or blocked content
            if (result.candidates?.[0]?.finishReason === 'SAFETY') {
                throw new Error("The request was blocked due to safety settings.");
            }
            if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
                    throw new Error("Received an invalid or empty response from the AI.");
            }

            return result;

        } catch (error) {
            if (i === maxRetries - 1) {
                throw error; // Throw error on last retry
            }
            // Don't log to console
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}

// --- Core Logic Functions ---

/**
 * Handles the "Generate Study Plan" button click.
 */
async function handleGeneratePlan(event) {
    event.preventDefault();
    const errorMessage = validateInputs();
    if (errorMessage) {
        displayError(planOutput, errorMessage);
        return;
    }

    // Save state for practice test
    currentTestName = testNameInput.value;
    currentMaterials = materialsInput.value;

    // Calculate days until test
    const today = new Date();
    const testDate = new Date(testDateInput.value);
    const diffTime = Math.abs(testDate.getTime() - today.getTime());
    const daysUntilTest = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    showLoading(planOutput, "Building your personalized plan...");
    generateTestBtn.disabled = true; // Disable test gen while plan gen is running

    const systemInstruction = "You are an expert academic advisor specializing in cognitive science and spaced repetition. Your goal is to create an optimal, easy-to-follow study schedule in JSON format.";
    
    const prompt = `
        Generate a spaced repetition study plan for a student.
        
        Test Details:
        - Test Name: "${currentTestName}"
        - Test Date: ${testDateInput.value}
        - Days Until Test: ${daysUntilTest}
        - Study Materials: "${currentMaterials}"

        Instructions:
        1. Create a list of study sessions.
        2. Space the sessions effectively for memory retention (e.g., 1 day, 3 days, 7 days, 14 days, etc., adjusting for the total time available).
        3. For each session, specify the date (in YYYY-MM-DD format), the topics to review from the materials, and an estimated duration (e.g., "30-45 minutes").
        4. Include a final review session 1-2 days before the test.
        5. Provide a brief rationale (2-3 sentences) for why this plan is effective.
    `;

    const schema = {
        type: "OBJECT",
        properties: {
            studySessions: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING" },
                        topics: { type: "STRING" },
                        estimatedDuration: { type: "STRING" }
                    },
                    required: ["date", "topics", "estimatedDuration"]
                }
            },
            rationale: { type: "STRING" }
        },
        required: ["studySessions", "rationale"]
    };

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    };

    try {
        const result = await callApiWithBackoff(payload);
        const jsonText = result.candidates[0].content.parts[0].text;
        const planData = JSON.parse(jsonText);
        displayStudyPlan(planData);
        generateTestBtn.disabled = false; // Enable test generation
        testOutput.innerHTML = 'Your practice test will appear here once you click the button above.';
    } catch (error) {
        console.error("Error generating study plan:", error);
        displayError(planOutput, `Failed to generate plan: ${error.message}. Please try again.`);
    }
}

/**
 * Renders the generated study plan on the page.
 * @param {object} planData - The parsed JSON data from the API.
 */
function displayStudyPlan(planData) {
    if (!planData.studySessions || planData.studySessions.length === 0) {
        displayError(planOutput, "The AI returned an empty plan. Please check your inputs and try again.");
        return;
    }

    let html = '<div class="study-plan-container">';
    
    // Render Rationale
    html += `
        <div class="plan-rationale">
            <h3>Plan Rationale:</h3>
            <p>${planData.rationale}</p>
        </div>
    `;

    // Render Sessions
    html += '<div class="session-list">';
    html += '<h3>Your Sessions:</h3>';
    html += '<ul>';

    planData.studySessions.forEach(session => {
        // Format date for display
        const sessionDate = new Date(session.date + 'T00:00:00'); // Ensure local time
        const displayDate = sessionDate.toLocaleDateString(undefined, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        });

        html += `
            <li class="session-item">
                <div class="session-header">
                    <strong class="session-date">${displayDate}</strong>
                </div>
                <div class="session-duration">${session.estimatedDuration}</div>
                <p class="session-topics">${session.topics}</p>
            </li>
        `;
    });

    html += '</ul></div></div>';
    planOutput.innerHTML = html;
}

/**
 * Handles the "Generate Practice Test" button click.
 */
async function handleGenerateTest() {
    if (!currentMaterials) {
        displayError(testOutput, "Please generate a study plan first to provide materials for the test.");
        return;
    }

    showLoading(testOutput, "Generating your practice test...");

    const systemInstruction = "You are an expert test creator and subject matter expert. Generate a high-quality practice test based on the provided materials. Include a mix of multiple-choice, true/false, and short-answer questions. Provide an answer key at the very end, clearly separated by '--- ANSWER KEY ---'.";
    
    const prompt = `
        Generate a 10-question practice test based on the following study materials for a "${currentTestName}" test.
        
        Materials: 
        "${currentMaterials}"

        Instructions:
        1. Create a mix of question types (e.g., 4 multiple choice, 3 true/false, 3 short answer).
        2. Ensure questions are directly relevant to the provided materials.
        3. After all 10 questions, add a clear separator: '--- ANSWER KEY ---'
        4. Below the separator, provide the correct answers for all 10 questions.
    `;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            temperature: 0.7,
        }
    };

    try {
        const result = await callApiWithBackoff(payload);
        const testContent = result.candidates[0].content.parts[0].text;
        displayPracticeTest(testContent);
    } catch (error) {
        console.error("Error generating practice test:", error);
        displayError(testOutput, `Failed to generate test: ${error.message}. Please try again.`);
    }
}

/**
 * Escapes and sanitizes text to be safely inserted as HTML.
 * @param {string} str - The raw string.
 * @returns {string} - The escaped string.
 */
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/**
 * Renders the practice test content.
 * @param {string} testContent - The raw text response from the API.
 */
function displayPracticeTest(testContent) {
    // Sanitize the text content before inserting it
    // Then wrap it in a div that respects newlines
    const escapedContent = escapeHTML(testContent);
    
    // Add a <hr> before the answer key for better visual separation
    const formattedContent = escapedContent.replace(
        /--- ANSWER KEY ---/g, 
        '<hr>--- ANSWER KEY ---'
    );
    
    testOutput.innerHTML = `
        <div class="practice-test-content">
            ${formattedContent}
        </div>
    `;
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // This ensures the script runs after the HTML document is fully loaded
    
    // Re-select elements inside this scope in case script was deferred
    const studyForm = document.getElementById('study-form');
    const generateTestBtn = document.getElementById('generate-test-btn');
    const testDateInput = document.getElementById('test-date');

    if (studyForm) {
        studyForm.addEventListener('submit', handleGeneratePlan);
    }
    
    if (generateTestBtn) {
        generateTestBtn.addEventListener('click', handleGenerateTest);
    }

    // Set min date for date picker
    if (testDateInput) {
        const today = new Date();
        today.setDate(today.getDate() + 1);
        testDateInput.min = today.toISOString().split('T')[0];
    }
});
