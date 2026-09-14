/**
 * NemApi - Z.ai adapter (chat.z.ai, z.ai, chatglm.cn, bigmodel.cn)
 * GLM model interface support.
 */
(function (global) {
  "use strict";
  const B = global.NemApiBase;

  const INPUT = [
    'textarea[placeholder*="Ask" i]',
    'textarea[placeholder*="ChatGLM" i]',
    'textarea[placeholder*="输入" i]',
    'div[contenteditable="true"][role="textbox"]',
    "textarea.chat-input",
    "textarea#chat-input",
    "textarea",
  ];

  const SEND = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="发送" i]',
    'button[data-testid*="send" i]',
    "button.send-btn",
    "button.send-button",
    'div[role="button"][class*="send"]',
    'button[class*="send"]',
  ];

  const MESSAGE = [
    ".chat-message-assistant",
    '[data-role="assistant"]',
    ".message-item.assistant",
    '[class*="assistant-message"]',
    '[class*="bot-message"]',
    '[class*="glm-response"]',
  ];

  function findInput() {
    return B.queryFirst(INPUT);
  }

  function findSend() {
    const root = B.findComposerRoot();
    for (const s of SEND) {
      const nodes = root.querySelectorAll(s);
      for (const el of nodes) {
        if (!el || !B.isVisible(el)) continue;
        if (B.isDisabled && B.isDisabled(el)) continue;
        if (el.disabled || el.getAttribute("aria-disabled") === "true") continue;
        const label = `${el.getAttribute("aria-label") || ""} ${el.title || ""}`.toLowerCase();
        if (/stop|cancel|attach|upload|file|audio|voice/.test(label)) continue;
        return el;
      }
    }
    return B.findByText(["button", "[role='button']"], [/send/i, /发送/i, /submit/i], root);
  }

  function getMessageEls() {
    const seen = new Set();
    const out = [];
    for (const s of MESSAGE) {
      const nodes = document.querySelectorAll(s);
      for (const n of nodes) {
        if (seen.has(n)) continue;
        if (
          n.querySelector('[data-role="user"]') &&
          !n.querySelector('[data-role="assistant"]')
        )
          continue;
        seen.add(n);
        out.push(n);
      }
      if (out.length) return out;
    }
    return out;
  }

  function domToMarkdown(root) {
    if (!root) return "";
    const clone = root.cloneNode(true);
    const killSelectors = [
      "button",
      "[role='button']",
      "[class*='copy']",
      "[class*='toolbar']",
      "[class*='action']",
      "svg",
      "style",
      "script",
    ];
    for (const sel of killSelectors) {
      clone.querySelectorAll(sel).forEach((n) => n.remove());
    }
    clone.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      let lang = "";
      if (code) {
        const cls = code.className || "";
        const m = cls.match(/language-([a-z0-9_+-]+)/i);
        if (m) lang = m[1];
      }
      const body = (code ? code.textContent : pre.textContent) || "";
      const fence = "```" + lang + "\n" + body.replace(/\n$/, "") + "\n```";
      const replacement = document.createTextNode("\n\n" + fence + "\n\n");
      pre.parentNode.replaceChild(replacement, pre);
    });
    return (clone.innerText || clone.textContent || "").trim();
  }

  function readMessageText(msgEl) {
    if (!msgEl) return "";
    const mdContainer =
      msgEl.querySelector(".markdown, [class*='markdown'], [class*='content']") ||
      msgEl;
    let text = "";
    if (B.extractReactMarkdown) {
      text = B.extractReactMarkdown(mdContainer, ["markdown", "content", "text"]);
    }
    if (!text && B.htmlToMarkdown) {
      text = B.htmlToMarkdown(mdContainer);
    }
    if (!text || text.length < 5) {
      text = domToMarkdown(mdContainer);
    }
    return (text || "").trim();
  }

  function getLastResponse() {
    const els = getMessageEls();
    if (els.length) return readMessageText(els[els.length - 1]);
    return "";
  }

  function getResponseCount() {
    return getMessageEls().length;
  }

  function isGenerating() {
    return !!(
      document.querySelector('button[aria-label*="Stop" i]') ||
      document.querySelector('button[aria-label*="停止" i]') ||
      document.querySelector('[class*="is-generating"]')
    );
  }

  async function sendPrompt(text) {
    const input = findInput() || (await B.waitFor(INPUT[0], 12000).catch(() => null));
    if (!input) throw new Error("Z.ai: input not found");
    try {
      input.focus();
      input.click();
    } catch (_) {}
    B.pasteText(input, text);
    await B.sleep(220);
    let btn = B.waitForEnabledSend
      ? await B.waitForEnabledSend(findSend, 3500)
      : findSend();
    if (btn && !(B.isDisabled && B.isDisabled(btn))) {
      try {
        btn.focus();
      } catch (_) {}
      if (B.clickEl(btn)) {
        await B.sleep(300);
        return;
      }
    }
    B.pressEnter(input);
    await B.sleep(200);
    btn = findSend();
    if (btn && !(B.isDisabled && B.isDisabled(btn))) B.clickEl(btn);
  }

  async function waitForResponse(previous = "", prevCount = 0) {
    await B.sleep(500);
    await B.waitForNewResponse(getMessageEls, readMessageText, {
      timeout: 180000,
      stableMs: 1800,
      previous: prevCount && getResponseCount() > prevCount ? "" : previous,
      newElTimeout: 20000,
    });
    const els = getMessageEls();
    const last = els.length ? els[els.length - 1] : null;
    if (!last) return "";
    return readMessageText(last);
  }

  global.NemApiProviders = global.NemApiProviders || {};
  global.NemApiProviders.zai = {
    id: "zai",
    match: (url) => /chat\.z\.ai|\.z\.ai|chatglm\.cn|bigmodel\.cn/i.test(url),
    sendPrompt,
    waitForResponse,
    getLastResponse,
    getResponseCount,
    isGenerating,
    findInput,
  };
})(typeof window !== "undefined" ? window : self);
