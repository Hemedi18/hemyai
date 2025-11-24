document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;

    /**
     * Handles theme toggling and persists the choice in localStorage.
     */
    function initThemeToggler() {
        const themeToggler = document.getElementById('theme-toggler');
        if (!themeToggler) return;

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            body.classList.add('light-theme');
            themeToggler.textContent = '☀️';
        } else {
            body.classList.remove('light-theme');
            themeToggler.textContent = '🌙';
        }

        themeToggler.addEventListener('click', function() {
            body.classList.toggle('light-theme');
            if (body.classList.contains('light-theme')) {
                this.textContent = '☀️';
                localStorage.setItem('theme', 'light');
            } else {
                this.textContent = '🌙';
                localStorage.removeItem('theme');
            }
        });
    }

    /**
     * Handles the opening and closing of the chat history sidebar.
     */
    function initSidebar() {
        const sidebarToggler = document.getElementById('sidebar-toggler');
        const mainContainer = document.getElementById('main-container');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (!sidebarToggler || !mainContainer || !sidebarOverlay) return;

        sidebarToggler.addEventListener('click', () => mainContainer.classList.add('sidebar-active'));
        sidebarOverlay.addEventListener('click', () => mainContainer.classList.remove('sidebar-active'));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                mainContainer.classList.remove('sidebar-active');
            }
        });
    }

    /**
     * Takes a single AI message element, parses its content as Markdown,
     * and adds syntax highlighting and a copy button to code blocks.
     * @param {HTMLElement} aiMessageElement - The div element of the AI message.
     */
    function processAiMessage(aiMessageElement) {
        // Get the raw text and parse it into HTML using marked.js
        const rawContent = aiMessageElement.innerHTML;
        aiMessageElement.innerHTML = marked.parse(rawContent);

        // Find all code blocks within the newly parsed message
        aiMessageElement.querySelectorAll('pre code').forEach((block) => {
            // Apply syntax highlighting
            hljs.highlightElement(block);

            // Create a container for the code block and copy button
            const preElement = block.parentElement;
            const codeContainer = document.createElement('div');
            codeContainer.className = 'code-container';
            preElement.parentNode.insertBefore(codeContainer, preElement);
            codeContainer.appendChild(preElement);

            // Create and add the copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-code-btn';
            copyButton.innerHTML = '<i class="far fa-copy"></i> Copy';
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(block.textContent).then(() => {
                    copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => { copyButton.innerHTML = '<i class="far fa-copy"></i> Copy'; }, 2000);
                });
            });
            codeContainer.appendChild(copyButton);
        });
    }

    /**
     * Simulates a typewriter effect for the given text in the given element.
     * @param {HTMLElement} element - The element to type into.
     * @param {string} text - The full string to type out.
     * @param {function} callback - A function to call after typing is complete.
     */
    function typewriterEffect(element, text, callback) {
        let i = 0;
        element.innerHTML = ""; // Clear the element first
        const speed = 20; // Speed in milliseconds

        function type() {
            if (i >= text.length) {
                if (callback) callback();
                return;
            }

            // If the current character is the start of an HTML tag, find the end and add the whole tag at once
            if (text.charAt(i) === '<') {
                const tagEnd = text.indexOf('>', i);
                if (tagEnd !== -1) {
                    element.innerHTML += text.substring(i, tagEnd + 1);
                    i = tagEnd + 1;
                }
            } else {
                // Otherwise, just add the character
                element.innerHTML += text.charAt(i);
                i++;
            }
            chatBox.scrollTop = chatBox.scrollHeight; // Scroll as content is added
            setTimeout(type, speed);
        }
        type();
    }

    /**
     * Handles all logic related to the chat form, including submission,
     * loading animations, and fetching AI responses.
     */
    function initChatForm() {
        const chatForm = document.getElementById('chatForm');
        const userInput = document.getElementById('userInput');
        const chatBox = document.getElementById('chatBox');
        if (!chatForm || !userInput || !chatBox) return;

        // This variable will hold the current session ID
        let currentSessionId = new URLSearchParams(window.location.search).get('session_id');

        // --- LOADING ANIMATION FUNCTIONS ---
        function showLoadingAnimation() {
            const loadingHTML = `
                <div class="chat-message ai-message loading-dots">
                    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                </div>`;
            chatBox.insertAdjacentHTML('beforeend', loadingHTML);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        function removeLoadingAnimation() {
            const loadingDiv = chatBox.querySelector('.loading-dots');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }

        // --- TEXTAREA AUTO-RESIZE LOGIC ---
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = (userInput.scrollHeight) + 'px';
        });

        // --- KEYDOWN LOGIC (SUBMIT ON ENTER) ---
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
            }
        });

        // --- CHAT SUBMISSION LOGIC ---
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const userMessage = userInput.value.trim();
            if (userMessage === '') return;

            const userMessageHTML = `<div class="chat-message user-message">${userMessage}</div>`;
            chatBox.insertAdjacentHTML('beforeend', userMessageHTML);
            userInput.value = '';
            userInput.style.height = 'auto';
            chatBox.scrollTop = chatBox.scrollHeight;

            // Get the CSRF token just before fetching
            const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            showLoadingAnimation();

            fetch(getAIResponseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
                body: JSON.stringify({ 
                    'message': userMessage,
                    'session_id': currentSessionId 
                })
            })
            .then(response => response.json())
            .then(data => {
                removeLoadingAnimation();

                // Create a new div for the AI's message
                const aiMessageDiv = document.createElement('div');
                aiMessageDiv.classList.add('chat-message', 'ai-message');
                chatBox.appendChild(aiMessageDiv);

                // 1. Parse the raw markdown from the AI into HTML first.
                const formattedHtml = marked.parse(data.message);

                // Use the typewriter effect, and process the message once it's done typing.
                typewriterEffect(aiMessageDiv, formattedHtml, () => processAiMessage(aiMessageDiv));
                
                // If this was a new chat, we get a new session ID back
                // We reload the page with the new session_id to update the history list
                if (!currentSessionId && data.session_id) { 
                    window.location.href = `?session_id=${data.session_id}`;
                }
                chatBox.scrollTop = chatBox.scrollHeight;
            })
            .catch(error => {
                removeLoadingAnimation();
                const errorHTML = `<div class="chat-message ai-message">Sorry, something went wrong. Please try again.</div>`;
                chatBox.insertAdjacentHTML('beforeend', errorHTML);
                chatBox.scrollTop = chatBox.scrollHeight;
                console.error('Error:', error);
            });
        });
    }

    /**
     * Handles the help modal on the password change page.
     */
    function initHelpModal() {
        const helpBtn = document.getElementById('help-btn');
        const helpModal = document.getElementById('help-modal-overlay');
        const closeModal = document.getElementById('close-modal');
        if (!helpBtn || !helpModal || !closeModal) return;

        helpBtn.addEventListener('click', () => helpModal.style.display = 'flex');
        closeModal.addEventListener('click', () => helpModal.style.display = 'none');
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) { helpModal.style.display = 'none'; }
        });
    }

    // --- INITIALIZE ALL MODULES ---
    initThemeToggler();
    // Format any messages that were loaded from the server on page load
    document.querySelectorAll('.ai-message:not(.loading-dots)').forEach(processAiMessage);
    initSidebar();
    initChatForm();
    initHelpModal();
});
