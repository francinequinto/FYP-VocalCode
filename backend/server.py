"""
server.py
===================================================================
Orchestrates 3 pre-trained foundation models across distinct data modalities:
  1. Audio -> Text: OpenAI Whisper (transcription of user voice commands)
  2. Vision -> Text: Salesforce BLIP (scene context & VQA noun labeling)
  3. Text -> Logic: Meta Llama 3 via Ollama (reasoning over canvas state to generate Python)
"""

# --- IMPORTS ---
import io
import re
import json
import requests
import whisper
import tempfile
import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from transformers import BlipProcessor, BlipForConditionalGeneration, pipeline
from PIL import Image

# app initialisation & middleware
app = FastAPI()

# allow the HTML file to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# initialise Whisper, BLIP & Hugging Face globally (loads only once on startup)
print("Loading Whisper model into memory...")
whisper_model = whisper.load_model("base")
print("Whisper ready!")

print("Loading BLIP model into memory...")
blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
print("BLIP ready!")

print("Loading Audio Event Classifier (MIT AST AudioSet) into memory...")
audio_event_classifier = pipeline(
    "audio-classification",
    model="MIT/ast-finetuned-audioset-10-10-0.4593"
)
print("Audio Event Classifier ready!")

#  canvas boundary & geometry constants
CANVAS_WIDTH = 600
CANVAS_HEIGHT = 500
SPRITE_SIZE = 50

# --- HELPER FUNCTIONS ---
def clamp_position(value, min_val, max_val):
    """Restricts a coordinate to stay within the canvas boundaries."""
    return max(min_val, min(value, max_val))

def levenshtein_distance(s1, s2):
    """
    calculates the min. edit distance between 2 strings using a dynamic programming matrix
    """

    # create a matrix of size (len(s1) + 1) x (len(s2) + 1)
    matrix = [[0 for _ in range(len(s2) + 1)] for _ in range(len(s1) + 1)]

    # initialise the base cases (first row and column)
    for i in range(len(s1) + 1):
        matrix[i][0] = i
    for j in range(len(s2) + 1):
        matrix[0][j] = j
    
    # populate the matrix using Levenshtein logic
    for i in range(1, len(s1) + 1):
        for j in range(1, len(s2) + 1):
            if s1[i - 1] == s2[j - 1]:
                cost = 0
            else: 
                cost = 1

            matrix[i][j] = min(
                matrix[i - 1][j] + 1,  # deletion
                matrix[i][j -1] + 1,  #insertion
                matrix[i - 1][j - 1] + cost  # substitution
            )

    return matrix[-1][-1]

def apply_semantic_correction(transcript, canvas_metadata, distance_threshold=2):
    """
    This function scans the Whisper transcript for homophones or misspellings and 
    snaps them to the nearest valid sprite ID if the edit distance is within the threshold.
    """
    # extract the valid sprite IDs directly from your live canvas JSON
    valid_ids = [sprite["id"] for sprite in canvas_metadata.get("sprites", [])]

    # extract words from the transcript, ignoring punctuation
    words = re.findall(r'\b\w+\b', transcript.lower())
    corrected_transcript = transcript

    for word in words:
        # protected vocab
        protected_words = {"right", "left", "up", "down", "top", "bottom"}
        noise_words = {"pop", "ah", "oh", "um", "uh"}

        # skipping over tiny words such as "a", "to", "it" to avoid false positives
        if len(word) <= 2 or word in protected_words or word in noise_words:
            continue

        for valid_id in valid_ids:
            dist = levenshtein_distance(word, valid_id)
            # if the word is close to a valid ID (but not an exact match), correct it
            if 0 < dist <= distance_threshold:
                # use regex to replace the specific word in the original string case-insensitively
                pattern = re.compile(rf'\b{word}\b', re.IGNORECASE)
                corrected_transcript = pattern.sub(valid_id, corrected_transcript)
                print(f"[AI Correction] Snapped '{word} to '{valid_id}' (Distance: {dist})")

    return corrected_transcript

def sanitize_and_clamp_sprites(sprites: list, max_x: float, max_y: float) -> list:
    """
    Validates, clamps, and sanitizes sprite dictionary attributes modified by LLM-generated code.
    Ensures that values conform to numeric boundaries and guarantees continuous velocity fields.
    """
    for sprite in sprites:
        sprite["x"] = clamp_position(sprite.get("x", 0), 0, max_x)
        sprite["y"] = clamp_position(sprite.get("y", 0), 0, max_y)

        # Clamp normalized scale multiplier between 0.2x and 5.0x
        try:
            sprite["scale"] = max(0.2, min(float(sprite.get("scale", 1.0)), 5.0))
        except (ValueError, TypeError):
            sprite["scale"] = 1.0

        # Preserve cumulative rotation angles for multi-revolution animations (DO NOT modulo % 360)
        try:
            sprite["angle"] = float(sprite.get("angle", 0.0))
        except (ValueError, TypeError):
            sprite["angle"] = 0.0

        # Ensure physical continuous velocities are valid floats
        sprite["vx"] = float(sprite.get("vx", 0.0))
        sprite["vy"] = float(sprite.get("vy", 0.0))
        sprite["v_angle"] = float(sprite.get("v_angle", 0.0))

    return sprites

def process_llm_logic(command: str, canvas_metadata: dict) -> dict:
    """
    Core reasoning pipeline:
      1. Constructs the system prompt with spatial boundaries and entity rules.
      2. Invokes local Meta Llama 3 via Ollama.
      3. Extracts pure Python code using regex isolation.
      4. Safely executes code in an isolated scope modifying the sprite list in-place.
    """
    canvas_w = int(canvas_metadata.get("canvas_width", CANVAS_WIDTH))
    canvas_h = int(canvas_metadata.get("canvas_height", CANVAS_HEIGHT))
    center_x = canvas_w // 2
    center_y = canvas_h // 2
    max_x = canvas_w - SPRITE_SIZE
    max_y = canvas_h - SPRITE_SIZE

    # prompt engineering: grounded instruction set designed for Python code generation
    prompt = f"""
    You are an AI game logic engine and an educational coding instructor.
    Current Live State of `sprites` list: {json.dumps(canvas_metadata['sprites'])}
    User Voice Command: "{command}"
    
    Screen Dimensions & Coordinates:
    - Top-Left: x = 0, y = 0
    - Center / Middle: x = {center_x}, y = {center_y}
    - Bottom-Right: x = {max_x}, y = {max_y}
    - Canvas Width: {canvas_w}, Canvas Height: {canvas_h}
    
    Entity Classification Guide:
    - Humans / People: IDs starting with or containing 'boy', 'farmer', 'girl', 'person', 'child'.
    - Animals / Objects: ALL other sprites in the list (e.g. 'chicken', 'cow', 'sheep', 'pig', 'squirrel', 'tree', etc.).
    
    Goal: Write Python code to update the `x`, `y`, `scale`, and/or `angle` properties of ONLY the relevant sprites based on the command.
    
    Strict Rules:
    1. Modify the `sprites` list of dictionaries in-place. DO NOT overwrite or redefine the variable.
    2. ONLY modify sprites that match the user command! Leave untouched sprites completely unchanged.
    3. You MUST include simple, beginner-friendly comments (using #) explaining the math and logic step-by-step for a child learning to program.
    4. Output ONLY valid Python code inside ```python ``` tags.
    5. Position Guidelines:
       - 'middle' or 'center' means set `x = {center_x}` and `y = {center_y}`.
       - 'top left' means `x = 0`, `y = 0`.
       - 'bottom right' means `x = {max_x}`, `y = {max_y}`.
       - 'top right' means `x = {max_x}`, `y = 0`.
       - 'bottom left' means `x = 0`, `y = {max_y}`.
    6. For relative shifts, use deltas (e.g., `sprite['x'] += 100`, `sprite['y'] -= 50`).
    7. For scaling: 'grow', 'bigger', or 'larger' means multiply `scale`. 'shrink' or 'smaller' means divide `scale`.
    8. For rotation and spinning:
        - Update `angle` in degrees.
        - If asked to spin or rotate N times: multiply 360 by N! (e.g. "Spin 6 times" -> `sprite['angle'] += 360 * 6`).
        - DO NOT write incremental frame calculations. Add cumulative degrees directly.
    9. IMPORTANT: If the user says "animals" or "everyone", you MUST loop through and modify EVERY sprite in the list EXCEPT the humans.
    10. To DELETE a sprite: Use in-place list filtering. Example: `sprites[:] = [s for s in sprites if s['id'] != 'chicken']`
    11. To CREATE/ADD a sprite: Append a new dictionary to the list with a descriptive ID. Example: `sprites.append({{'id': 'tree_2', 'x': {center_x}, 'y': {center_y}, 'scale': 1.0, 'angle': 0.0}})`
    12. Continuous loops & Time:
        - NEVER write a Python `while` loop (it will freeze the execution).
        - To make a sprite move or spin 'forever' or 'continuously', assign velocity properties:
            * Move right continuously: `sprite['vx'] = 3`
            * Move left continuously: `sprite['vx'] = -3`
            * Move down continuously: `sprite['vy'] = 3`
            * Move up continuously: `sprite['vy'] = -3`
            * Spin forever: `sprite['v_angle'] = 5`
        - To STOP continuous movement, set `sprite['vx'] = 0`, `sprite['vy'] = 0`, `sprite['v_angle'] = 0`.
    """

    # dispatch to local Llama 3 instance with temp zero for deterministic output
    response = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3",
        "prompt": prompt,
        "temperature": 0,
        "stream": False
    })
    generated_text = response.json()['response']

    # extracts only executable Python from markdown formatting
    match = re.search(r'```(?:python)?\s*(.*?)```', generated_text, re.DOTALL | re.IGNORECASE)
    executable_code = match.group(1).strip() if match else generated_text.replace("```python", "").replace("```", "").strip()

    # sandboxed in-memory execution scope
    local_scope = {"sprites": canvas_metadata["sprites"]}
    try:
        exec(executable_code, {}, local_scope)
        updated_sprites = sanitize_and_clamp_sprites(local_scope["sprites"], max_x, max_y)
        print("\n--- Execution Success! New Coordinates ---")
        print(updated_sprites)
    except Exception as e:
        print(f"\n--- Execution Failed: {e} ---")
        updated_sprites = canvas_metadata["sprites"]

    return {
        "code": executable_code,
        "updated_sprites": updated_sprites
    }

def classify_audio_event(audio_path: str) -> dict:
    """
    Classifies non-speech acoustic scene events using Audio Spectrogram Transformer (AudioSet).
    Extracts the highest-confidence environmental sound label from the input recording.
    """
    try:
        results = audio_event_classifier(audio_path)
        top_prediction = results[0]
        detected_label = top_prediction["label"]
        confidence = float(top_prediction["score"])

        print(f"[AST Audio Event] Top Event: '{detected_label}' (Confidence: {confidence:.2f})")
        return {"event": detected_label, "confidence": round(confidence, 2)}
    except Exception as e:
        print(f"[AST Audio Event Error] Classification failed: {e}")
        return {"event": "Speech", "confidence": 1.0}

# --- API ENDPOINTS ---
@app.post("/upload-sprite")
async def upload_sprite(sprite_file: UploadFile = File(...)):
    """
    Visual Question Answering (VQA) Pipeline:
    Uses Salesforce BLIP conditioned on an explicit prompt to extract a clean,
    single-word semantic noun representing the uploaded sprite.
    """
    # read the uploaded sprite image
    image_data = await sprite_file.read()
    raw_image = Image.open(io.BytesIO(image_data)).convert('RGB')

    # conditioned VQA query
    question_prompt = "What animal or character is this?"
    inputs = blip_processor(raw_image, text=question_prompt, return_tensors="pt")
    out = blip_model.generate(**inputs, max_length=15)
    raw_answer = blip_processor.decode(out[0], skip_special_tokens=True)

    # fallback to standard caption if VQA answer is empty/repeated question
    if not raw_answer or raw_answer == question_prompt.lower():
        inputs = blip_processor(raw_image, return_tensors="pt")
        out = blip_model.generate(**inputs, max_length=20)
        raw_answer = blip_processor.decode(out[0], skip_special_tokens=True).strip().lower()

    # filter out common filler words and accessories
    stop_words = {
        "a", "an", "the", "photo", "picture", "image", "of", "in", "on", "at", 
        "with", "wearing", "dress", "shirt", "holding", "standing", "sitting",
        "cartoon", "style", "illustration", "isolated", "white", "background",
        "character", "vector", "art", "it", "is"
    }

    words = [w for w in re.findall(r'\b\w+\b', raw_answer) if w not in stop_words]
    # pick the primary identified subject
    label = words[0] if words else "sprite"

    print(f"[BLIP Sprite] Raw: '{raw_answer}' -> Clean Label: '{label}")
    return {
        "label": label,
        "full_caption": raw_answer
    }

@app.post("/upload-bg")
async def upload_background(bg_file: UploadFile = File(...)):
    """
    Image Captioning Pipeline:
    Generates an environmental description using BLIP and parses it into a short UI label.
    """
    image_data = await bg_file.read()
    raw_image = Image.open(io.BytesIO(image_data)).convert('RGB')

    # unconditional caption generation for a rich description
    inputs = blip_processor(raw_image, return_tensors="pt")
    out = blip_model.generate(**inputs, max_length=40)
    caption = blip_processor.decode(out[0], skip_special_tokens=True).strip().lower()

    # extract meaningful environment keywords
    meta_words = {
        "a", "an", "the", "cartoon", "style", "illustration", "drawing", "painting",
        "picture", "image", "vector", "art", "of", "in", "with", "by", "near", 
        "showing", "depicting", "features"
        }

    # extract true environment nouns (eg: 'village', 'ocean')
    meaningful = [w for w in re.findall(r'\b\w+\b', caption) if w not in meta_words]

    # create a clean 1-2 word label 
    if len(meaningful) >= 2:
        short_label = f"{meaningful[0]} {meaningful[1]}"
    elif len(meaningful) == 1:
        short_label = meaningful[0]
    else:
        short_label = "backdrop"

    print(f"[BLIP Backdrop] Full: '{caption}' -> Clean Label: '{short_label}'")
    return {"caption": caption, "label": short_label}


@app.post("/execute-code")
async def execute_code_directly(
    code: str = Form(...),
    canvas_state: str = Form(...)
):
    """
    Direct Execution Engine:
    Executes saved Python code directly against the current canvas state.
    """
    canvas_metadata = json.loads(canvas_state)
    canvas_w = int(canvas_metadata.get("canvas_width", 600))
    canvas_h = int(canvas_metadata.get("canvas_height", 500))
    max_x = canvas_w - SPRITE_SIZE
    max_y = canvas_h - SPRITE_SIZE

    local_scope = {
        "sprites": canvas_metadata["sprites"],
        "command": ""
    }

    try:
        exec(code, {}, local_scope)
        updated_sprites = local_scope["sprites"]

        for sprite in updated_sprites:
            sprite["x"] = clamp_position(sprite["x"], 0, max_x)
            sprite["y"] = clamp_position(sprite["y"], 0, max_y)
            try:
                sprite["scale"] = max(0.2, min(float(sprite.get("scale", 1.0)), 5.0))
            except (ValueError, TypeError):
                sprite["scale"] = 1.0
            try:
                sprite["angle"] = float(sprite.get("angle", 0.0))
            except (ValueError, TypeError):
                sprite["angle"] = 0.0

            # ensure velocities are clean floats/ints
            sprite["vx"] = float(sprite.get("vx", 0.0))
            sprite["vy"] = float(sprite.get("vy", 0.0))
            sprite["v_angle"] = float(sprite.get("v_angle", 0.0))

        print("\n--- Execution Success! New Coordinates ---")
        print(updated_sprites)
    except Exception as e:
        print(f"Direct Execution Error: {e}")
        updated_sprites = canvas_metadata["sprites"]

    return {
        "status": "success",
        "code": code,
        "updated_sprites": updated_sprites
    }

@app.post("/execute-text-command")
async def execute_text_command(
    command: str = Form(...),
    canvas_state: str = Form(...)
):
    """
    Text-based Generation Endpoint:
    Allows running types/example chip commands without requiring microphone speech input.
    """
    canvas_metadata = json.loads(canvas_state)
    cleaned_transcript = apply_semantic_correction(command, canvas_metadata)
    result = process_llm_logic(cleaned_transcript, canvas_metadata)

    return {
        "status": "success",
        "transcript": cleaned_transcript,
        "code": result["code"],
        "updated_sprites": result["updated_sprites"]
    }

@app.post("/generate")
async def generate_code(
    audio_file: UploadFile = File(...),
    canvas_state: str = Form(...)
):
    """
    Full Audio-to-Animation Pipeline
        1. Whisper transcribes audio speech to text.
        2. Levenshtein algorithm corrects acoustic or phonetic misspellings.
        3. Llama3 maps natural language + live state to Python code.
        4. Python execution engine produces new coordinates for Fabric.js.
    """
    # parse incoming JSON string back into a Python dictionary
    canvas_metadata = json.loads(canvas_state)

    # save recorded audio to a temporary system file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await audio_file.read())
        audio_path = tmp.name

    # transcribe audio 
    print("Transcribing audio...")
    try:
        # acoustic event detection (eg: clapping, whispering)
        audio_event = classify_audio_event(audio_path)
        # spoken language transcription
        audio_result = whisper_model.transcribe(audio_path)
        raw_transcript = audio_result["text"].strip()
        print(f"[Whisper ASR] Raw Transcript: {raw_transcript}'")
    finally:
        # immediately clean up the temporary file
        os.remove(audio_path)

    # check for non-speech acoustic action triggers
    detected_event = audio_event.get("event", "").lower()
    confidence = float(audio_event.get("confidence", 0.0))
    transcript_lower = raw_transcript.lower()

    # broad percussive keywords from AudioSet
    clapping_keywords = ["applause", "clapping", "hands", "percussion", "finger snapping", "slap", "knock"]
    is_clapping = any(k in detected_event for k in clapping_keywords)

    # detect whispering via acoustic or spoken words
    is_whispering = ("whispering" in detected_event) or ("whisper" in transcript_lower)

    # treat repetitive noise hallucinations as non-speech
    is_hallucination = bool(re.search(r'\b(pop|clap|thud|knock)\b', raw_transcript, re.IGNORECASE))
    has_no_speech = (not raw_transcript.strip()) or is_hallucination
    is_laughter = any(k in detected_event for k in ["laughter", "giggle", "chuckle", "snicker"])

    # read real canvas dimensions for clamping
    canvas_w = int(canvas_metadata.get("canvas_wdith", 600))
    canvas_h = int(canvas_metadata.get("canvas_height", 500))
    max_x = canvas_w - 50
    max_y = canvas_h - 50

    # trigger conditions
    if is_clapping and (has_no_speech or confidence >= 0.2):
        cleaned_transcript = "[Acoustic Trigger: Clapping detected! Everyone jump and celebrate!]"

        code = "# Acoustic Trigger Activated\nfor sprite in sprites:\n    sprite['y'] -= 80\n    sprite['angle'] += 360"

        local_scope = {"sprites": canvas_metadata["sprites"]}
        exec(code, {}, local_scope)
        updated_sprites = sanitize_and_clamp_sprites(local_scope["sprites"], max_x, max_y)
        result = {"code": code, "updated_sprites": updated_sprites}

    elif is_whispering:
        cleaned_transcript = "[Acoustic Trigger: Whispering detected! Everyone be sneaky!]"

        code = "# Acoustic Trigger Activated\nfor sprite in sprites:\n    sprite['scale'] = 0.5"

        local_scope = {"sprites": canvas_metadata["sprites"]}
        exec(code, {}, local_scope)
        updated_sprites = sanitize_and_clamp_sprites(local_scope["sprites"], max_x, max_y)
        result = {"code": code, "updated_sprites": updated_sprites}
    else:
        cleaned_transcript = apply_semantic_correction(raw_transcript, canvas_metadata)
        # llama3 logic generation & Python execution
        result = process_llm_logic(cleaned_transcript, canvas_metadata)

    # return new state: send updated coordinates back to the browser
    return {
        "status": "success", 
        "transcript": cleaned_transcript,
        "audio_event": audio_event,
        "code": result["code"],
        "updated_sprites": result["updated_sprites"]
    }