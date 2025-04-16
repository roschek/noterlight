document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("notes");
  list.innerHTML = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    chrome.storage.local.get([url], (data) => {
      const notes = data[url] || [];

      if (notes.length === 0) {
        const li = document.createElement("li");
        li.textContent = "There aren't notes yet.";
        list.appendChild(li);
        return;
      }

      notes.forEach((entry, index) => {
        const li = document.createElement("li");

        const span = document.createElement("span");
        span.textContent = `"${entry.text}" → ${entry.note}`;
        li.appendChild(span);

        const del = document.createElement("button");
        del.textContent = "🗑";
        del.style.float = "right";
        del.style.border = "none";
        del.style.background = "transparent";
        del.style.cursor = "pointer";
        del.title = "Remove note";

        del.addEventListener("click", () => {
          notes.splice(index, 1);
          chrome.storage.local.set({ [url]: notes }, () => {
            location.reload();
          });
        });

        li.appendChild(del);
        list.appendChild(li);
      });
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "newNoteAdded") {
    const { url, entry } = message.payload;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].url === url) {
        const list = document.getElementById("notes");

        if (list.textContent.includes("There aren't notes yet.")) {
          list.innerHTML = "";
        }

        const li = document.createElement("li");
        li.textContent = `"${entry.text}" → ${entry.note}`;
        list.appendChild(li);
      }
    });
  }
});
