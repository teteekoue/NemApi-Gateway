#!/usr/bin/env python3
"""NemApi v4.1 - Local OpenAI-compatible bridge with browser extension automation.
Simplified architecture:
- Receives a request
- Sends it to the selected provider
- Returns the response
- Support for OpenAI chat completions, SSE streaming, tool calls, and multi-tenant keys
"""

from __future__ import annotations

import json
import hashlib
import os
import re
import secrets
import socket
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.request
from urllib.parse import quote, urlparse

from tools_format import (
    clean_assistant_text,
    format_messages_prompt,
    parse_tool_calls,
)

# Configuration du serveur - écoute sur toutes les interfaces réseau
HOST = "0.0.0.0"
PORT = int(os.environ.get("NEMAPI_PORT", 8090))

# Canonical model per provider (what the web UI actually uses)
PROVIDERS = {
    "deepseek": {"models": ["deepseek-chat"], "display_name": "DeepSeek"},
    "qwen": {"models": ["qwen-chat"], "display_name": "Qwen"},
    "claude": {"models": ["claude-chat"], "display_name": "Claude"},
    "gemini": {"models": ["gemini-chat"], "display_name": "Gemini"},
    "chatgpt": {"models": ["gpt-chat"], "display_name": "ChatGPT"},
    "kimi": {"models": ["kimi-chat"], "display_name": "Kimi"},
    "zai": {"models": ["glm-chat"], "display_name": "Z.ai"},
}

# Aliases accepted from clients (Qwen Code, Cursor, Continue, etc.)
MODEL_ALIASES: Dict[str, str] = {
    # DeepSeek
    "deepseek-chat": "deepseek",
    "deepseek-coder": "deepseek",
    "deepseek-v3": "deepseek",
    "deepseek-r1": "deepseek",
    "chat": "deepseek",
    # Qwen
    "qwen-chat": "qwen",
    "qwen-plus": "qwen",
    "qwen2.5-plus": "qwen",
    "qwen2.5-coder": "qwen",
    "qwen3-coder": "qwen",
    "qwen3-coder-plus": "qwen",
    "qwen-max": "qwen",
    "plus": "qwen",
    # Claude
    "claude-chat": "claude",
    "claude-sonnet": "claude",
    "claude-3-sonnet": "claude",
    "claude-3-haiku": "claude",
    "claude-3.5-sonnet": "claude",
    "claude-4-sonnet": "claude",
    "sonnet": "claude",
    "haiku": "claude",
    # Gemini
    "gemini-chat": "gemini",
    "gemini-2.5-flash": "gemini",
    "gemini-2.0-flash": "gemini",
    "gemini-pro": "gemini",
    "gemini-flash": "gemini",
    "flash": "gemini",
    # ChatGPT
    "gpt-chat": "chatgpt",
    "chatgpt": "chatgpt",
    "gpt-4": "chatgpt",
    "gpt-4o": "chatgpt",
    "gpt-4.1": "chatgpt",
    "gpt-5": "chatgpt",
    "gpt-3.5-turbo": "chatgpt",
    "o1": "chatgpt",
    "o3": "chatgpt",
    # Kimi
    "kimi-chat": "kimi",
    "kimi": "kimi",
    "moonshot": "kimi",
    "kimi-k2": "kimi",
    "kimi-k3": "kimi",
    # Z.ai / Zhipu
    "glm-chat": "zai",
    "zai-chat": "zai",
    "zai": "zai",
    "z.ai": "zai",
    "glm": "zai",
    "glm-4": "zai",
    "glm-5": "zai",
    "chatglm": "zai",
}

# Model to provider mapping
MODEL_TO_PROVIDER: Dict[str, str] = {}
for provider, info in PROVIDERS.items():
    for model in info["models"]:
        MODEL_TO_PROVIDER[model] = provider
        MODEL_TO_PROVIDER[f"{provider}/{model}"] = provider
for alias, provider in MODEL_ALIASES.items():
    MODEL_TO_PROVIDER[alias] = provider
    MODEL_TO_PROVIDER[f"{provider}/{alias}"] = provider

TOKEN_PRICING = {
    "deepseek": {"prompt": 0.00014, "completion": 0.00028, "label": "DeepSeek V4 Flash"},
    "qwen": {"prompt": 0.00050, "completion": 0.00300, "label": "Qwen Plus"},
    "claude": {"prompt": 0.00300, "completion": 0.01500, "label": "Claude Sonnet"},
    "gemini": {"prompt": 0.00150, "completion": 0.00900, "label": "Gemini Flash"},
    "chatgpt": {"prompt": 0.00250, "completion": 0.01000, "label": "GPT-4o / mid"},
    "kimi": {"prompt": 0.00095, "completion": 0.00400, "label": "Kimi K2.6"},
    "zai": {"prompt": 0.00140, "completion": 0.00440, "label": "GLM-5.2"},
}

STATIC_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".html": "text/html; charset=utf-8",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8",
}

CONFIG_FILE = Path(__file__).with_name("config.json")
STATS_FILE = Path(__file__).with_name("stats.json")


def generate_api_key():
    """Génère une clé API sécurisée au format nemapi-token{random}"""
    random_part = secrets.token_urlsafe(24)
    return f"nemapi-token{random_part}"


def hash_api_key(key: str) -> str:
    """Hache une clé API pour stockage sécurisé"""
    return hashlib.sha256(key.encode()).hexdigest()


def load_config() -> Dict[str, Any]:
    """Charge la configuration depuis le fichier"""
    if not CONFIG_FILE.exists():
        return {
            "api_keys": {},
            "settings": {
                "stream_enabled": True,
                "auto_config": True,
                "fresh_chat": True,
                "premium_md": True,
                "timeout_seconds": 230,
            },
        }
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("config root must be an object")
        return data
    except (OSError, json.JSONDecodeError, ValueError) as e:
        add_log(f"Erreur de chargement de la config: {e}", "error")
        return {
            "api_keys": {},
            "settings": {
                "stream_enabled": True,
                "auto_config": True,
                "fresh_chat": True,
                "premium_md": True,
                "timeout_seconds": 230,
            },
        }


def save_config(config: Dict[str, Any]):
    """Sauvegarde la configuration dans le fichier"""
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        add_log("Configuration sauvegardée")
    except OSError as e:
        add_log(f"Erreur de sauvegarde de la config: {e}", "error")


def validate_api_key(provided_key: str, config: Dict[str, Any]) -> bool:
    """Valide une clé API fournie"""
    if not config.get("api_keys"):
        return True
    key_hash = hash_api_key(provided_key)
    return key_hash in config["api_keys"]


FREE_PROVIDERS = {"gemini", "deepseek"}
DAILY_TOKEN_QUOTA_FREE = 30_000_000
PLAN_KEY_PREFIXES = {"PA": "premium_annual", "PL": "premium_lifetime"}
PLAN_NAMES = {
    "free": "Gratuit",
    "premium_annual": "Premium Annuel",
    "premium_lifetime": "Premium À vie",
}
KEY_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
KEY_SALT = "NEMAPI-PRO-2026"


def _key_checksum(body: str) -> str:
    digest = hashlib.sha256((KEY_SALT + body).encode()).digest()
    return "".join(KEY_CHARSET[digest[i] % 32] for i in range(4))


def generate_product_key(plan_code: str = "PA") -> str:
    body = "".join(secrets.choice(KEY_CHARSET) for _ in range(10))
    return plan_code + body + _key_checksum(plan_code + body)


def normalize_product_key(raw: Any) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(raw or "")).upper()


def validate_product_key(raw: Any) -> Optional[str]:
    key = normalize_product_key(raw)
    if len(key) != 16:
        return None
    prefix = key[:2]
    if prefix not in PLAN_KEY_PREFIXES:
        return None
    if _key_checksum(prefix + key[2:12]) != key[12:]:
        return None
    return PLAN_KEY_PREFIXES[prefix]


def mask_product_key(raw: Any) -> str:
    k = normalize_product_key(raw)
    if len(k) < 8:
        return ""
    return f"{k[:4]}••••{k[8:12]}•{k[14:16]}"


def _today_gmt() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _next_reset_gmt() -> str:
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return tomorrow.strftime("%d/%m %H:%M")


def quota_used() -> int:
    q = app_config.get("quota") or {}
    if q.get("day") != _today_gmt():
        return 0
    return int(q.get("used", 0))


def quota_remaining() -> int:
    return max(0, DAILY_TOKEN_QUOTA_FREE - quota_used())


def _add_quota_tokens(tokens: int):
    today = _today_gmt()
    with config_lock:
        q = app_config.get("quota") or {}
        if q.get("day") != today:
            q = {"day": today, "used": 0}
        q["used"] = int(q.get("used", 0)) + max(0, int(tokens))
        app_config["quota"] = q
        save_config(app_config)


def quota_payload() -> Dict[str, Any]:
    premium = plan_is_premium()
    used = quota_used()
    return {
        "day_gmt": _today_gmt(),
        "used": used,
        "limit": None if premium else DAILY_TOKEN_QUOTA_FREE,
        "remaining": None if premium else max(0, DAILY_TOKEN_QUOTA_FREE - used),
        "unlimited": premium,
        "resets_at_gmt": _next_reset_gmt(),
    }


def subscription_state() -> Dict[str, Any]:
    sub = app_config.get("subscription")
    return sub if isinstance(sub, dict) else {"plan": "free"}


def effective_plan() -> str:
    sub = subscription_state()
    plan = sub.get("plan", "free")
    if plan not in ("premium_annual", "premium_lifetime"):
        return "free"
    if validate_product_key(sub.get("product_key", "")) != plan:
        return "free"
    if plan == "premium_annual" and sub.get("expires_at"):
        try:
            if datetime.now(timezone.utc) > datetime.fromisoformat(sub["expires_at"]):
                return "free"
        except ValueError:
            pass
    return plan


def plan_is_premium() -> bool:
    return effective_plan() != "free"


def provider_available(provider: str) -> bool:
    return plan_is_premium() or provider in FREE_PROVIDERS


def subscription_payload() -> Dict[str, Any]:
    sub = subscription_state()
    plan = effective_plan()
    return {
        "plan": plan,
        "plan_name": PLAN_NAMES.get(plan, "Gratuit"),
        "premium": plan != "free",
        "product_key": mask_product_key(sub.get("product_key", ""))
        if sub.get("product_key")
        else None,
        "activated_at": sub.get("activated_at"),
        "expires_at": sub.get("expires_at"),
        "key_format": "16 lettres et chiffres (préfixe PA ou PL)",
        "plans": [
            {
                "id": "free",
                "name": "Gratuit",
                "price": "0 $",
                "period": "permanent",
                "providers": "Gemini + DeepSeek",
                "tokens": "30 M tokens/jour (partagés)",
            },
            {
                "id": "premium_annual",
                "name": "Premium Annuel",
                "price": "10 $",
                "period": "/an",
                "providers": "7 providers",
                "tokens": "Illimité",
            },
            {
                "id": "premium_lifetime",
                "name": "Premium À vie",
                "price": "99 $",
                "period": "paiement unique",
                "providers": "7 providers",
                "tokens": "Illimité",
            },
        ],
        "quota": quota_payload(),
        "backend": backend_payload(),
        "providers": [
            {
                "id": pid,
                "display_name": info.get("display_name", pid),
                "plan": "free" if pid in FREE_PROVIDERS else "premium",
                "available": provider_available(pid),
            }
            for pid, info in PROVIDERS.items()
        ],
    }


BACKEND_TIMEOUT = 35


def _backend_cfg() -> Dict[str, Any]:
    b = app_config.get("backend")
    return b if isinstance(b, dict) else {}


def _backend_url() -> Optional[str]:
    url = str(_backend_cfg().get("url") or "").strip()
    return url or None


def _backend_user() -> str:
    return str(_backend_cfg().get("user") or "").strip()


def _backend_call(payload: Dict[str, Any], timeout: int = BACKEND_TIMEOUT) -> Dict[str, Any]:
    url = _backend_url()
    if not url:
        raise RuntimeError("Backend Google Sheets non configuré")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "text/plain; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _backend_get(query: str, timeout: int = BACKEND_TIMEOUT) -> Dict[str, Any]:
    url = _backend_url()
    if not url:
        raise RuntimeError("Backend Google Sheets non configuré")
    sep = "&" if "?" in url else "?"
    with urllib.request.urlopen(url + sep + query, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _backend_status_payload() -> Dict[str, Any]:
    url = _backend_url()
    user = _backend_user()
    out: Dict[str, Any] = {
        "configured": bool(url),
        "connected": False,
        "user": user,
        "user_sheet": None,
    }
    if not url:
        return out
    try:
        health = _backend_get("action=health", timeout=20)
        out["connected"] = bool(health.get("ok"))
        out["health"] = health
    except Exception as e:
        out["error"] = str(e)
        return out
    if user:
        try:
            res = _backend_get("action=user&name=" + quote(user), timeout=20)
            if res.get("ok"):
                out["user_sheet"] = res.get("user")
            elif res.get("error") == "user_not_found":
                created = _backend_call({"action": "claim", "user": user}, timeout=20)
                if created.get("ok"):
                    out["user_sheet"] = created.get("user")
        except Exception as e:
            out["user_sheet"] = {"error": str(e)}
    return out


def _report_backend_usage(user: str, requests: int, tokens: int, day: str):
    try:
        _backend_call(
            {
                "action": "usage",
                "user": user,
                "requests": requests,
                "tokens": tokens,
                "day": day,
            },
            timeout=BACKEND_TIMEOUT,
        )
    except Exception:
        pass


def backend_payload() -> Dict[str, Any]:
    return {
        "configured": bool(_backend_url()),
        "url": _backend_url(),
        "user": _backend_user(),
    }


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except OSError:
        return "127.0.0.1"


def _empty_provider_stats() -> Dict[str, Dict[str, float]]:
    return {
        pid: {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0}
        for pid in PROVIDERS.keys()
    }


def load_stats() -> Dict[str, Any]:
    base = {
        "requests": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "estimated_cost": 0.0,
        "providers": _empty_provider_stats(),
        "updated_at": None,
    }
    if not STATS_FILE.exists():
        return base
    try:
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return base
        providers = _empty_provider_stats()
        for pid, pdata in (data.get("providers") or {}).items():
            if pid in providers and isinstance(pdata, dict):
                providers[pid] = {
                    "requests": int(pdata.get("requests") or 0),
                    "prompt_tokens": int(pdata.get("prompt_tokens") or 0),
                    "completion_tokens": int(pdata.get("completion_tokens") or 0),
                    "cost": float(pdata.get("cost") or 0.0),
                }
        base.update(
            {
                "requests": int(data.get("requests") or 0),
                "prompt_tokens": int(data.get("prompt_tokens") or 0),
                "completion_tokens": int(data.get("completion_tokens") or 0),
                "estimated_cost": float(data.get("estimated_cost") or 0.0),
                "providers": providers,
                "updated_at": data.get("updated_at"),
            }
        )
        return base
    except (OSError, json.JSONDecodeError, ValueError, TypeError):
        return base


def save_stats(data: Dict[str, Any]):
    try:
        payload = {
            "requests": int(data.get("requests") or 0),
            "prompt_tokens": int(data.get("prompt_tokens") or 0),
            "completion_tokens": int(data.get("completion_tokens") or 0),
            "estimated_cost": float(data.get("estimated_cost") or 0.0),
            "providers": data.get("providers") or _empty_provider_stats(),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
    except OSError as e:
        add_log(f"Erreur sauvegarde stats: {e}", "error")


def calculate_cost(provider: str, prompt_tokens: int, completion_tokens: int) -> float:
    if provider not in TOKEN_PRICING:
        return 0.0
    pricing = TOKEN_PRICING[provider]
    return (prompt_tokens / 1000) * pricing["prompt"] + (
        completion_tokens / 1000
    ) * pricing["completion"]


class Job:
    def __init__(
        self,
        question: str,
        provider: str,
        model: str,
        fresh_chat: bool | None = None,
    ):
        self.id = str(uuid.uuid4())
        self.question = question
        self.provider = provider
        self.model = model
        self.fresh_chat = fresh_chat
        self.status = "pending"
        self.result = ""
        self.error = ""
        self.event = threading.Event()
        self.start_time = time.time()


class Coordinator:
    def __init__(self):
        self.lock = threading.Lock()
        self.queues: Dict[str, List[Job]] = {}
        self.jobs: Dict[str, Job] = {}
        self.current_jobs: Dict[str, Optional[Job]] = {}

    DEDUP_WINDOW_S = 2.5

    def create(
        self,
        question: str,
        provider: str,
        model: str,
        fresh_chat: bool | None = None,
    ) -> Job:
        with self.lock:
            now = time.time()
            for existing in self.jobs.values():
                if existing.status not in ("pending", "dispatched"):
                    continue
                if existing.provider != provider:
                    continue
                if existing.question != question:
                    continue
                if now - existing.start_time > self.DEDUP_WINDOW_S:
                    continue
                add_log(
                    f"Dedup: reuse job {existing.id[:8]} (identical in-flight request)"
                )
                return existing

            job = Job(question, provider, model, fresh_chat=fresh_chat)
            self.jobs[job.id] = job
            if provider not in self.queues:
                self.queues[provider] = []
            self.queues[provider].append(job)
            return job

    def take(self) -> Optional[Job]:
        with self.lock:
            for provider, queue in self.queues.items():
                if queue and self.current_jobs.get(provider) is None:
                    job = queue.pop(0)
                    if job.status == "pending":
                        job.status = "dispatched"
                        self.current_jobs[provider] = job
                        return job

            for provider, queue in self.queues.items():
                if queue:
                    current = self.current_jobs.get(provider)
                    if current is None:
                        job = queue.pop(0)
                        if job.status == "pending":
                            job.status = "dispatched"
                            self.current_jobs[provider] = job
                            return job
            return None

    def complete(self, job_id: str, action: str, result: str = "", error: str = ""):
        if not job_id:
            return
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or job.status not in ("pending", "dispatched"):
                return
            if action == "result":
                job.status, job.result = "done", result or ""
            elif action == "cancelled":
                job.status, job.error = "cancelled", error or "cancelled"
            else:
                job.status, job.error = "error", error or "automation failed"
            job.event.set()

            if (
                job.provider in self.current_jobs
                and self.current_jobs[job.provider]
                and self.current_jobs[job.provider].id == job_id
            ):
                self.current_jobs[job.provider] = None

            if len(self.jobs) > 250:
                finished = [
                    jid
                    for jid, j in self.jobs.items()
                    if j.status in ("done", "error", "cancelled")
                ]
                for jid in finished[: len(finished) - 150]:
                    self.jobs.pop(jid, None)


coord = Coordinator()
start_time = time.time()
app_config = load_config()
stats = load_stats()
stats_lock = threading.Lock()

for _pid in PROVIDERS:
    stats["providers"].setdefault(
        _pid, {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0}
    )

stream_enabled = app_config["settings"].get("stream_enabled", True)
fresh_chat_enabled = app_config["settings"].get("fresh_chat", True)
premium_md_enabled = True

try:
    job_timeout = max(
        30, min(230, int(app_config["settings"].get("timeout_seconds", 230)))
    )
except (TypeError, ValueError):
    job_timeout = 230

ext_lock = threading.RLock()
ext_state = {
    "tabs": [],
    "targetTabs": {},
    "connected": False,
    "busy": False,
    "lastSeen": 0.0,
    "logs": [],
    "autoConfig": app_config["settings"].get("auto_config", True),
}

config_lock = threading.RLock()


def add_log(message: str, level: str = "info"):
    with ext_lock:
        ext_state["logs"].append(
            {
                "t": datetime.now().strftime("%H:%M:%S"),
                "level": level,
                "msg": message,
            }
        )
        ext_state["logs"] = ext_state["logs"][-120:]
    print(f"[{level.upper()}] {message}", flush=True)


first_run_key: Optional[str] = None
if not app_config.get("api_keys") and not app_config.get("_api_keys_backup"):
    first_run_key = generate_api_key()
    key_hash = hash_api_key(first_run_key)
    app_config["api_keys"][key_hash] = {
        "id": key_hash[:8],
        "key": first_run_key,
        "name": "default",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    save_config(app_config)
    add_log("Protection API activée par défaut (clé générée)")


def approx_tokens(value: str) -> int:
    text = value or ""
    if not text:
        return 0
    return max(1, round(len(text) / 4))


def extension_connected() -> bool:
    with ext_lock:
        return bool(ext_state["connected"] and time.time() - ext_state["lastSeen"] < 8)


def read_page(name: str) -> str:
    try:
        return (Path(__file__).with_name(name)).read_text(encoding="utf-8")
    except OSError as exc:
        return f"<h1>NemApi</h1><pre>Page unavailable: {exc}</pre>"


class Handler(BaseHTTPRequestHandler):
    server_version = "NemApi/4.1"

    def log_message(self, _fmt, *_args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With, Accept, x-api-key, anthropic-version",
        )

    def _json(self, obj: Any, code: int = 200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _html(self, value: str):
        data = value.encode("utf-8")
        try:
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _get_api_key(self) -> Optional[str]:
        auth_header = self.headers.get("Authorization")
        if auth_header:
            if auth_header.startswith("Bearer ") or auth_header.startswith("ApiKey "):
                return auth_header.split(" ", 1)[1].strip()
            return auth_header.strip()
        x_key = self.headers.get("x-api-key")
        if x_key:
            return x_key.strip()
        return None

    def _validate_api_key(self) -> bool:
        api_key = self._get_api_key()
        if not api_key:
            return False
        return validate_api_key(api_key, app_config)

    def _read_json(self) -> dict:
        size = int(self.headers.get("Content-Length") or 0)
        if size <= 0:
            return {}
        value = json.loads(self.rfile.read(size).decode("utf-8") or "{}")
        if not isinstance(value, dict):
            raise ValueError("JSON body must be an object")
        return value

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._html(read_page("admin.html"))
        elif path == "/config":
            self._html(read_page("config.html"))
        elif path == "/chat":
            self._html(read_page("chat.html"))
        elif path == "/analytics":
            self._html(read_page("analytics.html"))
        elif path == "/api-keys-page":
            self._html(read_page("api-keys.html"))
        elif path == "/compte":
            self._html(read_page("account.html"))
        elif path == "/abonnement":
            self._html(read_page("subscription.html"))
        elif path == "/legal":
            self._html(read_page("legal.html"))
        elif path == "/status":
            with ext_lock:
                tabs = list(ext_state.get("tabs") or [])
                target_tabs = dict(ext_state.get("targetTabs") or {})
                recent_logs = list(ext_state.get("logs") or [])[-8:]
                last_error = next(
                    (e for e in reversed(recent_logs) if e.get("level") == "error"),
                    None,
                )
            with coord.lock:
                queue_sizes = {p: len(q) for p, q in coord.queues.items() if q}
                active = {
                    p: (j.id[:8] if j else None)
                    for p, j in coord.current_jobs.items()
                    if j is not None
                }
                pending_total = sum(len(q) for q in coord.queues.values())
            connected = extension_connected()
            providers_ready = {
                p: (p in target_tabs and any(t.get("provider") == p for t in tabs))
                for p in PROVIDERS
            }
            self._json(
                {
                    "status": "ready" if connected else "waiting_extension",
                    "version": "4.1",
                    "extension": connected,
                    "port": PORT,
                    "local_ip": get_local_ip(),
                    "uptime_seconds": int(time.time() - start_time),
                    "providers_ready": providers_ready,
                    "target_tabs": target_tabs,
                    "open_tabs": [
                        {
                            "id": t.get("id"),
                            "provider": t.get("provider"),
                            "title": (t.get("title") or "")[:60],
                        }
                        for t in tabs
                    ],
                    "jobs": {
                        "pending": pending_total,
                        "queues": queue_sizes,
                        "active": active,
                    },
                    "api_keys_enabled": bool(app_config.get("api_keys")),
                    "settings": {
                        "stream_enabled": stream_enabled,
                        "fresh_chat": fresh_chat_enabled,
                        "premium_md": premium_md_enabled,
                        "auto_config": ext_state.get("autoConfig", True),
                        "timeout_seconds": job_timeout,
                    },
                    "last_error": last_error,
                }
            )
        elif path == "/stats":
            with stats_lock:
                providers_out = {}
                for name, pdata in stats["providers"].items():
                    req = pdata.get("requests") or 0
                    pricing = TOKEN_PRICING.get(name, {})
                    providers_out[name] = {
                        **pdata,
                        "avg_prompt_tokens": round(
                            (pdata.get("prompt_tokens") or 0) / req, 1
                        )
                        if req
                        else 0,
                        "avg_completion_tokens": round(
                            (pdata.get("completion_tokens") or 0) / req, 1
                        )
                        if req
                        else 0,
                        "cost": round(pdata.get("cost") or 0.0, 6),
                        "pricing": {
                            "prompt_per_1k": pricing.get("prompt"),
                            "completion_per_1k": pricing.get("completion"),
                            "label": pricing.get("label", name),
                        },
                    }
                uptime = max(1, int(time.time() - start_time))
                self._json(
                    {
                        "version": "4.1",
                        "uptime_seconds": uptime,
                        "uptime_human": f"{uptime // 3600}h {(uptime % 3600) // 60}m {uptime % 60}s",
                        "total_requests": stats["requests"],
                        "requests_per_minute": round(
                            stats["requests"] / (uptime / 60), 2
                        )
                        if uptime >= 60
                        else stats["requests"],
                        "prompt_tokens": stats["prompt_tokens"],
                        "completion_tokens": stats["completion_tokens"],
                        "total_tokens": stats["prompt_tokens"]
                        + stats["completion_tokens"],
                        "estimated_cost": round(stats["estimated_cost"], 6),
                        "providers": providers_out,
                        "pricing": {
                            pid: {
                                "prompt_per_1k": p.get("prompt"),
                                "completion_per_1k": p.get("completion"),
                                "label": p.get("label", pid),
                            }
                            for pid, p in TOKEN_PRICING.items()
                        },
                        "updated_at": stats.get("updated_at"),
                        "persisted": True,
                    }
                )
        elif path == "/settings":
            with ext_lock:
                self._json(
                    {
                        "stream_enabled": stream_enabled,
                        "auto_config": ext_state.get("autoConfig", True),
                        "fresh_chat": fresh_chat_enabled,
                        "premium_md": True,
                        "timeout_seconds": job_timeout,
                    }
                )
        elif path == "/api-keys/config":
            with config_lock:
                self._json(
                    {
                        "enabled": bool(app_config["api_keys"]),
                        "require_auth": bool(app_config["api_keys"]),
                        "key_count": len(app_config["api_keys"]),
                    }
                )
        elif path == "/providers":
            self._json(
                {
                    "providers": [
                        {
                            "id": key,
                            "models": info["models"],
                            "display_name": info.get("display_name", key),
                            "plan": "free" if key in FREE_PROVIDERS else "premium",
                            "available": provider_available(key),
                        }
                        for key, info in PROVIDERS.items()
                    ]
                }
            )
        elif path == "/api-keys":
            with config_lock:
                api_keys_info = []
                for key_hash, metadata in app_config["api_keys"].items():
                    api_keys_info.append(
                        {
                            "id": metadata.get("id", key_hash[:8]),
                            "key": metadata.get("key", ""),
                            "name": metadata.get("name", ""),
                            "created_at": metadata.get("created_at", ""),
                        }
                    )
                self._json(
                    {
                        "api_keys": api_keys_info,
                        "require_auth": bool(app_config["api_keys"]),
                    }
                )
        elif path == "/subscription":
            self._json(subscription_payload())
        elif path == "/quota":
            self._json(quota_payload())
        elif path == "/backend/status":
            self._json(_backend_status_payload())
        elif path == "/legal/status":
            legal = app_config.get("legal") or {}
            self._json(
                {
                    "accepted": bool(legal.get("accepted")),
                    "accepted_at": legal.get("accepted_at"),
                }
            )
        elif path == "/v1/models":
            data = [
                {
                    "id": info["models"][0],
                    "object": "model",
                    "created": int(start_time),
                    "owned_by": provider,
                }
                for provider, info in PROVIDERS.items()
                if provider_available(provider)
            ]
            self._json({"object": "list", "data": data})
        elif path == "/job":
            job = coord.take()
            if job:
                self._json(
                    {
                        "action": "ask",
                        "jobId": job.id,
                        "question": job.question,
                        "provider": job.provider,
                        "model": job.model,
                        "freshChat": job.fresh_chat
                        if job.fresh_chat is not None
                        else fresh_chat_enabled,
                        "premiumMd": premium_md_enabled,
                    }
                )
            else:
                self._json({"action": "idle"})
        elif path == "/extension/state":
            with ext_lock:
                state = {
                    **ext_state,
                    "targetTabs": dict(ext_state["targetTabs"]),
                    "logs": list(ext_state["logs"]),
                    "connected": extension_connected(),
                }
            self._json(state)
        elif path == "/config-full":
            with config_lock:
                self._json(
                    {
                        "api_keys": {
                            "enabled": bool(app_config["api_keys"]),
                            "count": len(app_config["api_keys"]),
                            "keys": [
                                {
                                    "id": metadata.get("id", key_hash[:8]),
                                    "name": metadata.get("name", ""),
                                    "created_at": metadata.get("created_at", ""),
                                }
                                for key_hash, metadata in app_config["api_keys"].items()
                            ],
                        },
                        "settings": app_config["settings"],
                    }
                )
        elif path == "/extension/config":
            with ext_lock:
                self._json(
                    {
                        "targetTabs": dict(ext_state["targetTabs"]),
                        "autoConfig": ext_state.get("autoConfig", True),
                        "freshChat": fresh_chat_enabled,
                        "premiumMd": premium_md_enabled,
                    }
                )
        elif self._serve_static(path):
            return
        else:
            self._json(
                {"error": {"message": "not found", "type": "not_found"}}, 404
            )

    def _serve_static(self, path: str) -> bool:
        rel = path.lstrip("/")
        if not rel or ".." in rel:
            return False
        base = Path(__file__).parent.resolve()
        target = (base / rel).resolve()
        if not str(target).startswith(str(base)) or not target.is_file():
            return False
        ctype = STATIC_TYPES.get(target.suffix.lower(), "application/octet-stream")
        data = target.read_bytes()
        try:
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", ctype)
            if target.suffix.lower() in (".html", ".js", ".css"):
                self.send_header("Cache-Control", "no-store")
            else:
                self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionResetError):
            return False

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._read_json()
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
            self._json(
                {
                    "error": {
                        "message": f"Invalid JSON: {exc}",
                        "type": "invalid_request",
                    }
                },
                400,
            )
            return

        if path == "/job":
            job_id, action = body.get("jobId"), body.get("action")
            coord.complete(
                job_id,
                action or "error",
                result=body.get("result") or "",
                error=body.get("error") or "",
            )
            level = "info" if action == "result" else "error"
            detail = (
                f"{len(body.get('result') or '')} chars"
                if action == "result"
                else (body.get("error") or "unknown error")
            )
            add_log(
                f"Job {str(job_id)[:8]} {'OK' if action == 'result' else action}: {detail}",
                level,
            )
            self._json({"ok": True})
        elif path == "/stats/clear":
            with stats_lock:
                stats["requests"] = 0
                stats["prompt_tokens"] = 0
                stats["completion_tokens"] = 0
                stats["estimated_cost"] = 0.0
                stats["providers"] = _empty_provider_stats()
                stats["updated_at"] = datetime.now().isoformat(timespec="seconds")
                save_stats(stats)
            add_log("Analytics counters reset")
            self._json({"ok": True, "message": "Stats cleared"})
        elif path == "/extension/log":
            level = (
                body.get("level")
                if body.get("level") in ("info", "warn", "error")
                else "info"
            )
            add_log(f"Extension: {str(body.get('message') or '')[:500]}", level)
            self._json({"ok": True})
        elif path == "/extension/tabs":
            with ext_lock:
                ext_state["tabs"] = body.get("tabs") or []
                ext_state["connected"] = True
                ext_state["busy"] = bool(body.get("busy"))
                ext_state["lastSeen"] = time.time()
                if ext_state.get("autoConfig", True):
                    for provider in PROVIDERS.keys():
                        if not provider_available(provider):
                            continue
                        if provider not in ext_state["targetTabs"]:
                            for tab in ext_state["tabs"]:
                                if tab.get("provider") == provider:
                                    ext_state["targetTabs"][provider] = tab.get("id")
                                    add_log(
                                        f"Auto-configured {provider} tab: {tab.get('id')}"
                                    )
                                    break
            self._json({"ok": True})
        elif path == "/extension/config":
            provider, tab_id = body.get("provider"), body.get("targetTabId")
            if provider not in PROVIDERS or not isinstance(tab_id, int):
                self._json(
                    {
                        "error": {
                            "message": "provider and numeric targetTabId are required",
                            "type": "invalid_request",
                        }
                    },
                    400,
                )
                return
            if not provider_available(provider):
                self._json(
                    {
                        "error": {
                            "message": f"Le provider '{provider}' est réservé au plan Premium. Activez votre clé de produit (page Abonnement).",
                            "type": "payment_required",
                        }
                    },
                    402,
                )
                return
            with ext_lock:
                matching = next(
                    (
                        tab
                        for tab in ext_state["tabs"]
                        if tab.get("id") == tab_id and tab.get("provider") == provider
                    ),
                    None,
                )
                if not matching:
                    self._json(
                        {
                            "error": {
                                "message": f"Tab {tab_id} is not an open {provider} tab",
                                "type": "invalid_request",
                            }
                        },
                        400,
                    )
                    return
                ext_state["targetTabs"][provider] = tab_id
            add_log(f"Selected {provider} tab: {tab_id}")
            self._json({"ok": True, "targetTabs": ext_state["targetTabs"]})
        elif path == "/settings":
            global stream_enabled, fresh_chat_enabled, premium_md_enabled, job_timeout
            settings_updated = False

            if "stream_enabled" in body:
                stream_enabled = bool(body["stream_enabled"])
                app_config["settings"]["stream_enabled"] = stream_enabled
                settings_updated = True
                add_log(f"Stream {'ON' if stream_enabled else 'OFF'}")
            if "auto_config" in body:
                with ext_lock:
                    ext_state["autoConfig"] = bool(body["auto_config"])
                    app_config["settings"]["auto_config"] = ext_state["autoConfig"]
                settings_updated = True
                add_log(f"Auto-config {'ON' if ext_state['autoConfig'] else 'OFF'}")
            if "fresh_chat" in body:
                fresh_chat_enabled = bool(body["fresh_chat"])
                app_config["settings"]["fresh_chat"] = fresh_chat_enabled
                settings_updated = True
                add_log(f"Fresh-chat {'ON' if fresh_chat_enabled else 'OFF'}")
            if "premium_md" in body:
                premium_md_enabled = True
                app_config["settings"]["premium_md"] = True
                settings_updated = True
            if "timeout_seconds" in body:
                try:
                    job_timeout = max(
                        30, min(230, int(body["timeout_seconds"]))
                    )
                except (TypeError, ValueError):
                    job_timeout = 230
                app_config["settings"]["timeout_seconds"] = job_timeout
                settings_updated = True
                add_log(f"Timeout réponse : {job_timeout}s")

            if settings_updated:
                save_config(app_config)

            self._json(
                {
                    "stream_enabled": stream_enabled,
                    "auto_config": ext_state.get("autoConfig", True),
                    "fresh_chat": fresh_chat_enabled,
                    "premium_md": True,
                    "timeout_seconds": job_timeout,
                }
            )
        elif path == "/stop":
            stopped = 0
            with coord.lock:
                for job in list(coord.jobs.values()):
                    if job.status in ("pending", "dispatched"):
                        job.status, job.error = "cancelled", "stopped"
                        job.event.set()
                        stopped += 1
                for provider in list(coord.queues.keys()):
                    coord.queues[provider].clear()
                for provider in list(coord.current_jobs.keys()):
                    coord.current_jobs[provider] = None
            add_log(f"All pending jobs stopped ({stopped} cancelled)", "warn")
            self._json({"ok": True, "cancelled": stopped})
        elif path == "/api-keys/enable":
            with config_lock:
                if not app_config["api_keys"]:
                    new_key = generate_api_key()
                    key_hash = hash_api_key(new_key)
                    app_config["api_keys"][key_hash] = {
                        "id": key_hash[:8],
                        "key": new_key,
                        "name": "default",
                        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    }
                    save_config(app_config)
                    add_log("Protection API activée avec une clé par défaut")
                    self._json(
                        {
                            "ok": True,
                            "api_key": new_key,
                            "key_id": key_hash[:8],
                            "message": "Clé par défaut créée",
                        }
                    )
                else:
                    self._json({"ok": True, "message": "Protection déjà active"})
        elif path == "/api-keys/disable":
            with config_lock:
                if app_config["api_keys"]:
                    app_config["_api_keys_backup"] = app_config["api_keys"]
                app_config["api_keys"] = {}
                save_config(app_config)
                add_log("Protection API désactivée (clés sauvegardées)")
                self._json({"ok": True, "message": "Protection désactivée"})
        elif path == "/api-keys/restore":
            with config_lock:
                if app_config.get("_api_keys_backup"):
                    app_config["api_keys"] = app_config["_api_keys_backup"]
                    del app_config["_api_keys_backup"]
                    save_config(app_config)
                    add_log("Protection API restaurée depuis le backup")
                    self._json(
                        {
                            "ok": True,
                            "message": "Protection restaurée",
                            "key_count": len(app_config["api_keys"]),
                        }
                    )
                else:
                    self._json(
                        {
                            "error": {
                                "message": "Aucun backup de clés trouvé",
                                "type": "not_found",
                            }
                        },
                        404,
                    )
        elif path == "/api-keys":
            with config_lock:
                name = body.get("name", "")
                new_key = generate_api_key()
                key_hash = hash_api_key(new_key)
                app_config["api_keys"][key_hash] = {
                    "id": key_hash[:8],
                    "key": new_key,
                    "name": name,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                save_config(app_config)
                add_log(f"Nouvelle clé API créée: {name or key_hash[:8]}")
                self._json({"ok": True, "api_key": new_key, "key_id": key_hash[:8]})
        elif path.startswith("/api-keys/"):
            key_id = path.split("/")[2]
            with config_lock:
                key_to_delete = None
                for key_hash, metadata in app_config["api_keys"].items():
                    if metadata.get("id") == key_id:
                        key_to_delete = key_hash
                        break

                if key_to_delete:
                    del app_config["api_keys"][key_to_delete]
                    save_config(app_config)
                    add_log(f"Clé API supprimée: {key_id}")
                    self._json({"ok": True})
                else:
                    self._json(
                        {"error": {"message": "Clé API non trouvée", "type": "not_found"}},
                        404,
                    )
        elif path == "/subscription/activate":
            user = str(body.get("user") or "").strip() or _backend_user()
            raw_key = body.get("product_key", "")
            key = normalize_product_key(raw_key)
            burl = _backend_url()
            if burl:
                if not user:
                    self._json(
                        {
                            "error": {
                                "message": "Renseignez d'abord votre pseudo NemApi avant d'activer une clé.",
                                "type": "missing_user",
                            }
                        },
                        400,
                    )
                    return
                try:
                    v = _backend_call(
                        {"action": "verify", "key": key, "user": user},
                        timeout=BACKEND_TIMEOUT,
                    )
                except Exception as e:
                    add_log(f"Backend Sheets injoignable (verify) : {e}", "error")
                    self._json(
                        {
                            "error": {
                                "message": f"Backend Google Sheets injoignable : {e}",
                                "type": "backend_unavailable",
                            }
                        },
                        502,
                    )
                    return
                if not v.get("valid"):
                    status_code = (
                        402
                        if v.get("reason")
                        in ("key_assigned", "expired", "key_disabled")
                        else 400
                    )
                    self._json(
                        {
                            "error": {
                                "message": v.get("message") or "Clé de produit invalide.",
                                "type": v.get("reason") or "invalid_key",
                            }
                        },
                        status_code,
                    )
                    return
                try:
                    a = _backend_call(
                        {"action": "activate", "key": key, "user": user},
                        timeout=BACKEND_TIMEOUT,
                    )
                except Exception as e:
                    add_log(f"Backend Sheets injoignable (activate) : {e}", "error")
                    self._json(
                        {
                            "error": {
                                "message": f"Backend Google Sheets injoignable : {e}",
                                "type": "backend_unavailable",
                            }
                        },
                        502,
                    )
                    return
                if not a.get("ok"):
                    self._json(
                        {
                            "error": {
                                "message": a.get("message")
                                or a.get("error")
                                or "Activation impossible.",
                                "type": a.get("error") or "activation_failed",
                            }
                        },
                        400,
                    )
                    return
                sub_state = {
                    "plan": a["plan"],
                    "product_key": key,
                    "activated_at": a.get("activated_at"),
                    "source": "sheets",
                    "user": user,
                }
                if a.get("expires_at"):
                    sub_state["expires_at"] = a["expires_at"]
                with config_lock:
                    app_config["subscription"] = sub_state
                    save_config(app_config)
                add_log(
                    f"Abonnement {PLAN_NAMES.get(a['plan'], a['plan']).upper()} activé via Sheets (clé {mask_product_key(key)}, user={user})"
                )
                self._json(
                    {
                        "ok": True,
                        "plan": a["plan"],
                        "plan_name": PLAN_NAMES.get(a["plan"], a["plan"]),
                        "product_key": mask_product_key(key),
                        "activated_at": a.get("activated_at"),
                        "expires_at": a.get("expires_at"),
                        "reactivated": a.get("reactivated", False),
                        "source": "sheets",
                    }
                )
                return

            plan = validate_product_key(key)
            if not plan:
                self._json(
                    {
                        "error": {
                            "message": "Clé de produit invalide. Format : 16 lettres et chiffres (préfixe PA ou PL).",
                            "type": "invalid_key",
                        }
                    },
                    400,
                )
                return
            now_utc = datetime.now(timezone.utc)
            sub_state = {
                "plan": plan,
                "product_key": key,
                "activated_at": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
                "source": "local",
            }
            if plan == "premium_annual":
                sub_state["expires_at"] = (now_utc + timedelta(days=365)).isoformat()
            with config_lock:
                app_config["subscription"] = sub_state
                save_config(app_config)
            add_log(
                f"Abonnement {PLAN_NAMES[plan].upper()} activé localement (clé {mask_product_key(key)})"
            )
            self._json(
                {
                    "ok": True,
                    "plan": plan,
                    "plan_name": PLAN_NAMES[plan],
                    "product_key": mask_product_key(key),
                    "activated_at": sub_state["activated_at"],
                    "expires_at": sub_state.get("expires_at"),
                    "source": "local",
                }
            )
        elif path == "/subscription/deactivate":
            sub_state = subscription_state()
            key = str(sub_state.get("product_key") or "")
            user = str(sub_state.get("user") or "") or _backend_user()
            backend_error = None
            if _backend_url() and key and user:
                try:
                    _backend_call(
                        {"action": "deactivate", "key": key, "user": user},
                        timeout=BACKEND_TIMEOUT,
                    )
                    add_log(f"Clé {mask_product_key(key)} libérée dans le classeur (user={user})")
                except Exception as e:
                    backend_error = str(e)
                    add_log(f"Échec libération clé dans le classeur : {e}", "warn")
            with config_lock:
                app_config["subscription"] = {"plan": "free"}
                save_config(app_config)
            add_log("Abonnement désactivé - retour au plan gratuit", "warn")
            self._json({"ok": True, "plan": "free", "backend_error": backend_error})
        elif path == "/backend":
            prev = app_config.get("backend") or {}
            url = (
                str(body["url"]).strip()
                if "url" in body
                else str(prev.get("url") or "")
            )
            user = (
                str(body["user"]).strip()
                if "user" in body
                else str(prev.get("user") or "")
            )
            name = str(body.get("name") or "").strip()
            email = str(body.get("email") or "").strip()
            if url and not url.startswith("https://"):
                self._json(
                    {
                        "error": {
                            "message": "L'URL du backend doit commencer par https://",
                            "type": "invalid_url",
                        }
                    },
                    400,
                )
                return
            if url and "/exec" not in url:
                self._json(
                    {
                        "error": {
                            "message": "URL Apps Script invalide : elle doit se terminer par /exec",
                            "type": "invalid_url",
                        }
                    },
                    400,
                )
                return
            if user and not re.fullmatch(r"[A-Za-z0-9_.\-]{2,32}", user):
                self._json(
                    {
                        "error": {
                            "message": "Pseudo invalide : 2 à 32 caractères (lettres, chiffres, . _ -)",
                            "type": "invalid_user",
                        }
                    },
                    400,
                )
                return
            if name and len(name) > 64:
                self._json(
                    {
                        "error": {
                            "message": "Nom trop long (64 caractères max).",
                            "type": "invalid_name",
                        }
                    },
                    400,
                )
                return
            if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]{2,}", email):
                self._json(
                    {
                        "error": {
                            "message": "Email invalide.",
                            "type": "invalid_email",
                        }
                    },
                    400,
                )
                return
            with config_lock:
                b = dict(prev)
                b["url"] = url
                b["user"] = user
                app_config["backend"] = b
                save_config(app_config)
            add_log(
                f"Backend Sheets {'activé' if url else 'désactivé'} (user={user or '—'})"
            )
            account = None
            created = False
            if url and user:
                try:
                    res = _backend_call(
                        {
                            "action": "claim",
                            "user": user,
                            "name": name,
                            "email": email,
                        },
                        timeout=BACKEND_TIMEOUT,
                    )
                    if res.get("ok"):
                        account = res.get("user")
                        created = bool(res.get("created"))
                except Exception as e:
                    add_log(f"Compte Sheets non créé (backend injoignable) : {e}", "warn")
                    self._json(
                        {
                            "ok": True,
                            "backend": {"url": url, "user": user, "configured": True},
                            "account": None,
                            "account_error": str(e),
                        }
                    )
                    return
            self._json(
                {
                    "ok": True,
                    "backend": {
                        "url": url,
                        "user": user,
                        "configured": bool(url),
                    },
                    "account": account,
                    "account_created": created,
                }
            )
        elif path == "/backend/sync":
            url = _backend_url()
            user = _backend_user()
            if not url or not user:
                self._json(
                    {
                        "error": {
                            "message": "Backend non configuré ou pseudo absent.",
                            "type": "not_configured",
                        }
                    },
                    400,
                )
                return
            try:
                res = _backend_get(
                    "action=user&name=" + quote(user), timeout=BACKEND_TIMEOUT
                )
            except Exception as e:
                self._json(
                    {
                        "error": {
                            "message": f"Backend injoignable : {e}",
                            "type": "backend_unavailable",
                        }
                    },
                    502,
                )
                return
            if not res.get("ok"):
                self._json(
                    {
                        "error": {
                            "message": "Compte introuvable dans le classeur.",
                            "type": "user_not_found",
                        }
                    },
                    404,
                )
                return
            sheet_plan = str(res.get("user", {}).get("plan") or "free")
            local_plan = effective_plan()
            changed = False
            if sheet_plan == "free" and local_plan != "free":
                with config_lock:
                    app_config["subscription"] = {"plan": "free"}
                    save_config(app_config)
                add_log("Synchronisation : retour au plan gratuit (état du classeur)", "warn")
                changed = True
            self._json(
                {
                    "ok": True,
                    "sheet_plan": sheet_plan,
                    "local_plan": local_plan,
                    "changed": changed,
                }
            )
        elif path == "/legal/accept":
            with config_lock:
                app_config["legal"] = {
                    "accepted": True,
                    "accepted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
                save_config(app_config)
            add_log("Conditions d'utilisation acceptées")
            self._json({"ok": True, "accepted_at": app_config["legal"]["accepted_at"]})
        elif path == "/admin/test-completion":
            self._create_completion(body)
        elif path == "/v1/chat/completions":
            if app_config["api_keys"] and not self._validate_api_key():
                self._json(
                    {
                        "error": {
                            "message": "Clé API requise. Ajoutez un en-tête Authorization: Bearer <votre_clé>",
                            "type": "unauthorized",
                        }
                    },
                    401,
                )
                return
            self._create_completion(body)
        elif path == "/v1/messages":
            if app_config["api_keys"] and not self._validate_api_key():
                self._json(
                    {
                        "error": {
                            "message": "Clé API requise. Ajoutez un en-tête Authorization: Bearer <votre_clé> ou x-api-key",
                            "type": "unauthorized",
                        }
                    },
                    401,
                )
                return
            self._create_anthropic_message(body)
        else:
            self._json(
                {"error": {"message": "not found", "type": "not_found"}}, 404
            )

    def _create_anthropic_message(self, body: dict):
        model = str(body.get("model") or "claude-sonnet").strip()
        system_val = body.get("system")
        system_text = ""
        if isinstance(system_val, str):
            system_text = system_val
        elif isinstance(system_val, list):
            system_text = "\n".join(
                str(item.get("text") or item) for item in system_val if isinstance(item, (dict, str))
            )

        messages = []
        if system_text:
            messages.append({"role": "system", "content": system_text})
        
        for msg in body.get("messages") or []:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                text_parts = [
                    p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"
                ]
                content = "\n".join(text_parts)
            messages.append({"role": role, "content": content})

        tools_anthropic = body.get("tools") or []
        openai_tools = []
        for t in tools_anthropic:
            if isinstance(t, dict):
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema", {})
                    }
                })

        adapted_body = {
            "model": model,
            "provider": "claude",
            "messages": messages,
            "stream": bool(body.get("stream", False)),
        }
        if openai_tools:
            adapted_body["tools"] = openai_tools

        self._create_completion(adapted_body)

    def _create_completion(self, body: dict):
        model = str(body.get("model") or "").strip()
        explicit_provider = str(body.get("provider") or "").lower().strip()

        if explicit_provider:
            provider = explicit_provider
        elif model:
            provider = MODEL_TO_PROVIDER.get(model)
            if provider is None and "/" in model:
                head = model.split("/")[0].lower().strip()
                tail = model.split("/")[-1]
                provider = MODEL_TO_PROVIDER.get(tail) or (
                    head if head in PROVIDERS else None
                )
            if not provider or provider not in PROVIDERS:
                low = model.lower()
                for alias, prov in MODEL_ALIASES.items():
                    if alias in low or low in alias:
                        provider = prov
                        break
            if not provider or provider not in PROVIDERS:
                valid = sorted(
                    set(
                        list(MODEL_ALIASES.keys())
                        + [f"{p}/{i['models'][0]}" for p, i in PROVIDERS.items()]
                    )
                )
                self._json(
                    {
                        "error": {
                            "message": f"Unknown model '{model}'. Try one of: {', '.join(valid[:12])}",
                            "type": "invalid_request",
                        }
                    },
                    400,
                )
                return
        else:
            self._json(
                {
                    "error": {
                        "message": "The 'model' field is required. Examples: 'qwen-chat', 'deepseek-chat', 'claude-sonnet'.",
                        "type": "invalid_request",
                    }
                },
                400,
            )
            return

        if provider not in PROVIDERS:
            self._json(
                {
                    "error": {
                        "message": f"Unknown provider '{provider}'. Available: {', '.join(PROVIDERS.keys())}.",
                        "type": "invalid_request",
                    }
                },
                400,
            )
            return

        if not provider_available(provider):
            self._json(
                {
                    "error": {
                        "message": f"Le provider '{provider}' est réservé au plan Premium. Activez votre clé de produit dans l'admin (page Abonnement). Le plan gratuit inclut Gemini et DeepSeek.",
                        "type": "payment_required",
                    }
                },
                402,
            )
            return

        if not plan_is_premium():
            raw_msgs = " ".join(
                str(m.get("content") or "")
                for m in (body.get("messages") or [])
                if isinstance(m, dict)
            )
            if quota_remaining() < approx_tokens(raw_msgs):
                q = quota_payload()
                self._json(
                    {
                        "error": {
                            "message": (
                                f"Quota journalier du plan gratuit épuisé "
                                f"({q['used']:,} / {DAILY_TOKEN_QUOTA_FREE:,} tokens). "
                                f"Le compteur se réinitialisera demain à {q['resets_at_gmt']} GMT."
                            ),
                            "type": "quota_exceeded",
                        }
                    },
                    429,
                )
                return

        response_model = model or PROVIDERS[provider]["models"][0]
        internal_model = PROVIDERS[provider]["models"][0]

        if not extension_connected():
            wait_deadline = time.time() + 30
            while not extension_connected() and time.time() < wait_deadline:
                time.sleep(0.5)
            if not extension_connected():
                self._json(
                    {
                        "error": {
                            "message": "Browser extension is not connected. Load it and open the provider tab.",
                            "type": "extension_unavailable",
                        }
                    },
                    503,
                )
                return

        with ext_lock:
            if provider not in ext_state["targetTabs"]:
                self._json(
                    {
                        "error": {
                            "message": f"No {provider} tab is selected. Open the dashboard to configure.",
                            "type": "provider_not_selected",
                        }
                    },
                    409,
                )
                return

        messages = body.get("messages") or []
        if not messages:
            self._json(
                {
                    "error": {
                        "message": "At least one message is required.",
                        "type": "invalid_request",
                    }
                },
                400,
            )
            return

        tools = body.get("tools") or body.get("functions")
        if tools and not isinstance(tools, list):
            tools = None

        prompt = format_messages_prompt(messages, tools=tools)
        if not prompt.strip():
            self._json(
                {
                    "error": {
                        "message": "Messages produced an empty prompt.",
                        "type": "invalid_request",
                    }
                },
                400,
            )
            return

        if not plan_is_premium():
            est_tokens = approx_tokens(prompt)
            if quota_remaining() < est_tokens:
                q = quota_payload()
                self._json(
                    {
                        "error": {
                            "message": (
                                f"Quota journalier du plan gratuit épuisé "
                                f"({q['used']:,} / {DAILY_TOKEN_QUOTA_FREE:,} tokens)."
                            ),
                            "type": "quota_exceeded",
                        }
                    },
                    429,
                )
                return

        requested_tool_names: List[str] = []
        if tools:
            for t in tools:
                fn = (t or {}).get("function") or t or {}
                if fn.get("name"):
                    requested_tool_names.append(str(fn["name"]))

        if "stream" in body:
            stream_requested = bool(body.get("stream"))
        else:
            stream_requested = bool(stream_enabled)

        accept = (self.headers.get("Accept") or "").lower()
        if "text/event-stream" in accept:
            stream_requested = True

        fresh_chat_req = body.get("fresh_chat")
        if fresh_chat_req is not None:
            fresh_chat_req = bool(fresh_chat_req)

        add_log(
            f"Completion -> {provider}/{response_model} stream={stream_requested} "
            f"tools={len(requested_tool_names)} prompt={len(prompt)}c"
        )
        self._handle_completion(
            prompt,
            provider,
            response_model,
            stream_requested,
            requested_tool_names=requested_tool_names or None,
            internal_model=internal_model,
            fresh_chat=fresh_chat_req,
        )

    def _handle_completion(
        self,
        prompt: str,
        provider: str,
        model: str,
        stream: bool,
        requested_tool_names: list | None = None,
        internal_model: str | None = None,
        fresh_chat: bool | None = None,
    ):
        job = coord.create(
            prompt, provider, internal_model or model, fresh_chat=fresh_chat
        )
        tail = prompt.replace("\n", " ")[-80:]
        add_log(
            f"Job {job.id[:8]} queued -> {provider}/{model} ({len(prompt)} chars) tail={tail!r}"
        )
        if not job.event.wait(timeout=job_timeout):
            coord.complete(job.id, "error", error="timeout waiting for extension")
            add_log(f"Job {job.id[:8]} timed out", "error")
            self._json(
                {
                    "error": {
                        "message": "Timeout waiting for the browser extension. Check the admin log.",
                        "type": "timeout",
                    }
                },
                504,
            )
            return

        if job.status != "done":
            self._json(
                {
                    "error": {
                        "message": job.error or "automation failed",
                        "type": "automation_error",
                    }
                },
                500,
            )
            return

        text = clean_assistant_text(job.result or "")
        remaining, tool_calls = parse_tool_calls(text, requested_tool_names)
        if tool_calls:
            text = remaining
        finish_reason = "tool_calls" if tool_calls else "stop"

        prompt_tokens = approx_tokens(prompt)
        completion_tokens = approx_tokens(text)
        estimated_cost = calculate_cost(provider, prompt_tokens, completion_tokens)

        with stats_lock:
            stats["requests"] += 1
            stats["prompt_tokens"] += prompt_tokens
            stats["completion_tokens"] += completion_tokens
            stats["estimated_cost"] += estimated_cost
            if provider not in stats["providers"]:
                stats["providers"][provider] = {
                    "requests": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "cost": 0.0,
                }
            stats["providers"][provider]["requests"] += 1
            stats["providers"][provider]["prompt_tokens"] += prompt_tokens
            stats["providers"][provider]["completion_tokens"] += completion_tokens
            stats["providers"][provider]["cost"] += estimated_cost
            save_stats(stats)

        if not plan_is_premium():
            _add_quota_tokens(prompt_tokens + completion_tokens)

        b_url = _backend_url()
        b_user = _backend_user()
        if b_url and b_user:
            threading.Thread(
                target=_report_backend_usage,
                args=(b_user, 1, prompt_tokens + completion_tokens, _today_gmt()),
                daemon=True,
            ).start()

        usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
        chat_id = "chatcmpl-" + uuid.uuid4().hex[:10]

        if stream:
            self._sse(
                chat_id,
                provider,
                model,
                text,
                tool_calls=tool_calls or None,
                usage=usage,
            )
        else:
            message: Dict[str, Any] = {
                "role": "assistant",
                "content": text if text else (None if tool_calls else ""),
            }
            if tool_calls:
                message["tool_calls"] = tool_calls
            self._json(
                {
                    "id": chat_id,
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "message": message,
                            "finish_reason": finish_reason,
                        }
                    ],
                    "usage": usage,
                }
            )

    def _sse(
        self,
        chat_id: str,
        provider: str,
        model: str,
        text: str,
        tool_calls: list | None = None,
        usage: dict | None = None,
    ):
        try:
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "close")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            def emit(value: dict):
                payload = json.dumps(
                    value, ensure_ascii=False, separators=(",", ":")
                )
                self.wfile.write(f"data: {payload}\n\n".encode("utf-8"))
                self.wfile.flush()

            created = int(time.time())
            common = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
            }

            emit(
                {
                    **common,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"role": "assistant"},
                            "finish_reason": None,
                        }
                    ],
                }
            )

            if text:
                chunk_size = 64
                for offset in range(0, len(text), chunk_size):
                    piece = text[offset : offset + chunk_size]
                    emit(
                        {
                            **common,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": piece},
                                    "finish_reason": None,
                                }
                            ],
                        }
                    )
                    time.sleep(0.001)

            if tool_calls:
                for i, tc in enumerate(tool_calls):
                    fn = tc.get("function") or {}
                    emit(
                        {
                            **common,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {
                                        "tool_calls": [
                                            {
                                                "index": i,
                                                "id": tc.get("id")
                                                or f"call_{uuid.uuid4().hex[:12]}",
                                                "type": "function",
                                                "function": {
                                                    "name": fn.get("name") or "",
                                                    "arguments": "",
                                                },
                                            }
                                        ]
                                    },
                                    "finish_reason": None,
                                }
                            ],
                        }
                    )
                    args = fn.get("arguments") or "{}"
                    if not isinstance(args, str):
                        args = json.dumps(args, ensure_ascii=False)
                    arg_chunk = 80
                    for offset in range(0, len(args), arg_chunk):
                        emit(
                            {
                                **common,
                                "choices": [
                                    {
                                        "index": 0,
                                        "delta": {
                                            "tool_calls": [
                                                {
                                                    "index": i,
                                                    "function": {
                                                        "arguments": args[
                                                            offset : offset
                                                            + arg_chunk
                                                        ]
                                                    },
                                                }
                                            ]
                                        },
                                        "finish_reason": None,
                                    }
                                ],
                            }
                        )

            finish = "tool_calls" if tool_calls else "stop"
            final_chunk: Dict[str, Any] = {
                **common,
                "choices": [{"index": 0, "delta": {}, "finish_reason": finish}],
            }
            if usage:
                final_chunk["usage"] = usage
            emit(final_chunk)
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            try:
                if hasattr(self, "request") and isinstance(
                    self.request, socket.socket
                ):
                    self.request.shutdown(socket.SHUT_WR)
            except OSError:
                pass
            self.close_connection = True
        except (BrokenPipeError, ConnectionResetError, OSError):
            self.close_connection = True


def main():
    local_ip = get_local_ip()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"NemApi v4.1 listening on http://{HOST}:{PORT}/")
    print(f"Local network URL: http://{local_ip}:{PORT}/")
    print("Admin UI    http://127.0.0.1:{PORT}/")
    print("Analytics   http://127.0.0.1:{PORT}/analytics")
    print("API         POST /v1/chat/completions")

    if first_run_key:
        print("\n" + "=" * 64)
        print("  PREMIER LANCEMENT - protection API activée par défaut")
        print(f"  Clé API par défaut : {first_run_key}")
        print("=" * 64 + "\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBye.")


if __name__ == "__main__":
    main()
