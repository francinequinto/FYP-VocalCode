/**
 * api.js
 * =============================
 * API client module
 * Centralises all REST communication between the browser frontend
 * and the FastAPI backend service.
 */

const BASE_URL = "http://localhost:8000";

/**
 * Sends a background image to BLIP for environmental captioning.
 */
export async function processBlip(file) {
    const formData = new FormData();
    formData.append("bg_file", file);

    const response = await fetch(`${BASE_URL}/upload-bg`, {
        method: 'POST',
        body: formData
    });

    return await response.json();
}

/**
 * Sends a sprite image to BLIP for VQA noun identification.
 */
export async function uploadSprite(file) {
    const formData = new FormData();
    formData.append('sprite_file', file);

    const response = await fetch('http://localhost:8000/upload-sprite', {
        method: 'POST',
        body: formData
    });

    return await response.json();
}

/**
 * Dispatches spoken audio and serialised canvas state to the multimodal pipeline.
 * Whisper -> Levenshtein -> Llama3 -> Executed Coordinates
 */
export async function generateAction(audioBlob, canvasState) {
    const formData = new FormData();
    formData.append("audio_file", audioBlob, "live_input.wav");
    formData.append("canvas_state", JSON.stringify(canvasState));

    const response = await fetch(`${BASE_URL}/generate`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Voice command generation failed: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Re-executes previously generated Python code against the current canvas state.
 */
export async function executeDirectCode(code, canvasState) {
    const formData = new FormData();
    formData.append('code', code);
    formData.append('canvas_state', JSON.stringify(canvasState));

    const response = await fetch('http://localhost:8000/execute-code', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Voice command generation failed: ${response.statusText}`);
    }
    
    return await response.json();
}