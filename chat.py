#!/usr/bin/env python3
"""NemApi Test Client - Contexte Incremental
Script simple sans dépendances externes pour tester la gestion du contexte
avec l'API NemApi.
Usage:
    python3 chat.py
"""

import json
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

HOST = "127.0.0.1"
PORT = 8090
BASE_URL = f"http://{HOST}:{PORT}"

AVAILABLE_MODELS = {
    "deepseek": ["deepseek-chat", "deepseek-coder", "deepseek-r1", "chat"],
    "qwen": ["qwen-plus", "qwen2.5-plus", "qwen2.5-coder", "plus"],
    "claude": ["claude-sonnet", "claude-3-sonnet", "claude-3.5-sonnet", "claude-3.7-sonnet", "sonnet"],
    "gemini": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-pro", "flash"],
    "chatgpt": ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini", "chatgpt"],
    "kimi": ["kimi-chat", "kimi-k2", "kimi"],
    "zai": ["glm-4", "glm-5", "zai-chat", "chatglm"],
}

ALL_MODELS = []
for provider, models in AVAILABLE_MODELS.items():
    for model in models:
        ALL_MODELS.append({"name": model, "provider": provider})
        ALL_MODELS.append({"name": f"{provider}/{model}", "provider": provider})


def print_header(text):
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}")


def print_message(role, content, provider=None):
    role_color = {
        "user": "\033[94m",
        "assistant": "\033[92m",
        "system": "\033[93m",
    }
    color = role_color.get(role, "\033[0m")
    reset = "\033[0m"
    prefix = f"{color}[{role.upper()}]{reset}"
    if provider:
        prefix += f" ({provider})"
    print(f"{prefix}: {content}")


def send_request(model, messages, stream=False, provider=None):
    url = f"{BASE_URL}/v1/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }
    if provider:
        payload["provider"] = provider
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers=headers, method="POST")

    try:
        with urlopen(req, timeout=300) as response:
            if response.status != 200:
                body = response.read().decode("utf-8")
                try:
                    error_data = json.loads(body)
                    error_msg = error_data.get("error", {}).get("message", body)
                except Exception:
                    error_msg = body
                raise Exception(f"HTTP {response.status}: {error_msg}")
            body = response.read().decode("utf-8")
            data = json.loads(body)
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            else:
                return ""
    except HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            error_data = json.loads(body)
            error_msg = error_data.get("error", {}).get("message", body)
        except Exception:
            error_msg = body
        raise Exception(f"HTTP {e.code}: {error_msg}")
    except URLError as e:
        raise Exception(f"Impossible de se connecter au proxy: {e.reason}")
    except json.JSONDecodeError as e:
        raise Exception(f"Réponse JSON invalide: {e}")


def check_proxy_status():
    try:
        url = f"{BASE_URL}/status"
        req = Request(url, method="GET")
        with urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("status") == "ready"
    except Exception:
        return False


def select_model():
    print_header("Sélection du Modèle")
    print("\nModèles disponibles (le provider est déduit automatiquement):")
    for provider, models in AVAILABLE_MODELS.items():
        print(f"\n    {provider}:")
        for model in models:
            print(f"     - {model}  (ou {provider}/{model})")
    print("\n  Exemples : qwen-plus, deepseek-chat, claude-sonnet, gemini-2.5-flash")

    while True:
        try:
            choice = input("\nEntrez le nom du modèle: ").strip()
            if not choice:
                provider = list(AVAILABLE_MODELS.keys())[0]
                model = AVAILABLE_MODELS[provider][0]
                print(f"Modèle par défaut: {model} ({provider})")
                return model
            for item in ALL_MODELS:
                if item["name"] == choice:
                    print(f"\nSélection: {choice} (provider: {item['provider']})")
                    return choice
            print(f"\nSélection: {choice} (le proxy validera le modèle)")
            return choice
        except KeyboardInterrupt:
            print("\nAnnulé.")
            sys.exit(0)


def main():
    print_header("NemApi Test Client")
    if not check_proxy_status():
        print("   Le proxy n'est pas encore prêt ou l'extension n'est pas connectée.")
        print("   Vérifiez que le serveur est démarré.")
    else:
        print("  Proxy est prêt !")

    model = select_model()
    messages = []
    system_prompt = input("\nMessage système optionnel (laissez vide pour aucun): ").strip()
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
        print_message("system", system_prompt)

    while True:
        try:
            user_input = input("\nVous: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("quit", "exit", "q"):
                print("\nFin de la conversation.")
                break
            messages.append({"role": "user", "content": user_input})
            print_message("user", user_input)
            start_time = time.time()
            try:
                response = send_request(model, messages, stream=False)
                elapsed = time.time() - start_time
                print_message("assistant", response)
                print(f"\n    Réponse reçue en {elapsed:.2f}s")
                messages.append({"role": "assistant", "content": response})
            except Exception as e:
                print(f"\n    Erreur: {e}")
                messages.pop()
        except KeyboardInterrupt:
            print("\n\nFin de la conversation.")
            break


if __name__ == "__main__":
    main()
