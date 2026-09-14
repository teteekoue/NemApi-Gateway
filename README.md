# NemApi — Passerelle Locale OpenAI & Hub IA Multi-Fournisseurs

> **NemApi** est une passerelle locale unifiée compatible avec le standard OpenAI (`/v1/chat/completions`), permettant d'acheminer en toute transparence les requêtes de vos outils de développement (**Cursor**, **Cline**, **Windsurf**, scripts Python, etc.) vers **7 grands moteurs d'IA** (DeepSeek, Claude, Gemini, ChatGPT, Qwen, Kimi, Z.ai).

---

## 🌟 Architecture du Projet

Le projet est divisé en deux composants complémentaires :

### 1. 🖥️ Interface d'Administration (Frontend React / Vite)
- **Tableau de bord de contrôle** : vue d'ensemble de la passerelle, statistiques de requêtes et de tokens, débit et état des connecteurs.
- **Statut en direct & Ping** : détection automatique de la connectivité locale (`127.0.0.1:8090`) avec affichage de la latence en millisecondes et popover de diagnostic.
- **Gestionnaire de Quotas & Fallbacks (Anti-429)** :
  - Plafonds journaliers personnalisables par modèle.
  - Alertes préventives avec jauges visuelles (seuil configurable, ex. 80%).
  - Bascule automatique (*auto-fallback*) immédiate vers un moteur alternatif en cas de rate-limit ou de panne du fournisseur principal.
- **Playground interactif** : testeur de prompts avec support du streaming en direct, du formatage Markdown et de l'inspection JSON.
- **Gestion des Clés & Licences** : stockage sécurisé local (`localStorage`), activation de licences (Free, Premium Annuel, Lifetime).
- **Journaux d'activité en temps réel** : flux de logs horodatés (info, succès, avertissement, erreur) avec filtre par niveau et export.
- **Intégration Google Sheets** : export et synchronisation optionnelle de la télémétrie d'usage via Apps Script.

### 2. ⚡ Passerelle Locale (Backend Proxy Python)
- **Fichier principal** : `proxy.py` (écoute par défaut sur `http://127.0.0.1:8090`).
- **Standard OpenAI** :
  - `POST /v1/chat/completions` (support complet du streaming Server-Sent Events `text/event-stream` et des réponses brutes).
  - `GET /v1/models` (catalogue des modèles disponibles).
  - `GET /status` (vérification de santé de la passerelle).
  - `GET /stats` (statistiques de consommation).
- **Pont navigateur embarqué** : intégration Chromium avec profil persistant et gestion des sessions Web et tokens d'API.
- **Compatibilité Tool Calling** : formatage et conversion automatique des appels d'outils et de fonctions.

---

## 🚀 Démarrage Rapide

### Prérequis
- **Node.js 18+** et **npm**
- **Python 3.10+** (pour exécuter le proxy localement)

### 1. Lancer l'interface d'administration
```bash
npm install
npm run dev
```
L'interface est accessible sur `http://localhost:3000`.

### 2. Lancer la passerelle locale
```bash
./start.sh
# ou directement :
python3 proxy.py
```
La passerelle écoute sur `http://127.0.0.1:8090`.

---

## 🔌 Configuration dans vos Outils (IDE)

### Cursor / Cline / Windsurf
Configurez votre client OpenAI compatible avec les paramètres suivants :
- **Base URL** : `http://127.0.0.1:8090/v1`
- **API Key** : votre clé NemApi (ex: `nem-admin-local-key` ou toute clé définie dans l'interface)
- **Modèles disponibles** :
  - `deepseek-chat`, `deepseek-reasoner`
  - `claude-3-7-sonnet`, `claude-3-5-sonnet`
  - `gemini-2.5-flash`, `gemini-2.5-pro`
  - `gpt-4o`, `o3-mini`
  - `qwen-2.5-max`, `kimi-k1.5`, `glm-4`

### Exemple cURL
```bash
curl http://127.0.0.1:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nem-admin-local-key" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Bonjour NemApi !"}],
    "stream": true
  }'
```

### Exemple Python
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8090/v1",
    api_key="nem-admin-local-key"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Explique le fonctionnement d'un proxy local."}]
)
print(response.choices[0].message.content)
```

---

## 📁 Structure du Projet

```text
├── index.html                   # Point d'entrée HTML principal
├── metadata.json                # Métadonnées et permissions
├── package.json                 # Dépendances Node & scripts
├── vite.config.ts               # Configuration Vite & mock bridge
├── proxy.py                     # Passerelle locale Python (port 8090)
├── start.sh                     # Script de lancement du proxy
├── src/
│   ├── App.tsx                  # Composant racine & routage des onglets
│   ├── main.tsx                 # Point d'entrée React
│   ├── types.ts                 # Interfaces TypeScript globales
│   ├── data/
│   │   └── providers.ts         # Configuration des 7 fournisseurs et modèles
│   ├── components/
│   │   ├── Navbar.tsx           # Navigation & statut live du proxy
│   │   ├── Dashboard.tsx        # Vue principale & snippets de connexion
│   │   ├── AnalyticsView.tsx    # Métriques, graphiques et consommation
│   │   ├── Playground.tsx       # Console de test de requêtes & streaming
│   │   ├── KeyManager.tsx       # Gestionnaire de clés d'API et proxies
│   │   ├── QuotaManagerModal.tsx# Modale de gestion des quotas et fallbacks
│   │   ├── SubscriptionView.tsx # Forfaits, licences et activation
│   │   ├── LiveLogs.tsx         # Journalisation en direct
│   │   └── IntegrationGuide.tsx # Guides détaillés Cursor, Python, cURL
│   └── lib/
│       └── nemapiBridgePlugin.ts# Plugin Vite interceptant les appels locaux
```

---

## 🔒 Sécurité et Confidentialité
- **Zéro fuite externe** : vos requêtes transitent directement de votre machine vers les fournisseurs d'IA, sans intermédiaire cloud tiers.
- **Stockage local** : toutes les clés et données de session restent confinées dans le stockage local de votre navigateur.
