(() => {
  const ACTION_CLASS = "message-actions";

  const style = document.createElement("style");
  style.textContent = `
    .${ACTION_CLASS}{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:7px;border-top:1px solid rgba(107,114,128,.18)}
    .message-action{width:auto;min-height:30px;padding:4px 8px;border:1px solid #d1d5db;border-radius:999px;background:rgba(255,255,255,.45);color:#4b5563;font-size:12px;font-weight:800;line-height:1.2}
    button.message-action{width:auto;min-height:30px;border:1px solid #d1d5db;border-radius:999px;background:rgba(255,255,255,.45);color:#4b5563}
    .message-action:active{transform:scale(.98)}
    .screenshot-mode .${ACTION_CLASS}{display:none}
  `;
  document.head.appendChild(style);

  function room() {
    return window.currentRoom ? window.currentRoom() : null;
  }

  function messageAt(index) {
    const current = room();
    if (!current || !Array.isArray(current.history)) return null;
    return current.history[index] || null;
  }

  function saveAndRender() {
    if (window.saveState) window.saveState();
    if (window.renderHistory) window.renderHistory();
    setTimeout(decorate, 0);
  }

  async function copyMessage(index) {
    const message = messageAt(index);
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message.text || "");
    } catch {
      prompt("コピー用", message.text || "");
    }
  }

  function speakMessage(index) {
    const message = messageAt(index);
    if (message && window.speakText) window.speakText(message.text || "", true);
  }

  function editMessage(index) {
    const message = messageAt(index);
    if (!message) return;
    const next = prompt("本文を編集", message.text || "");
    if (next === null) return;
    message.text = next;
    saveAndRender();
  }

  function deleteMessage(index) {
    const current = room();
    if (!current || !current.history[index]) return;
    if (!confirm("このログを削除する。よいか。")) return;
    current.history.splice(index, 1);
    saveAndRender();
  }

  function deleteAfterMessage(index) {
    const current = room();
    if (!current || !current.history[index]) return;
    if (!confirm("このログ以降を削除する。よいか。")) return;
    current.history.splice(index);
    saveAndRender();
  }

  function regenerate(index) {
    if (window.regenerateFromIndex) window.regenerateFromIndex(index);
  }

  function actionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "message-action";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function decorate() {
    document.querySelectorAll(".message[data-index]").forEach((bubble) => {
      if (bubble.querySelector(`:scope > .${ACTION_CLASS}`)) return;
      const index = Number(bubble.dataset.index);
      if (!Number.isInteger(index)) return;
      const actions = document.createElement("div");
      actions.className = ACTION_CLASS;
      actions.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
      actions.addEventListener("mousedown", (event) => event.stopPropagation());
      actions.appendChild(actionButton("コピー", () => copyMessage(index)));
      actions.appendChild(actionButton("読む", () => speakMessage(index)));
      actions.appendChild(actionButton("編集", () => editMessage(index)));
      actions.appendChild(actionButton("再生成", () => regenerate(index)));
      actions.appendChild(actionButton("削除", () => deleteMessage(index)));
      actions.appendChild(actionButton("以降", () => deleteAfterMessage(index)));
      bubble.appendChild(actions);
    });
  }

  const originalRenderHistory = window.renderHistory;
  if (typeof originalRenderHistory === "function") {
    window.renderHistory = function patchedRenderHistory(...args) {
      const result = originalRenderHistory.apply(this, args);
      setTimeout(decorate, 0);
      return result;
    };
  }

  const chat = document.getElementById("chat");
  if (chat) {
    new MutationObserver(() => decorate()).observe(chat, { childList: true, subtree: true });
  }

  decorate();
})();
