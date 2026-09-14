#!/usr/bin/env bash
# Script de démarrage pour NemApi
set -e

echo "=========================================="
echo "   Démarrage de NemApi v4.1 Proxy"
echo "=========================================="
echo "Port proxy local : 8090"
echo "Endpoint API    : http://127.0.0.1:8090/v1/chat/completions"
echo ""

# Vérifier Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERREUR] Python 3 n'est pas installé."
    exit 1
fi

# Lancer proxy.py
exec python3 proxy.py
