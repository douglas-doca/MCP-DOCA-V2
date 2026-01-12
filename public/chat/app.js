(() => {
  // ==========================================
  // ✅ Config
  // ==========================================
  const API_URL =
    window.CHAT_API_URL || "https://mcp.docaperformance.com.br/api/chat";

  const USE_API = true;

  const chatBody = document.getElementById("chatBody");
  const chatForm = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const modeTag = document.getElementById("modeTag");

  modeTag.textContent = USE_API ? "Modo: API (REAL)" : "Modo: Local (FAKE)";

  // ==========================================
  // ✅ Identidade do usuário (simula telefone)
  // - mantém consistência no Supabase / context
  // ==========================================
  function getOrCreateAnonPhone() {
    const key = "doca_demo_phone";
    let phone = localStorage.getItem(key);

    if (!phone) {
      // "5511" + 9 dígitos aleatórios (finge celular BR)
      const rand = Math.floor(100000000 + Math.random() * 900000000);
      phone = `5511${rand}`;
      localStorage.setItem(key, phone);
    }

    return phone;
  }

  const phone = getOrCreateAnonPhone();
  const chatId = `landing:${phone}`;

  // ==========================================
  // UI helpers
  // ==========================================
  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `msg ${role}`;
    msg.innerHTML = `<div class="bubble"></div>`;
    msg.querySelector(".bubble").textContent = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function addTyping() {
    const msg = document.createElement("div");
    msg.className = `msg bot typing`;
    msg.innerHTML = `<div class="bubble">digitando…</div>`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msg;
  }

  function removeTyping(typingEl) {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
  }

  // ==========================================
  // ✅ API call (backend real)
  // ==========================================
  async function sendToApi(userText) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        chatId,
        message: userText,
        source: "landing_demo",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    return res.json();
  }

  // ==========================================
  // Submit
  // ==========================================
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userText = (input.value || "").trim();
    if (!userText) return;

    addMessage("user", userText);
    input.value = "";
    input.focus();

    sendBtn.disabled = true;
    const typingEl = addTyping();

    try {
      if (!USE_API) {
        // fallback antigo (não use)
        removeTyping(typingEl);
        addMessage("bot", "Modo local fake está ligado. Ative a API.");
      } else {
        const data = await sendToApi(userText);

        removeTyping(typingEl);

        // ✅ teu backend pode retornar { response } ou { reply }
        const text = data.reply || data.response || "Ok.";
        addMessage("bot", text);

        // ✅ Se quiser usar responsePlan depois:
        // if (data.responsePlan?.bubbles?.length) {
        //   data.responsePlan.bubbles.forEach((b) => addMessage("bot", b));
        // }
      }
    } catch (err) {
      removeTyping(typingEl);
      addMessage("bot", "Ops! Tive um problema pra responder agora. Tente novamente.");
      console.error(err);
    } finally {
      sendBtn.disabled = false;
    }
  });
})();
