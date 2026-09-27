/**
 *  canvas.js
 * ======================================================
 * Manages stage rendering, tween animations, continuous game loop physics,
 * coordinate boundary clamping, and two-way state synchronisation.
 **/

// --- CANVAS INITIALISATION ---
export const canvas = new fabric.Canvas('c');
export let currentBackdropCaption = "a blank white room";

/**
 * Updates semantic caption describing the active backdrop.
 * Used as contextual visual metadata for Llama 3 prompt construction.
 */
export function setBackdropCaption(caption) {
    currentBackdropCaption = caption;
}

// SPRITE LIFECYCLE & STAGE SPAWNERS

/**
 * Initialises default demo entities ('boy' and 'chicken') onto the canvas.
 * Records `baseScale` to maintain proportional scaling across transformations.
 */
export function initDefaultSprites() {
    fabric.Image.fromURL('assets/boy.png', function(img) {
        img.scaleToWidth(50);
        img.set({ 
            left: 100, 
            top: 200, 
            id: 'boy',
            angle: 0,
            baseScale: img.scaleX 
        });
        canvas.add(img);
    });
    fabric.Image.fromURL('assets/chicken.png', function(img) {
        img.scaleToWidth(50);
        img.set({ 
            left: 300, 
            top: 200, 
            id: 'chicken',
            angle: 0,
            baseScale: img.scaleX 
        });
        canvas.add(img);
    });
}

/**
 * Spawns a standard library asset with randomised canvas coordinates.
 */
export function spawnSprite(type, uniqueId, callback) {
    fabric.Image.fromURL(`./assets/${type}.png`, function(img) {
        img.scaleToWidth(50);
        img.set({
            left: Math.random() * 400 + 50,
            top: Math.random() * 300 + 50,
            id: uniqueId,
            angle: 0,
            baseScale: img.scaleX
        });
        canvas.add(img);
        if (callback) callback();
    });
}

/** 
 * Spawns a custom user-uplaoded sprite with a BLIP-generated noun ID.
 */
export function spawnCustomSprite(imageUrl, labelId, callback) {
    fabric.Image.fromURL(imageUrl, function(img) {
        img.scaleToWidth(50);
        img.set({
            left: Math.random() * 300 + 100,
            top: Math.random() * 200 + 100,
            id: labelId,
            angle: 0,
            baseScale: img.scaleX
        });
        canvas.add(img);
        if (callback) callback();
    });
}

// CANVAS GEOMETRY & BACKDROP CONTROLS
/**
 * Matches the HTML5 Canvas dimensions to its parent flex container.
 */
export function resizeCanvasToParent() {
    const container = document.querySelector('.canvas-container-custom');
    if (container) {
        canvas.setWidth(container.clientWidth);
        canvas.setHeight(container.clientHeight);
        canvas.renderAll();
    }
}

/** 
 * Applies a full-bleed backdrop image with cover scaling to eliminate border margins.
 */
export function setCanvasBackground(imageUrl, caption) {
    fabric.Image.fromURL(imageUrl, function(img) {
        // ensure canvas matches wrapper dimensions first
        const container = document.querySelector('.canvas-container-custom');
        if (container) {
            canvas.setWidth(container.clientWidth);
            canvas.setHeight(container.clientHeight);
        }

        // calculate the scale needed to cover both width & height of canvas
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const coverScale = Math.max(scaleX, scaleY);

        // cover scaling & center image to eliminate margins
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: coverScale,
            scaleY: coverScale,
            originX: 'center',
            originY: 'center',
            left: canvas.width / 2,
            top: canvas.height / 2
        });
        currentBackdropCaption = caption;
    })
}

/**
 * Restores demo entities to starting coordinates and removes dynamically spawned entities.
 */
export function resetCanvas() {
    const defaultState = { 
        'boy': { left: 100, top: 200}, 
        'chicken': { left: 300, top: 200} 
    };

    canvas.getObjects().forEach(obj => {
        if (defaultState[obj.id]) {
            // restore back to 50px scale factor and 0 degrees rotation
            const targetScale = obj.baseScale || (50 / obj.width);
            obj.vx = 0;
            obj.vy = 0;
            obj.v_angle = 0;

            obj.animate({
                left: defaultState[obj.id].left,
                top: defaultState[obj.id].top,
                scaleX: targetScale,
                scaleY: targetScale,
                angle: 0
            }, { 
                duration: 800, 
                onChange: canvas.renderAll.bind(canvas), 
                onComplete: () => obj.setCoords(), 
                easing: fabric.util.ease.easeOutQuad 
            });
        } else {
            canvas.remove(obj);
        }
    });
}

// CANVAS STATE EXTRACTOR (JSON)

/**
 * Serialises active stage entities and physical properties into JSON metadata for Llama3.
 */
export function getCanvasState() {
    const sprites = canvas.getObjects().map(obj => {
        if (!obj.baseScale) {
            obj.baseScale = obj.scaleX || 1;
        }

        // normalize: current scale divided by initial base scale (defaults to 1.0)
        const normalizedScale = Number((obj.scaleX / obj.baseScale).toFixed(2));

        return {
            id: obj.id,
            x: Math.round(obj.left),
            y: Math.round(obj.top),
            scale: normalizedScale || 1.0,
            angle: Math.round(obj.angle || 0),
            vx: obj.vx || 0.0,
            vy: obj.vy || 0.0,
            v_angle: obj.v_angle || 0.0
        };
    });

    return { 
        sprites: sprites, 
        backdrop: currentBackdropCaption, 
        canvas_width: Math.round(canvas.width),
        canvas_height: Math.round(canvas.height)
    };
}

// ANIMATION SYNCHRONISATION & DIFF ENGINE

/** 
 * Synchronises stage state with the Python output dictionary:
 * - Handles entity deletions (in-place list filtering)
 * - Tweens position, scale, and multi-turn rotation
 * - Dynamically spawns new entities added to the list
 */
export function animateUpdatedSprites(updated_sprites) {
    const currentCanvasObjects = canvas.getObjects();

    // 1) deletions: remove objects that Python deleted from the list
    currentCanvasObjects.forEach(canvasObj => {
        if (!canvasObj.id) return;
        const stillExists = updated_sprites.find(s => s.id === canvasObj.id);
        if (!stillExists) {
            canvas.remove(canvasObj);
        }
    });

    // 2) updates & creations
    updated_sprites.forEach(updatedSprite => {
        const canvasObject = canvas.getObjects().find(obj => obj.id === updatedSprite.id);

        if (canvasObject) {
            // update existing sprite 
            if (!canvasObject.baseScale) {
                canvasObject.baseScale = canvasObject.scaleX;
            }
                // apply continuous velocities if Python provided them
                canvasObject.vx = updatedSprite.vx !== undefined ? Number(updatedSprite.vx) : 0;
                canvasObject.vy = updatedSprite.vy !== undefined ? Number(updatedSprite.vy) : 0;
                canvasObject.v_angle = updatedSprite.v_angle !== undefined ? Number(updatedSprite.v_angle) : 0;

                // multiply stored base scale by the normalised multiplier from Python
                const multiplier = updatedSprite.scale !== undefined ? Number(updatedSprite.scale) : 1.0;
                const targetScaleX = canvasObject.baseScale * multiplier;
                const targetScaleY = canvasObject.baseScale * multiplier;
                const targetAngle = updatedSprite.angle !== undefined ? Number(updatedSprite.angle) : (canvasObject.angle || 0);

                // calculate rotation distance to scale animation speed
                const angleDelta = Math.abs(targetAngle - (canvasObject.angle || 0));
                const fullSpins = Math.floor(angleDelta / 360);

                // give each full 360 spin, with a baseline duration of 800ms
                const animDuration = fullSpins > 0 ? fullSpins * 500 : 800;

                canvasObject.animate({
                        left: updatedSprite.x,
                        top: updatedSprite.y,
                        scaleX: targetScaleX,
                        scaleY: targetScaleY,
                        angle: targetAngle
                    }, {
                        duration: animDuration,
                        onChange: canvas.renderAll.bind(canvas),
                        onComplete: () => {
                            // normalise internal angle to 0-360 range once animation completes
                            canvasObject.set('angle', canvasObject.angle % 360);
                            canvasObject.setCoords();
                            canvas.renderAll();
                        },
                        easing: fullSpins > 0 ? fabric.util.ease.easeInOutQuad : fabric.util.ease.easeOutQuad
                    });
        } else {
            // create new sprite
            // extract core asset name (eg: "tree_99" loads "tree.png")
            const baseType = updatedSprite.id.split('_')[0];

            fabric.Image.fromURL(`./assets/${baseType}.png`, function(img) {
                img.scaleToWidth(50);

                const multiplier = updatedSprite.scale !== undefined ? Number(updatedSprite.scale) : 1.0;
                const baseScale = img.scaleX;

                img.set({
                    left: updatedSprite.x,
                    top: updatedSprite.y,
                    id: updatedSprite.id,
                    angle: updatedSprite.angle !== undefined ? Number(updatedSprite.angle) : 0,
                    baseScale: baseScale,
                    scaleX: baseScale * multiplier,
                    scaleY: baseScale * multiplier
                });
                canvas.add(img);
            });
        }
    });
}
// CONTINUOUS GAME LOOP 

/**
 * Processes persistent velocities (`vx`, `vy`, `v_angle`) and enforces boundary collisions.
 */
function gameLoop() {
    let needsRender = false;

    canvas.getObjects().forEach(obj => {
        // only evaluate objects that have non-zero velocities
        if (obj.vx || obj.vy || obj.v_angle) {
            needsRender = true;

            // horizontal movement & edge clamping
            if (obj.vx) {
                const spriteWidth = obj.getScaledWidth() || 50;
                const maxLeft = canvas.width - spriteWidth;
                const nextLeft = obj.left + obj.vx;

                if (nextLeft <= 0) {
                    obj.set('left', 0);
                    obj.vx = 0; // stop moving when hits the left wall
                } else if (nextLeft >= maxLeft) {
                    obj.set('left', maxLeft);
                    obj.vx = 0; // stop moving when hits the right wall
                } else {
                    obj.set('left', nextLeft);
                }
            }

            // vertical movement & edge clamping
            if (obj.vy) {
                const spriteHeight = obj.getScaledHeight() || 50;
                const maxTop = canvas.height - spriteHeight;
                const nextTop = obj.top + obj.vy;

                if (nextTop <= 0) {
                    obj.set('top', 0);
                    obj.vy = 0; // stop moving when hit the top
                } else if (nextTop >= maxTop) {
                    obj.set('top', maxTop);
                    obj.vy = 0; // stop moving when hit the floor
                } else {
                    obj.set('top', nextTop);
                }
            }

            // rotational velocity
            if (obj.v_angle) {
                obj.set('angle', (obj.angle + obj.v_angle) % 360);
            }
        }
        
    });
    if (needsRender) {
        // keeps coords updated so collisions & boundary checks work later
        canvas.getObjects().forEach(obj => obj.setCoords());
        canvas.renderAll();
    }
    requestAnimationFrame(gameLoop);
}
// start loop immediately
gameLoop();

// HOVER COORDINATE TOOLTIP
export function setupCanvasHoverTooltip() {
    const tooltip = document.getElementById('coordTooltip');
    if (!tooltip) return;

    // show tooltip on hover over a sprite
    canvas.on('mouse:over', (e) => {
        if (e.target && e.target.id) {
            const x = Math.round(e.target.left);
            const y = Math.round(e.target.top);
            tooltip.textContent = `${e.target.id.toUpperCase()} (x: ${x}, y: ${y})`;
            tooltip.styleleft = `${e.target.left + (e.target.getScaledWidth() / 2)}px`;
            tooltip.style.top = `${e.target.top}px`;
            tooltip.style.display = 'block';
        }
    });

    // update position if moving the mouse or while dragging
    canvas.on('mouse:move', (e) => {
        if (e.target && e.target.id) {
            const x = Math.round(e.target.left);
            const y = Math.round(e.target.top);
            tooltip.textContent = `${e.target.id.toUpperCase()} (x: ${x}, y: ${y})`;
            tooltip.style.left = `${e.target.left + (e.target.getScaledWidth() / 2)}px`;
            tooltip.style.top = `${e.target.top}px`;
        }
    });

    // hide tooltip when pointer leaves the sprite
    canvas.on('mouse:out', () => {
        tooltip.style.display = 'none';
    });
}

// initialise tooltip listeners
setupCanvasHoverTooltip();