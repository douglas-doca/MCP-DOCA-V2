(() => {
  // Config
  const API_URL = window.CHAT_API_URL || "/api/chat"; // quando você criar a rota
  const USE_API = false; // <-- por enquanto: modo local fake (opção 2)

  const chatBody = document.getElementById("chatBody");
  const chatForm = document.getElementById("chatForm");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const modeTag = document.getElementById("modeTag");

  modeTag.textContent = USE_API ? "Modo: API" : "Modo: Local";

  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `msg ${role}`;
    msg.innerHTML = `<div class="bubble"></div>`;
    msg.querySelector(".bubble").textContent = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function simulateAgentReply(userText) {
    const t = userText.toLowerCase();

    if (t.includes("preço") || t.includes("valor") || t.includes("custa")) {
      return "Boa! O investimento depende do volume e integrações. Quer me dizer quantos atendimentos/mês e quais canais (WhatsApp, Instagram, Site)?";
    }
    if (t.includes("caro") || t.includes("desconto")) {
      return "Entendi a objeção de preço. Posso te mostrar o ROI típico (250%–500%) e como a automação paga em 15–30 dias. Qual seu ticket médio hoje?";
    }
    if (t.includes("cancelar")) {
      return "Parece que existe risco de churn. Antes de cancelar, me diz o que te frustrou? Atendimento, tempo, ou resultado?";
    }
    if (t.includes("pressa") || t.includes("urgente")) {
      return "Perfeito. Vou priorizar: me diga seu segmento e o volume aproximado de leads por dia. Eu te passo um plano rápido em 60s.";
    }
    if (t.includes("oi") || t.includes("olá")) {
      return "Oi! 👋 Me diz: você quer aumentar vendas, reduzir custo ou ter mais controle (dashboard + alertas)?";
    }
    return "Entendi. Pra eu te ajudar melhor: qual seu segmento e qual canal principal (WhatsApp, Instagram, Site)?";
  }

  async function sendToApi(userText) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    if (!res.ok) throw new Error("API error");
    return res.json();
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const userText = (input.value || "").trim();
    if (!userText) return;

    addMessage("user", userText);
    input.value = "";
    input.focus();

    // "typing"
    sendBtn.disabled = true;

    setTimeout(async () => {
      try {
        if (!USE_API) {
          const reply = simulateAgentReply(userText);
          addMessage("bot", reply);
        } else {
          const data = await sendToApi(userText);
          addMessage("bot", data.reply || data.response || "Ok.");
        }
      } catch (err) {
        addMessage("bot", "Ops! Tive um problema pra responder agora. Tente novamente.");
      } finally {
        sendBtn.disabled = false;
      }
    }, 450);
  });
})();