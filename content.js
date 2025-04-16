const style = document.createElement("style");
style.textContent = `
  .noter-tooltip {
    position: absolute;
    background: #333;
    color: #fff;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 4px;
    white-space: pre-wrap;
    max-width: 250px;
    z-index: 999999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .noterlight-highlight {
    background: #ffff88;
    padding: 1px 2px;
    border-radius: 3px;
    cursor: help;
  }
`;
document.head.appendChild(style);

const globalTooltip = document.createElement("div");
globalTooltip.className = "noter-tooltip";
document.body.appendChild(globalTooltip);

// Flag to prevent multiple simultaneous highlighting operations
let isHighlightingInProgress = false;

document.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (
    text.length > 1 &&
    !selection.isCollapsed &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showNoteForm(rect.left + window.scrollX, rect.top + window.scrollY, text);
  }
});

document.addEventListener("mousedown", (e) => {
  const ui = document.querySelector(".noterlight-ui");
  if (ui && !ui.contains(e.target)) ui.remove();
});

function showNoteForm(x, y, selectedText) {
  removeExistingForm();

  const container = document.createElement("div");
  container.className = "noterlight-ui";
  Object.assign(container.style, {
    position: "absolute",
    top: `${y + 10}px`,
    left: `${x}px`,
    background: "#fff",
    border: "1px solid #ccc",
    padding: "8px",
    zIndex: "99999",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    fontFamily: "sans-serif",
    maxWidth: "200px",
    borderRadius: "5px",
  });

  const textarea = document.createElement("textarea");
  textarea.rows = 3;
  textarea.placeholder = "Add Note...";
  textarea.style.width = "100%";
  textarea.style.boxSizing = "border-box";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save Note";
  Object.assign(saveBtn.style, {
    marginTop: "5px",
    width: "100%",
    cursor: "pointer",
  });

  saveBtn.onclick = () => {
    const note = textarea.value.trim();
    if (!note) return textarea.focus();

    const key = window.location.href;
    const shortText = selectedText.slice(0, 80);

    chrome.storage.local.get([key], (data) => {
      const notes = data[key] || [];
      notes.push({ text: shortText, note });

      chrome.storage.local.set({ [key]: notes }, () => {
        chrome.runtime.sendMessage({
          action: "newNoteAdded",
          payload: { url: key, entry: { text: shortText, note } },
        });
        container.remove();
        highlightText(shortText, note);
      });
    });
  };

  container.appendChild(textarea);
  container.appendChild(saveBtn);
  document.body.appendChild(container);
}

function removeExistingForm() {
  document.querySelectorAll(".noterlight-ui").forEach((el) => el.remove());
}

function highlightNotesOnPage() {
  // Prevent multiple simultaneous operations
  if (isHighlightingInProgress) return;

  isHighlightingInProgress = true;

  const key = window.location.href;
  chrome.storage.local.get([key], (data) => {
    const notes = data[key] || [];

    // Clear existing highlights first to prevent duplicates
    clearExistingHighlights();

    // Apply highlights for each note
    notes.forEach(({ text, note }) => highlightText(text, note));

    isHighlightingInProgress = false;
  });
}

function clearExistingHighlights() {
  // Find all highlighted elements
  const highlights = document.querySelectorAll(".noterlight-highlight");

  // Replace each highlight with its text content
  highlights.forEach((highlight) => {
    const textNode = document.createTextNode(highlight.textContent);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
}

function highlightText(phrase, tooltip) {
  if (!phrase || phrase.length < 2) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip nodes that are already in UI elements or highlights
        if (
          node.parentNode.closest(".noterlight-ui") ||
          node.parentNode.classList.contains("noterlight-highlight") ||
          node.parentNode.tagName === "SCRIPT" ||
          node.parentNode.tagName === "STYLE"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Accept nodes that contain our phrase
        if (node.nodeValue.includes(phrase)) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      },
    },
    false
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue;
    const index = text.indexOf(phrase);

    if (index === -1) continue;

    const parent = node.parentNode;
    const before = document.createTextNode(text.slice(0, index));
    const match = document.createElement("span");
    match.className = "noterlight-highlight";
    match.textContent = phrase;
    match.dataset.note = tooltip; // Store note data in the element

    match.addEventListener("mouseenter", () => {
      globalTooltip.textContent = tooltip;
      const rect = match.getBoundingClientRect();
      globalTooltip.style.top = `${rect.top + window.scrollY - 30}px`;
      globalTooltip.style.left = `${rect.left + window.scrollX}px`;
      globalTooltip.style.opacity = "1";
    });

    match.addEventListener("mouseleave", () => {
      globalTooltip.style.opacity = "0";
    });

    const after = document.createTextNode(text.slice(index + phrase.length));
    const fragment = document.createDocumentFragment();
    fragment.appendChild(before);
    fragment.appendChild(match);
    fragment.appendChild(after);

    parent.replaceChild(fragment, node);
    walker.currentNode = after;
  }
}

// Initialize highlighting when the page is fully loaded
window.addEventListener("load", () => {
  setTimeout(highlightNotesOnPage, 500); // Small delay to ensure DOM is fully ready
});

// Re-apply highlights when the DOM changes (for dynamic websites)
const observer = new MutationObserver((mutations) => {
  // Don't trigger while another highlighting operation is in progress
  if (isHighlightingInProgress) return;

  // Wait a bit to batch multiple DOM changes
  clearTimeout(window.highlightDebounce);
  window.highlightDebounce = setTimeout(highlightNotesOnPage, 500);
});

// Configure the observer to watch for changes to the DOM structure
observer.observe(document.body, {
  childList: true, // watch for changes to the direct children
  subtree: true, // watch for changes to the entire subtree
  characterData: true, // watch for changes to text content
});

// Also refresh highlights when the page visibility changes
// (handles cases when user returns to a tab)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    setTimeout(highlightNotesOnPage, 500);
  }
});

// Run initial highlighting
highlightNotesOnPage();

// Listen for storage changes to apply new highlights from other tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    const currentUrl = window.location.href;

    // Check if the change is for our current URL
    if (changes[currentUrl]) {
      setTimeout(highlightNotesOnPage, 100);
    }
  }
});
