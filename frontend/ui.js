/**
    * ui.js
    * ==================================================
    * UI helper & syntax highlighting engine
    * Controls sidebar tabs, live status chips, dynamic typewriter effects,
    * and client-side Python syntax highlighting.
 **/

/**
 * Attaches click event listeners to toggle between 'Sprite' and 'Backdrop' sidebar panels.
 */
export function setupTabs() {
    // tab switching logic
    const tabSprites = document.getElementById('tab-sprites');
    const tabBackgrounds = document.getElementById('tab-backgrounds');
    const contentSprites = document.getElementById('content-sprites');
    const contentBackgrounds = document.getElementById('content-backgrounds');

    if (!tabSprites || !tabBackgrounds || !contentSprites || !contentBackgrounds) return;

    tabSprites.addEventListener('click', () => {
        tabSprites.classList.add('active');
        tabBackgrounds.classList.remove('active');
        contentSprites.style.display = 'flex';
        contentBackgrounds.style.display = 'none';
    });

    tabBackgrounds.addEventListener('click', () => {
        tabBackgrounds.classList.add('active');
        tabSprites.classList.remove('active');
        contentBackgrounds.style.display = 'flex';
        contentSprites.style.display = 'none';
    })
}


/**
 * Updates the global application status badge and transcript readout.
 */
export function updateStatus(className, statusMsg, transcriptMsg = null) {
    const statusInd = document.getElementById('statusIndicator');
    statusInd.className = className;
    statusInd.innerText = statusMsg;

    if (transcriptMsg !== null) {
        const transcriptText = document.getElementById('transcriptText');
        transcriptText.innerText = transcriptMsg;
        transcriptText.style.color = className === 'status-processing' ? '#999' : '#000';
    }
}

/**
 * Converts raw Python source code into HTML tokens using regular expressions.
 */
export function highlightPythonCode(code) {
    // escape special HTML characters first
    let escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // tokenise line-by-line so comments & strings don't conflict
    return escaped.split('\n').map(line => {
        // check if there is a comment in the line
        const commentIndex = line.indexOf('#');
        let codePart = line;
        let commentPart = '';

        if (commentIndex !== -1) {
            codePart = line.slice(0, commentIndex);
            commentPart = `<span class="token-comment">${line.slice(commentIndex)}</span>`;
        }

        // highlight strings in codePart
        codePart = codePart.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="token-string">$1</span>');

        // highlight numbers (avoiding matches inside span attributes)
        codePart = codePart.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');

        // highlight Python keywords
        codePart = codePart.replace(/\b(for|if|else|elif|in|while|def|return|and|or|not|import|from|as|None|True|False)\b/g, '<span class="token-keyword">$1</span>');

        // highlight built-ins & sprite identifier
        codePart = codePart.replace(/\b(sprites|print|range|len|min|max|int|float|str|next)\b/g, '<span class="token-builtins">$1</span>');

        return codePart + commentPart;
    }).join('\n');
}

// Typewriter Effect 
let typewriterTimeout;

/**
 * Streams code into a container one character at a time, applying syntax highlighting on completion.
 */
export function typeWriterEffect(text, elementId, speed = 20) {
    const terminalElement = document.getElementById(elementId);
    if (!terminalElement) return;

    // clear terminal & cancel any outgoing animation
    terminalElement.innerText = ""; 
    let i = 0;
    clearTimeout(typewriterTimeout);

    // stream characters one by one
    function type() {
        if (i < text.length) {
            terminalElement.innerText += text.charAt(i);
            i++;
            // auto-scroll to bottom as text generates
            terminalElement.scrollTop = terminalElement.scrollHeight;
            typewriterTimeout = setTimeout(type, speed);
        } else {
            // once finished, transform plain text into highlighted HTML
            terminalElement.innerHTML = highlightPythonCode(text);
            terminalElement.scrollTop = terminalElement.scrollHeight;
        }
    }
    type();
}

/**
 * Immediately renders highlighted code without typewriter effect
 */
export function displayTerminalCode(code) {
    const codeOutput = document.getElementById('codeOutput');
    if (!codeOutput) return;

    // apply the syntax colouring
    codeOutput.innerHTML = highlightPythonCode(code);
}