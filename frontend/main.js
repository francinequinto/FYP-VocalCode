/** 
 * main.js
 * ============================================
 * Client-side orchestration engine
 * Coordinates Fabric.js canvas updates, browser MediaRecorder audio captures,
 * BLIP computer-vision asset loading, and server synchronization.
**/ 

// --- MODULE IMPORTS ---
import { 
    setupTabs, 
    updateStatus, 
    typeWriterEffect
} from './ui.js';

import { 
    canvas, 
    initDefaultSprites, 
    spawnSprite, 
    resizeCanvasToParent, 
    setCanvasBackground, 
    resetCanvas, 
    getCanvasState, 
    animateUpdatedSprites, 
    setBackdropCaption 
} from './canvas.js';

import { 
    processBlip, 
    generateAction, 
    uploadSprite, 
    executeDirectCode 
} from './api.js';

// --- MAIN APPLICATION INITIALISATION ---
document.addEventListener("DOMContentLoaded", () => {
    // initialise UI tabs & canvas dimensions
    setupTabs();
    resizeCanvasToParent();
    initDefaultSprites();

    // re-adjust canvas size if window is resized
    window.addEventListener('resize', () => {
        resizeCanvasToParent();
    })

    // default backgrounds
    setCanvasBackground('assets/farm_bg.png', 'a farm');
    const bgCaptionText = document.getElementById('bgCaption');
    if (bgCaptionText) {
        bgCaptionText.innerText = 'AI Vision: "a farm"';
    }

    // asset containers for dynamic library cards
    const spriteGrid = document.querySelector('#content-sprites .sprite-grid');
    const bgGrid = document.querySelector('#content-backgrounds .sprite-grid');
    let customSpriteCounter = 1;

    // BACKGROUND VISION & UPLOAD HANDLING
    const bgBtn = document.getElementById('bgBtn');
    const bgUpload = document.getElementById('bgUpload');

    bgBtn.addEventListener('click', () => bgUpload.click());
    bgUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        bgCaptionText.innerText = "AI Vision: Scanning environment...";
        updateStatus("status-processing", "Analysing backdrop with BLIP...", "Analysing backdrop...");

        try {
            const data = await processBlip(file);
            const aiSuggested = data.label || "backdrop";

            // allow user to confirm or correct AI's detection
            const confirmedName = prompt(`AI detected scene: "${data.caption}". What would you like to call this backdrop?`, aiSuggested);
            const label = (confirmedName && confirmedName.trim()) ? confirmedName.trim().toLowerCase() : aiSuggested;
        
            setBackdropCaption(label);
            bgCaptionText.innerText =  `AI Vision: "${label}"`;

            // convert to URL for rendering
            const objectUrl = URL.createObjectURL(file);

            // immediately set canvas background
            setCanvasBackground(objectUrl, label);

            // add card to the backdrop library
            const shortLabel = label.split(' ').slice(0, 2).join(' ');
            const newBgCard = document.createElement('button');
            newBgCard.className = 'sprite-item bg-library-btn';
            newBgCard.innerHTML = `
                <img src="${objectUrl}" alt="${shortLabel}" class="library-thumb bg-thumb">
                <span>${shortLabel}</span>
            `;

            newBgCard.addEventListener('click', () => {
                setCanvasBackground(objectUrl, label);
                setBackdropCaption(label);
                if (bgCaptionText) bgCaptionText.innerText = `AI Vision: "${label}"`;
                updateStatus("status-success", `Status: Loaded ${shortLabel} backdrop!`);
            });

            if (bgGrid) bgGrid.appendChild(newBgCard);
            updateStatus("status-success", "Status: Backdrop added to library!");
        } catch (error) {
            console.error(error);
            bgCaptionText.innerText = "AI Vision: Failed to scan.";
            updateStatus("status-error", "Failed to upload backdrop.")
        } finally {
            bgUpload.value = '';
        }
    });

    // SPRITE VISION & UPLOAD HANDLING
    const spriteBtn = document.getElementById('spriteBtn');
    const spriteUpload = document.getElementById('spriteUpload');

    spriteBtn.addEventListener('click', () => spriteUpload.click());
    spriteUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        bgCaptionText.innerText = "AI Vision: Identifying sprite...";
        updateStatus("status-processing", "Detecting sprite name with BLIP...", "Analysing image...");

        try {
            // pass raw sprite image to BLIP VQA endpoint
            const data = await uploadSprite(file);
            const aiSuggested = data.label || "character";

            // allow user to confirm or correct AI's detection
            const confirmedName = prompt(`AI detected: "${aiSuggested}". What would you like to name this sprite?`, aiSuggested);
            const label = (confirmedName && confirmedName.trim()) ? confirmedName.trim().toLowerCase() : aiSuggested;
            bgCaptionText.innerText = `AI Vision: Identified "${label}"`;

            const objectUrl = URL.createObjectURL(file);

            // create & append the new sprite button to the library
            const newCard = document.createElement('button');
            newCard.className = 'sprite-item library-btn';
            newCard.dataset.type = label;
            newCard.innerHTML = `
                <img src="${objectUrl}" alt="${label}" class="library-thumb">
                <span>${label}</span>
            `;

            // spawns when clicked in library
            newCard.addEventListener('click', () => {
                const clickId = `${label}_${customSpriteCounter++}`;
                fabric.Image.fromURL(objectUrl, function(img) {
                    img.scaleToWidth(50);
                    img.set({
                        left: Math.random() * 300 + 100,
                        top: Math.random() * 200 + 100,
                        id: clickId,
                        angle: 0,
                        baseScale: img.scaleX
                    });
                    canvas.add(img);
                    updateStatus("status-success", `Status: Spawned ${clickId}!`);
                });
            });

            if (spriteGrid) spriteGrid.appendChild(newCard);

            // auto spawn first instance directly onto the canvas
            const firstId = `${label}_${customSpriteCounter++}`;
            fabric.Image.fromURL(objectUrl, function(img) {
                img.scaleToWidth(50);
                img.set({
                    left: Math.random() * 300 + 100,
                    id: firstId,
                    angle: 0,
                    baseScale: img.scaleX
                });
                canvas.add(img);
                updateStatus("status-success", `Added ${label} to library!`, `Identified: ${label}`);
            });
        } catch (error) {
            console.error(error);
            bgCaptionText.innerText = "AI Vision: Failed to identify sprite.";
            updateStatus("status-error", "Failed to upload sprite.");
        } finally {
            spriteUpload.value = '';
        }
    });

    // STATIC ASSET LIBRARY SELECTORS
    // sprite library buttons
    let spriteCounter = 1;
    document.querySelectorAll('.library-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.getAttribute('data-type');
            const uniqueId = `${type}_${spriteCounter++}`;
            
            spawnSprite(type, uniqueId, () => {
                updateStatus("status-success", `Status: Spawned ${uniqueId}!`);
            });
        });
    });

    // backdrop library buttons
    document.querySelectorAll('.bg-library-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const bgType = e.currentTarget.getAttribute('data-type');
            const bgPath = `assets/${bgType}.png`;
            const caption = `a ${bgType} background`;

            setCanvasBackground(bgPath, caption);

            if (bgCaptionText) {
                bgCaptionText.innerText = `AI Vision: "${caption}"`;
            }
            updateStatus("status-success", `Status: Loaded ${bgType} backdrop!`);
        });
    });

    // reset button - restores standard coordinates & clears additional sprites
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        document.getElementById('resetBtn').addEventListener('click', () => {
            resetCanvas();
            updateStatus("status-waiting", "Status: Canvas reset to start!");
    });
    }

    // AUDIO RECORDING LOGIC
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    const recordBtn = document.getElementById('recordBtn');

    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

                mediaRecorder.onstop = async () => {
                    updateStatus("status-processing", "Status: Sending to AI...", "Transcribing...");
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    audioChunks = [];

                    try {
                        const data = await generateAction(audioBlob, getCanvasState());

                        if (data.audio_event && data.transcript) {
                            const soundTag = document.getElementById('soundTag');
                            if (soundTag) {
                                soundTag.textContent = `Sound: ${data.audio_event.event} (${Math.round(data.audio_event.confidence * 100)}%)`;
                                soundTag.style.display = 'inline-flex';
                            }

                            // sound notification badge
                            const eventName = data.audio_event.event.toLowerCase();
                            const transcriptText = data.transcript || "";

                            if (eventName.includes("clapping") || eventName.includes("applause") || transcriptText.includes("Clapping detected")) {
                                updateStatus("status-success", "👏🏻 Clapping detected: Party mode!", transcriptText);
                            } else if (eventName.includes("whispering") || transcriptText.includes("Whispering detected")) {
                                updateStatus("status-success", "🤫 Whispering detected: Stealth mode!", data.transcript);
                            }
                        }
                        if (data.transcript) {
                            updateStatus("status-success", "Status: Success! Canvas updated.", `"${data.transcript}"`);
                        }
                        if (data.updated_sprites) {
                            typeWriterEffect(data.code, 'codeOutput');
                            animateUpdatedSprites(data.updated_sprites);
                            pushCommandHistory(data.transcript, data.code);
                        }
                    } catch (error) {
                        console.error("Audio generation error:", error);
                        updateStatus("status-error", "Status: Error connecting to server.", "Failed to process audio.");
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                recordBtn.innerText = "⏹ Stop & Sync";
                recordBtn.style.background = "#28a745";
                updateStatus("status-recording", "Status: Recording... Speak now!");
            } catch (err) {
                updateStatus("status-error", "Status: Microphone access required!");
            }
        } else {
            // stop recording & trigger send
            mediaRecorder.stop();
            isRecording = false;
            recordBtn.innerText = "Start Recording";
            recordBtn.style.background = "var(--action-orange)";
        }
    });

    // COMMAND HISTORY DECK (REPLAY)
    const commandHistory = [];
    const historyContainer = document.getElementById('historyPills');

    function pushCommandHistory(transcript, code) {
        // prevent duplicate consecutive entries
        if (commandHistory.length > 0 && commandHistory[0].transcript === transcript) {
            return;
        }

        commandHistory.unshift({ transcript, code });
        if (commandHistory.length > 8) commandHistory.pop(); // keep the 8 most recent commands

        renderHistoryPills();
    }

    function renderHistoryPills() {
        if (!historyContainer) return;
        historyContainer.innerHTML = '';

        commandHistory.forEach(item => {
            const pill = document.createElement('button');
            pill.className = 'history-pill';
            pill.title = 'Click to re-run this command';
            pill.innerHTML = `<span class="pill-icon">↻</span> "${item.transcript}"`;

            // re-execution against the current canvas state
            pill.addEventListener('click', async () => {
                updateStatus("status-processing", "Replaying command...", item.transcript);
                typeWriterEffect(item.code, 'codeOutput');

                try {
                    const data = await executeDirectCode(item.code, getCanvasState());
                    if (data.updated_sprites) {
                        animateUpdatedSprites(data.updated_sprites);
                        updateStatus("status-success", "Status: Command replayed!", `"${item.transcript}"`);
                    }
                } catch (err) {
                    console.error(err);
                    updateStatus("status-error", "Failed to replay command.");
                }
            });

            historyContainer.appendChild(pill);
        })
    }

    // HELP MODAL & EXAMPLE CHIP RUNNER
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpBtn = document.getElementById('closeHelpBtn');

    if (helpBtn && helpModal && closeHelpBtn) {
        helpBtn.addEventListener('click', () => {
            helpModal.style.display = 'flex';
        });

        closeHelpBtn.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });

        // close when clicking on background
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
    }

    // function to run text commands directly through the backend pipeline without microphone
    async function runExampleCommand(commandText) {
        updateStatus("status-processing", "Status: Processing command...", `"${commandText}"`);

        try {
            const liveState = getCanvasState();
            const formData = new FormData();
            formData.append('command', commandText);
            formData.append('canvas_state', JSON.stringify(liveState));

            // call the backend endpoint to parse the text command
            const response = await fetch('http://127.0.0.1:8000/execute-text-command', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.status === 'success') {
                typeWriterEffect(data.code, 'codeOutput');
                animateUpdatedSprites(data.updated_sprites);
                pushCommandHistory(data.transcript || commandText, data.code);
                updateStatus("status-success", "Status: Success! Canvas Updated.", `"${data.transcript || commandText}"`);
            } else {
                throw new Error(data.message || 'Execution error');
            }
        } catch (err) {
            console.error('Failed to run example command:', err);
            updateStatus("status-error", "Status: Error processing command.");
        }
    }

    // attach listeners to modal example chips
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
            const cmd = chip.getAttribute('data-cmd');
            helpModal.style.display = 'none';
            runExampleCommand(cmd);
        });
    });
});