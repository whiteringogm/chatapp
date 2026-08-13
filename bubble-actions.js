(() => {
  const ACTION_CLASS = "message-actions";
  const MENU_CLASS = "speaker-menu";

  const style = document.createElement("style");
  style.textContent = `
    .speaker{position:relative}
    .${MENU_CLASS}{display:block;width:28px;min-height:24px;margin:4px auto 0;padding:0;border:1px solid #d1d5db;border-radius:999px;background:#f3f4f6;color:#4b5563;font-size:15px;font-weight:900;line-height:1}
    .${ACTION_CLASS}{display:none;gap:6px;flex-wrap:nowrap;overflow-x:auto;margin-top:8px;padding-top:7px;border-top:1px solid rgba(107,114,128,.18);-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .${ACTION_CLASS}::-webkit-scrollbar{display:none}
    .message.actions-open > .${ACTION_CLASS}{display:flex}
    .message-action{flex:0 0 auto;width:auto;min-height:30px;padding:4px 8px;border:1px solid #d1d5db;border-radius:999px;background:rgba(255,255,255,.45);color:#4b5563;font-size:12px;font-weight:800;line-height:1.2}
    button.message-action{width:auto;min-height:30px;border:1px solid #d1d5db;border-radius:999px;background:rgba(255,255,255,.45);color:#4b5563}
    .message-action:active,.${MENU_CLASS}:active{transform:scale(.98)}
    .screenshot-mode .${ACTION_CLASS},.screenshot-mode .${MENU_CLASS}{display:none!important}
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

  function closeOtherMenus(currentBubble) {
    document.querySelectorAll(".message.actions-open").forEach((bubble) => {
      if (bubble !== currentBubble) bubble.classList.remove("actions-open");
    });
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

  function addLongPressBlocker(bubble) {
    if (bubble.dataset.longPressBlocked === "1") return;
    bubble.dataset.longPressBlocked = "1";
    const block = (event) => {
      if (event.target.closest(`.${ACTION_CLASS}`)) return;
      event.stopImmediatePropagation();
    };
    ["touchstart", "mousedown", "contextmenu"].forEach((type) => {
      bubble.addEventListener(type, block, true);
    });
  }

  function ensureSpeakerMenu(row, bubble, index) {
    const speaker = row.querySelector(".speaker");
    if (!speaker || speaker.querySelector(`.${MENU_CLASS}`)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = MENU_CLASS;
    button.textContent = "⋯";
    button.setAttribute("aria-label", "操作");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeOtherMenus(bubble);
      bubble.classList.toggle("actions-open");
    });
    speaker.appendChild(button);
  }

  function ensureActions(bubble, index) {
    let actions = bubble.querySelector(`:scope > .${ACTION_CLASS}`);
    if (actions) return;
    actions = document.createElement("div");
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
  }

  function decorate() {
    document.querySelectorAll(".message[data-index]").forEach((bubble) => {
      const index = Number(bubble.dataset.index);
      if (!Number.isInteger(index)) return;
      const row = bubble.closest(".message-row");
      if (!row) return;
      addLongPressBlocker(bubble);
      ensureActions(bubble, index);
      ensureSpeakerMenu(row, bubble, index);
    });
  }

  const originalRenderHistory = window.renderHistory;
  if (typeof originalRenderHistory === "function" && !originalRenderHistory.__bubbleActionsPatched) {
    function patchedRenderHistory(...args) {
      const result = originalRenderHistory.apply(this, args);
      setTimeout(decorate, 0);
      return result;
    }
    patchedRenderHistory.__bubbleActionsPatched = true;
    window.renderHistory = patchedRenderHistory;
  }

  const chat = document.getElementById("chat");
  if (chat) {
    new MutationObserver(() => decorate()).observe(chat, { childList: true, subtree: true });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(`.${MENU_CLASS}`) || event.target.closest(`.${ACTION_CLASS}`)) return;
    document.querySelectorAll(".message.actions-open").forEach((bubble) => bubble.classList.remove("actions-open"));
  });

  decorate();
})();
