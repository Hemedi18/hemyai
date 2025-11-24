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
        // If element has no child elements, assume it contains raw markdown text and parse it.
        if (aiMessageElement.children.length === 0) {
            const rawContent = aiMessageElement.textContent;
            aiMessageElement.innerHTML = marked.parse(rawContent);
        }

        // Now find and enhance code blocks (works whether we just parsed or it was already HTML)
        aiMessageElement.querySelectorAll('pre code').forEach((block) => {
            // Apply syntax highlighting
            hljs.highlightElement(block);

            // Avoid wrapping the same pre twice
            const preElement = block.parentElement;
            if (preElement.parentElement && preElement.parentElement.classList.contains('code-container')) return;

            // Create a container for the code block and copy button
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
    function typewriterEffect(element, rawText, callback) {
        // Type plain text into element.textContent, then call callback(rawText)
        let i = 0;
        element.textContent = ''; // ensure plain text while typing
        const speed = 15; // ms per character

        // find chat box to keep it scrolled
        const chatBoxEl = element.closest('#chatBox') || document.getElementById('chatBox');

        function step() {
            if (i >= rawText.length) {
                if (typeof callback === 'function') callback(rawText);
                return;
            }
            element.textContent += rawText.charAt(i);
            i++;
            if (chatBoxEl) chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
            setTimeout(step, speed);
        }
        step();
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

        // track how many messages are currently shown to append only new ones
        let lastMessageCount = chatBox.querySelectorAll('.chat-message').length;

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

                // Use typewriter on RAW markdown, then parse & enhance once typing finishes
                typewriterEffect(aiMessageDiv, data.message, (raw) => {
                    aiMessageDiv.innerHTML = marked.parse(raw);
                    processAiMessage(aiMessageDiv);
                    aiMessageDiv.dataset.formatted = 'true';
                });
                
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

        // --- POLLING FOR NEW MESSAGES (every 2s) ---
        // Requires getMessagesUrl to be set in the template (e.g. "/api/chat/messages/")
        
        // Fix messages that were inserted as plain text (no children) by parsing them to HTML
        function fixUnformattedMessages() {
            document.querySelectorAll('.ai-message:not(.loading-dots)').forEach(el => {
                // skip if already processed
                if (el.dataset.formatted === 'true') return;
                if (el.children.length === 0) {
                    const raw = el.textContent.trim();
                    if (!raw) return;
                    el.innerHTML = marked.parse(raw);
                    processAiMessage(el);
                    el.dataset.formatted = 'true';
                } else {
                    // if element already contains HTML, ensure process has run once
                    if (!el.dataset.formatted) {
                        processAiMessage(el);
                        el.dataset.formatted = 'true';
                    }
                }
            });
        }

        function pollNewMessages() {
            if (typeof getMessagesUrl === 'undefined') return; // noop if not provided
            if (!currentSessionId) return; // wait until we have a session

            fetch(`${getMessagesUrl}?session_id=${encodeURIComponent(currentSessionId)}`, {
                headers: { 'Accept': 'application/json' }
            })
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data.messages)) return;
                const total = data.messages.length;
                if (total > lastMessageCount) {
                    const newMsgs = data.messages.slice(lastMessageCount);
                    newMsgs.forEach(msg => {
                        if (msg.sender === 'user') {
                            chatBox.insertAdjacentHTML('beforeend', `<div class="chat-message user-message">${msg.content}</div>`);
                        } else {
                            const aiDiv = document.createElement('div');
                            aiDiv.classList.add('chat-message', 'ai-message');
                            // insert raw text for typewriter or immediate parse:
                            aiDiv.textContent = msg.content;
                            chatBox.appendChild(aiDiv);
                            // mark as unformatted; next fixUnformattedMessages call will parse & enhance
                        }
                    });
                    lastMessageCount = total;
                    chatBox.scrollTop = chatBox.scrollHeight;
                }

                // Always attempt to fix any AI messages that are still raw/plain-text
                fixUnformattedMessages();
            })
            .catch(err => {
                console.debug('pollNewMessages error', err);
            });
        }

        // start polling every 2 seconds
        const pollInterval = setInterval(pollNewMessages, 2000);
        window.addEventListener('beforeunload', () => clearInterval(pollInterval));

        // run once immediately to sync & fix formatting of existing messages
        pollNewMessages();
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
