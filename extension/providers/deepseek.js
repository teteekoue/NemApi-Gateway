/**
 * NemApi - DeepSeek adapter
 * Extracts clean markdown from the DOM (strips Copy/Download/JSON UI chrome)
 * and is compatible with coding agents.
 */
(function (global) {
  "use strict";
  const B = global.NemApiBase;

  const INPUT = [
    "textarea#chat-input",
    'textarea[placeholder*="DeepSeek" i]',
    'textarea[placeholder*="Message DeepSeek" i]',
    'textarea[placeholder*="Message" i]',
    'textarea[role="textbox"]',
    ".ds-textarea textarea",
    "textarea[data-testid*='chat' i]",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    "textarea",
  ];

  const SEND_CANDIDATES = [
    '[role="button"].ds-icon-button',
    "button.ds-icon-button",
    '[role="button"].ds-button--primary',
    "button.ds-button--primary",
    '[role="button"].ds-button--circle',
    "button.ds-button--circle",
    '[role="button"][class*="_52c986b"]',
    "button[class*='_52c986b']",
    '[role="button"][class*="_7436101"]',
    "div[role='button'][aria-disabled]",
    'button[type="submit"]',
    'button[aria-label*="Send" i]',
    '[role="button"][aria-label*="Send" i]',
    "button[class*='send']",
    '[role="button"]',
    "button",
  ];

  const MESSAGE = [
    "[data-virtual-list-item-key] .ds-message",
    ".ds-message",
    "[class*='ds-message']",
  ];

  const SEND_SVG_PATH_RE =
    /M8\.3125|M13\.12\s*19\.98|M12\s*5\.25|paper|send|arrow/i;

  const UI_NOISE_RE = new RegExp(
    [
      "\\bCopy\\b",
      "\\bCopied\\b",
      "\\bDownload\\b",
      "\\bJSON\\b",
      "\\bThink\\b",
      "\\bThinking\\b",
      "\\bRegenerate\\b",
      "\\bRetry\\b",
      "\\bShare\\b",
      "\\bContinue\\b",
      "\\bStop\\b",
      "\\bEdit\\b",
      "\\bLike\\b",
      "\\bDislike\\b",
      "\\bReport\\b",
    ].join("|"),
    "gi"
  );

  function getMessageEls() {
    for (const s of MESSAGE) {
      const nodes = document.querySelectorAll(s);
      if (nodes.length) return Array.from(nodes);
    }
    return [];
  }

  function domToMarkdown(root) {
    if (!root) return "";
    const clone = root.cloneNode(true);
    const killSelectors = [
      "button",
      "[role='button']",
      "[class*='copy']",
      "[class*='download']",
      "[class*='toolbar']",
      "[class*='action']",
      "[class*='icon-button']",
      "[class*='ds-icon']",
      ".ds-think-content",
      "[class*='think']",
      "[class*='thinking']",
      "svg",
      "style",
      "script",
      "noscript",
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
    let text = clone.innerText || clone.textContent || "";
    return cleanResponse(text);
  }

  function cleanResponse(text) {
    let t = String(text || "");
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
    t = t.replace(/```think[\s\S]*?```/gi, "");
    t = t
      .split("\n")
      .filter((line) => {
        const s = line.trim();
        if (!s) return true;
        if (
          /^(Copy|Copied|Download|JSON|Think|Thinking|Regenerate|Retry|Share|Stop|Edit|Like|Dislike|Report)$/i.test(
            s
          )
        ) {
          return false;
        }
        if (/^(Copy|Download|JSON)\s*[: .]?\s*$/i.test(s)) return false;
        return true;
      })
      .join("\n");
    t = t.replace(UI_NOISE_RE, (match, offset, full) => {
      const before = full.slice(0, offset);
      const opens = (before.match(/```/g) || []).length;
      if (opens % 2 === 1) return match;
      return "";
    });
    t = t.replace(/[ \t]+\n/g, "\n");
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }

  function readMessageText(msgEl) {
    if (!msgEl) return "";
    const main =
      msgEl.querySelector(".ds-assistant-message-main-content") ||
      msgEl.querySelector("[class*='assistant-message-main']") ||
      msgEl.querySelector(".ds-markdown:not(.ds-think-content .ds-markdown)") ||
      msgEl.querySelector(".ds-markdown") ||
      msgEl.querySelector("[class*='markdown']");
    if (main) {
      const md = domToMarkdown(main);
      if (md) return md;
    }
    const blocks = msgEl.querySelectorAll(".ds-markdown, [class*='markdown']");
    const parts = [];
    for (const b of blocks) {
      if (b.closest(".ds-think-content, [class*='think']")) continue;
      const md = domToMarkdown(b);
      if (md) parts.push(md);
    }
    if (parts.length) return parts.join("\n\n").trim();
    return cleanResponse(msgEl.innerText || msgEl.textContent || "");
  }

  async function extractPremium(msgEl) {
    if (!msgEl) return "";
    const answerNodes = [];
    msgEl.querySelectorAll("div.ds-markdown, .ds-markdown").forEach((el) => {
      if (el.closest(".ds-think-content, [class*='think'], .e1675d8b")) return;
      answerNodes.push(el);
    });

    let best = "";
    for (const el of answerNodes) {
      const md = B.extractReactMarkdown(el, ["markdown", "content", "text"]);
      if (md && md.length > best.length) best = md;
    }
    if (!best && answerNodes[0]) {
      best = B.extractReactMarkdown(msgEl, ["markdown", "content", "text"]) || "";
    }
    if (best && best.length > 10) {
      return cleanResponse(best);
    }

    const parts = [];
    for (const el of answerNodes) {
      const md = B.htmlToMarkdown(el);
      if (md) parts.push(md);
    }
    if (parts.length) {
      const joined = cleanResponse(parts.join("\n\n"));
      if (joined.length > 10) return joined;
    }

    const fromDom = readMessageText(msgEl);
    if (fromDom && fromDom.length > 10) return fromDom;

    if (B.premiumEnabled()) {
      try {
        const fromClip = await B.tryClipboardFromCopyButton(
          msgEl,
          [
            'button[aria-label*="Copy" i]',
            'button[title*="Copy" i]',
          ],
          { domAssistantText: fromDom }
        );
        if (fromClip && fromClip.length > 10 && fromClip !== "[object Object]") {
          return cleanResponse(fromClip);
        }
      } catch (_) {}
    }
    return fromDom || "";
  }

  function findInput() {
    return B.queryFirst(INPUT);
  }

  function isVisible(el) {
    return B.isVisible(el);
  }

  function isDisabled(el) {
    if (B.isDisabled) return B.isDisabled(el);
    if (!el) return true;
    if (el.getAttribute("aria-disabled") === "true") return true;
    if (el.disabled) return true;
    const cls = (el.className && String(el.className)) || "";
    if (/\bdisabled\b/i.test(cls)) return true;
    return false;
  }

  function isSendButton(el) {
    if (!el || !isVisible(el) || isDisabled(el)) return false;
    const label = `${el.getAttribute("aria-label") || ""} ${el.title || ""} ${
      el.innerText || el.textContent || ""
    }`.toLowerCase();
    if (/stop|cancel|attach|upload|file|camera|image|voice|microphone|mic|plus/.test(label)) {
      return false;
    }
    if (el.classList && el.classList.contains("ds-toggle-button")) return false;
    if (el.classList && el.classList.contains("bds-plus-btn")) return false;

    const paths = el.querySelectorAll("svg path");
    for (const p of paths) {
      const d = p.getAttribute("d") || "";
      if (SEND_SVG_PATH_RE.test(d)) return true;
    }
    if (/send|envoyer|submit/i.test(label)) return true;
    const cls = (el.className && String(el.className)) || "";
    if (
      (cls.includes("ds-icon-button") ||
        cls.includes("ds-button--primary") ||
        cls.includes("ds-button--circle") ||
        cls.includes("_52c986b") ||
        cls.includes("_7436101")) &&
      !/attach|upload|file|plus/.test(cls)
    ) {
      return true;
    }
    return false;
  }

  function findSend(near) {
    const root = B.findComposerRoot(near) || document.body;
    const candidates = [];
    for (const s of SEND_CANDIDATES) {
      try {
        root.querySelectorAll(s).forEach((n) => candidates.push(n));
      } catch (_) {}
    }
    const seen = new Set();
    const unique = [];
    for (let i = candidates.length - 1; i >= 0; i--) {
      const n = candidates[i];
      if (seen.has(n)) continue;
      seen.add(n);
      unique.push(n);
    }
    for (const n of unique) {
      if (isSendButton(n)) return n;
    }
    const byText = B.findByText(["button", "[role='button']"], [/send/i, /submit/i], root);
    if (byText && isSendButton(byText)) return byText;
    return null;
  }

  async function waitForEnabledSend(input, timeoutMs = 3500) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const btn = findSend(input);
      if (btn && !isDisabled(btn) && isVisible(btn)) return btn;
      await B.sleep(80);
    }
    return findSend(input);
  }

  function getLastResponse() {
    const els = getMessageEls();
    if (els.length) return readMessageText(els[els.length - 1]);
    return "";
  }

  function getResponseCount() {
    try {
      return getMessageEls().length;
    } catch (_) {
      return 0;
    }
  }

  function isGenerating() {
    const stop =
      document.querySelector('button[aria-label*="Stop" i]') ||
      document.querySelector('[role="button"][aria-label*="Stop" i]') ||
      document.querySelector('[class*="stop"]');
    if (stop && isVisible(stop)) return true;
    if (document.querySelector(".ds-loading, [class*='loading'], [class*='spinner']")) {
      return true;
    }
    return false;
  }

  async function sendPrompt(text) {
    const input = findInput() || (await B.waitFor(INPUT[0], 12000).catch(() => null));
    if (!input) throw new Error("DeepSeek: input not found");
    try {
      input.focus();
      input.click();
    } catch (_) {}
    B.pasteText(input, text);
    try {
      input.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromPaste",
          data: String(text ?? ""),
        })
      );
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
    await B.sleep(220);
    let btn = await waitForEnabledSend(input, 3500);
    if (btn && !isDisabled(btn)) {
      try {
        btn.focus();
      } catch (_) {}
      const clicked = B.clickEl(btn);
      if (clicked) {
        await B.sleep(350);
        const stillFull =
          (input.value || input.textContent || "").trim().length >
          Math.min(20, String(text).length * 0.6);
        if (!stillFull) return;
      }
    }
    B.pressEnter(input);
    await B.sleep(250);
    btn = findSend(input);
    if (btn && !isDisabled(btn)) {
      B.clickEl(btn);
    }
  }

  async function waitForResponse(previous = "", prevCount = 0) {
    await B.sleep(400);
    const genStart = Date.now();
    while (Date.now() - genStart < 10000) {
      if (isGenerating()) break;
      if (prevCount && getResponseCount() > prevCount) break;
      const els = getMessageEls();
      const last = els.length ? readMessageText(els[els.length - 1]) : "";
      if (last && last !== previous && last.length > (previous || "").length) {
        break;
      }
      await B.sleep(200);
    }
    await B.waitForNewResponse(getMessageEls, readMessageText, {
      timeout: 180000,
      stableMs: 1600,
      previous: prevCount && getResponseCount() > prevCount ? "" : previous,
      newElTimeout: 20000,
    });
    await B.sleep(150);
    const els = getMessageEls();
    const last = els.length ? els[els.length - 1] : null;
    if (!last) return "";
    try {
      return await extractPremium(last);
    } catch (_) {
      return readMessageText(last);
    }
  }

  global.NemApiProviders = global.NemApiProviders || {};
  global.NemApiProviders.deepseek = {
    id: "deepseek",
    match: (url) => /chat\.deepseek\.com/i.test(url),
    sendPrompt,
    waitForResponse,
    getLastResponse,
    getResponseCount,
    isGenerating,
    findInput,
  };
})(typeof window !== "undefined" ? window : self);
