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
  .noterlight-action {
    position: absolute;
    background: #2196f3;
    color: white;
    padding: 4px 6px;
    border: none;
    font-size: 12px;
    border-radius: 4px;
    z-index: 99999;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
`;
document.head.appendChild(style);

const globalTooltip = document.createElement("div");
globalTooltip.className = "noter-tooltip";
document.body.appendChild(globalTooltip);

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
    setTimeout(() => {
      insertNoteButton(
        rect.left + window.scrollX,
        rect.top + window.scrollY,
        text
      );
    }, 50);
  } else {
    removeNoteButton();
  }
});

document.addEventListener("mousedown", (e) => {
  if (
    e.target.closest(".noterlight-ui") ||
    e.target.closest(".noterlight-action")
  )
    return;
  document.querySelectorAll(".noterlight-ui").forEach((el) => el.remove());
  document.querySelectorAll(".noterlight-action").forEach((el) => el.remove());
});

function insertNoteButton(x, y, selectedText) {
  removeNoteButton();
  const button = document.createElement("button");
  button.className = "noterlight-action";
  button.textContent = "📝";
  button.style.top = `${y - 35}px`;
  button.style.left = `${x}px`;
  document.body.appendChild(button);
  button.onclick = () => {
    console.log("Button clicked", x, y, selectedText);
    setTimeout(() => createNoteUI(x, y, selectedText), 50);
    button.remove();
  };
}

function removeNoteButton() {
  const existing = document.querySelector(".noterlight-action");
  if (existing) existing.remove();
}

function createNoteUI(x, y, selectedText) {
  document.querySelectorAll(".noterlight-ui").forEach((el) => el.remove());

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

    const key = window.location.origin + window.location.pathname;
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

function highlightSavedNotes() {
  const key = window.location.origin + window.location.pathname;
  chrome.storage.local.get([key], (data) => {
    const notes = data[key] || [];
    notes.forEach(({ text, note }) => highlightText(text, note));
  });
}

function highlightText(phrase, tooltip) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (
      node.nodeType === Node.TEXT_NODE &&
      node.nodeValue.includes(phrase) &&
      !node.parentNode.closest(".noterlight-ui")
    ) {
      const text = node.nodeValue;
      const parent = node.parentNode;
      const index = text.indexOf(phrase);
      if (index === -1) continue;

      const before = document.createTextNode(text.slice(0, index));
      const match = document.createElement("span");
      match.className = "noterlight-highlight";
      match.textContent = phrase;

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
      const frag = document.createDocumentFragment();
      frag.appendChild(before);
      frag.appendChild(match);
      frag.appendChild(after);

      parent.replaceChild(frag, node);
      break;
    }
  }
}

highlightSavedNotes();
