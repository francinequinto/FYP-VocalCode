# VocalCode
**A Multimodal AI Orchestration Framework for Bridging the Visual-to-Text Programming Gap**

VocalCode is an intelligent, context-aware coding mentor designed for K-12 computer science education. It acts as a "Semantic Bridge" to help students transition from block-based visual programming (like Scratch) to text-based professional languages (like Python). 

By orchestrating four distinct pre-trained AI models across audio, visual, and textual domains, VocalCode allows students to build interactive logic using natural voice commands while the AI handles the mechanical burden of Python syntax in real-time.


## Core Features
*   **Agentic Orchestration:** Synchronizes spoken intent with live spatial canvas metadata to generate perfectly grounded, syntactically correct Python code.
*   **Dual-Audio Pipeline:** Simultaneously processes speech commands and non-verbal acoustic triggers (e.g., clapping, whispering) to execute instant pedagogical Easter eggs.
*   **Visual Context Awareness:** Utilizes programmatic JSON scraping for zero-latency spatial tracking, backed by a computer vision model for identifying custom user uploads.
*   **Zero-Trust Local Inference:** Prioritizes child data privacy by executing all core reasoning locally via Ollama, ensuring no proprietary code or audio data is sent to the cloud.
*   **Semantic Correction Layer:** Automatically resolves phonetic transcription ambiguities (e.g., "night" vs. "knight") using Levenshtein distance matching against active canvas IDs.

## Visual Assets
The default sprites and background images included in VocalCode were generated using ChatGPT's AI image generation tool. They are used for aesthetic and illustrative purposes only, to provide a consistent visual environment for the prototype. They are not part of the AI orchestration or model evaluation functionality. Users may also upload their own images for use in the canvas.

## The 4-Model Architecture
VocalCode coordinates the following models to achieve a seamless multimodal experience:
1.  **OpenAI Whisper:** Speech-to-text (ASR) engine for high-resilience transcription of pediatric speech patterns.
2.  **Salesforce BLIP:** Vision-to-text engine providing semantic noun labeling (VQA) and environmental descriptions for custom-uploaded sprites and backdrops.
3.  **Meta Llama 3 (via Ollama):** The core intelligence engine that fuses the voice transcript with the visual metadata to synthesize deterministic Python logic.
4.  **MIT AST (Audio Spectrogram Transformer):** An acoustic scene classifier (AudioSet) that detects non-verbal environmental triggers (e.g., applause, whispering) to instantly bypass LLM processing and trigger real-time canvas animations.

---

## Installation & Setup

### Prerequisites
*   macOS (Apple Silicon recommended for local inference speed)
*   Python 3.10+
*   [Ollama](https://ollama.com/) installed locally.

### 1. Start the Local LLM
Ensure the Ollama application is running on your machine, then pull and start the Llama 3 model:
`ollama run llama3`

### 2. Set Up the Python Backend
VocalCode utilizes an isolated Python virtual environment. Navigate into the `backend` folder to set up your dependencies:
`cd backend`

Create a fresh virtual environment:
`python3 -m venv venv`

Activate the environment:
`source venv/bin/activate`

Install the required orchestration packages:
`pip install fastapi uvicorn transformers torch openai-whisper pillow python-multipart soundfile`

### 3. Run the Backend Server
With the virtual environment active, start the FastAPI middleware. This will load Whisper, BLIP, and AST into memory.
`uvicorn server:app --reload --port 8000`
*(Wait until the terminal prints `Audio Event Classifier ready!` before proceeding).*

### 4. Run the Frontend Interface
Open a new terminal window, ensure you are in the root project folder (not the `backend` folder), and start a lightweight web server to serve the UI:
`python3 -m http.server 5500`
Navigate to `http://localhost:5500` in your web browser. Alternatively, you can use the **"Go Live"** extension in VS Code.

---

## How to Play
1.  **Arrange your Stage:** Drag and drop sprites (e.g., Boy, Chicken) from the library, or upload your own images and let BLIP identify them.
2.  **Speak your Logic:** Click **Start Recording** and give a natural command (e.g., *"Make the boy walk to the center"*, or *"Make the chicken spin 4 times"*).
3.  **Acoustic Triggers:** Try clapping loudly or whispering near your microphone to trigger instant hidden animations.
4.  **Learn the Code:** Watch as VocalCode generates the underlying Python math and automatically animates the Fabric.js canvas based on the output.

## Project Structure
*   `backend/server.py`: The FastAPI orchestrator middleware containing the Context Fusion engine and Python sandboxing.
*   `main.js`: Client-side orchestration, MediaRecorder audio capture, and UI event binding.
*   `canvas.js`: Fabric.js stage rendering, continuous game loop physics, and JSON state serialization.
*   `api.js`: Centralized REST communication between the browser and the FastAPI backend.
*   `ui.js`: DOM manipulation and dynamic Python syntax highlighting.
*   `style.css`: The complete UI design system and animations.