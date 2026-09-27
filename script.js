document.addEventListener("DOMContentLoaded", function() {
        console.log("HTML loaded, initialising Fabric.js...");
        
        // 1) initialise the canvas
        const canvas = new fabric.Canvas('c');

        

        // 2) create default sprites
        fabric.Image.fromURL('assets/farmer.png', function(img) {
            img.scaleToWidth(50);
            img.set({
                left: 100,
                top: 200,
                id: 'boy'
            });
            canvas.add(img);
            canvas.renderAll();
        })
        
        fabric.Image.fromURL('assets/chicken.png', function(img) {
            img.scaleToWidth(50);
            img.set({
                left: 300,
                top: 200,
                id: 'chicken'
            });
            canvas.add(img);
            canvas.renderAll();
            console.log("Default sprites drawn on canvas!");
        })
        
        // 5) blip background logic
        let currentBackdropCaption = "a blank white room";
        const bgBtn = document.getElementById('bgBtn');
        const bgUpload = document.getElementById('bgUpload');
        const bgCaptionText = document.getElementById('bgCaption');

        bgBtn.addEventListener('click', () => bgUpload.click());

        bgUpload.addEventListener('click', () => bgUpload.click())

        bgUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // a) draw image to canvas background
            const reader = new FileReader();
            reader.onload = function(f) {
                fabric.Image.fromURL(f.target.result, function(img) {
                    // apply scaling directly to the background configuration
                    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                        scaleX: canvas.width / img.width,
                        scaleY: canvas.height / img.height
                    });
                });
            };
            reader.readAsDataURL(file);

            // b) send image to BLIP for captioning
            bgCaptionText.innerText = "AI Vision: Scanning environment...";
            const formData = new FormData();
            formData.append("bg_file", file);

            try {
                const response = await fetch("http://localhost:8000/upload-bg", {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();
                currentBackdropCaption = data.caption;
                bgCaptionText.innerText = `AI Vision: "${currentBackdropCaption}"`;
            } catch (error) {
                console.error("BLIP error", error);
                bgCaptionText.innerText = "AI Vision: Failed to scan.";
            }
        })

        // 6) blip sprite logic
        const spriteBtn = document.getElementById('spriteBtn');
        const spriteUpload = document.getElementById('spriteUpload');

        spriteBtn.addEventListener('click', () => spriteUpload.click());

        spriteUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // a) send to BLIP to automatically generate a variable name
            bgCaptionText.innerText = "AI Vision: Identifying sprite...";
            const formData = new FormData();
            formData.append("bg_file", file); // we can reuse the same api endpoint!

            try {
                const response = await fetch("http://localhost:8000/upload-bg", {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();
                const spriteName = data.caption; // eg: "a brown dog"
                bgCaptionText.innerText = `AI Vision: Added "${spriteName}"`;

                // b) draw the image on the canvas and assign the AI name as the ID
                const reader = new FileReader();
                reader.onload = function(f) {
                    fabric.Image.fromURL(f.target.result, function(img) {
                        img.scaleToWidth(80); // scale down to sprite size
                        img.set({
                            left: Math.random() * 400 + 50, // drop it at a random location
                            top: Math.random() * 300 + 50,
                            id: spriteName 
                        });
                        canvas.add(img);
                        canvas.renderAll();
                    });
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error("Sprite error", error);
                bgCaptionText.innerText = "AI Vision: Failed to identify sprite."
            }
        });

        // sprite library logic
        const libraryBtns = document.querySelectorAll('.library-btn');
        let spriteCounter = 1; // ensures every new sprite has a unique ID

        libraryBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.getAttribute('data-type');
                // const color = e.target.getAttribute('data-color');
                const uniqueId = `${type}_${spriteCounter++}`;

                // dynamically build img path based on button's data-type
                const imageUrl = `./assets/${type}.png`;

                fabric.Image.fromURL(imageUrl, function(img) {
                    img.scaleToWidth(50); // match backend sprite_size
                    img.set({
                        left: Math.random() * 400 + 50,
                        top: Math.random() * 300 + 50,
                        id: uniqueId
                    });
                    canvas.add(img);
                    canvas.renderAll();

                    // status indicator
                    const statusInd = document.getElementById('statusIndicator');
                    statusInd.innerText = `Status: Spawned ${uniqueId}!`;
                    statusInd.className = "status-success";
                })
            })
        })

        // reset logic
        // define starting coordinates for default sprites
        const defaultState = {
            'knight': { left: 100, top: 200, scaleX: 1, scaleY: 1 },
            'dragon': { left: 300, top: 200, scaleX: 1, scaleY: 1 }
        };

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // 1. get all current objects on the canvas
                const allObjects = canvas.getObjects();

                // 2. loop through and either reset or remove them
                allObjects.forEach(obj => {
                    if (defaultState[obj.id]) {
                        // if it's a default sprite, animate it back to start & scale back to default
                        obj.animate({
                            left: defaultState[obj.id].left,
                            top: defaultState[obj.id].top,
                            scaleX: defaultState[obj.id].scaleX,
                            scaleY: defaultState[obj.id].scaleY
                        }, {
                            duration: 800,
                            onChange: canvas.renderAll.bind(canvas),
                            onComplete: () => obj.setCoords(),
                            easing: fabric.util.ease.easeOutQuad
                        });
                    } else {
                        // if it's an uploaded sprite, remove it
                        canvas.remove(obj)
                    }
                });

                // reset the status text to give the user feedback
                const statusInd = document.getElementById('statusIndicator');
                statusInd.innerText = "Status: Canvas reset to start!";
                statusInd.className = "status-waiting";
                console.log("Canvas reset triggered.");
            });
        }

        // 7) scraper function
        function getCanvasState() {
            const sprites = canvas.getObjects().map(obj => ({
                id: obj.id,
                x: Math.round(obj.left),
                y: Math.round(obj.top)
            }));
            return {
                sprites: sprites,
                backdrop: currentBackdropCaption
            };
        }



        // 8) audio recording variables
        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;
        const recordBtn = document.getElementById('recordBtn');
        const statusIndicator = document.getElementById('statusIndicator');
        const transcriptText = document.getElementById('transcriptText');

        // 9) mic capture and send logic
        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                // START RECORDING
                try {
                    // some code to handle the audio blob
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                    mediaRecorder = new MediaRecorder(stream);

                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = async () => {
                        statusIndicator.className = "status-processing";
                        statusIndicator.innerText = "Status: Sending to AI...";
                        transcriptText.innerText = "Transcribing...";
                        transcriptText.style.color = "#999";

                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        audioChunks = [];

                        // package the audio and canvas state together
                        const formData = new FormData();
                        formData.append("audio_file", audioBlob, "live_input.wav");
                        formData.append("canvas_state", JSON.stringify(getCanvasState()));

                        try {
                            const response = await fetch("http://localhost:8000/generate", {
                                method: "POST",
                                body: formData
                            });
                            const data = await response.json();
                            console.log("Python Backend Says:", data);

                            if (data.transcript){
                                transcriptText.innerText = `"${data.transcript}"`;
                                transcriptText.style.color = "#000";
                            }

                            // animation logic
                            if (data.updated_sprites) {
                                // print Python onto the screen dynamically
                                typeWriterEffect(data.code, 'codeOutput', 35);

                                data.updated_sprites.forEach(updatedSprite => {
                                    // find the matching fabric.js object by its ID
                                    const canvasObject = canvas.getObjects().find(obj => obj.id === updatedSprite.id);

                                    if (canvasObject) {
                                        // smoothly animate the sprite to its new X and Y coordinates
                                        canvasObject.animate({
                                            left: updatedSprite.x,
                                            top: updatedSprite.y
                                        }, {
                                            duration: 800,
                                            onChange: canvas.renderAll.bind(canvas),
                                            onComplete: () => canvasObject.setCoords(),
                                            easing: fabric.util.ease.easeOutQuad
                                        });
                                    }
                                });
                            }

                            statusIndicator.className = "status-success";
                            statusIndicator.innerText = "Status: Success! Canvas updated.";
                        } catch (error) {
                            console.error("Server error", error);
                            statusIndicator.className = "status-error";
                            statusIndicator.innerText = "Status: Error connecting to server.";
                            transcriptText.innerText = "Failed to process audio.";
                        }
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    recordBtn.innerText = "⏹ Stop & Sync";
                    recordBtn.style.background = "#28a745";

                    statusIndicator.className = "status-recording";
                    statusIndicator.innerText = "Status: Recording... Speak now!";

                } catch (err) {
                    console.error("Microphone access denied:", err);
                    statusIndicator.className = "status-error";
                    statusIndicator.innerText = "Status: Microphone access required!";
                }
            } else {
                // STOP RECORDING & TRIGGER SEND
                mediaRecorder.stop();
                isRecording = false;
                recordBtn.innerText = "Start Recording";
                recordBtn.style.background = "linear-gradient(135deg, #a855f7, #c0845c)";
            }
        });
    });