# orchestrator.py

import json
import requests
import whisper
from scraper import get_canvas_state

# 1. initialise Whisper
model = whisper.load_model("base")

# 2. transcribe audio 
print("Transcribing...")
audio_result = model.transcribe("input_audio.wav")
transcript = audio_result["text"]
print(f"Transcript: {transcript}")

# 3. get canvas metadata
canvas_data = get_canvas_state()

# 4. construct orchestrated prompt
prompt = f"""
You are an educational coding assistant.
Canvas Metadata: {json.dumps(canvas_data)}
User Instruction: {transcript}
Goal: Generate a Python snippet to perform this action. Use sprite IDs.
Output ONLY valid Python code.
"""

# 5. send to Ollama
response = requests.post("http://localhost:11434/api/generate", json={
    "model": "llama3",
    "prompt": prompt,
    "stream": False
})

generated_code = response.json()['response']
print("\n--- Generated Code ---")
print(generated_code)