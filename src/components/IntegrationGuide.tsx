import React, { useState } from 'react';

interface IntegrationGuideProps {
  apiKey: string;
  baseUrl: string;
}

export const IntegrationGuide: React.FC<IntegrationGuideProps> = ({
  apiKey,
  baseUrl = 'http://127.0.0.1:8090/v1',
}) => {
  const [selectedClient, setSelectedClient] = useState<'cline' | 'cursor' | 'aider' | 'python' | 'curl' | 'continue'>('cline');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const configs = {
    cline: {
      name: 'Cline / Roo-Code (VS Code)',
      description: 'Configuration directe pour l\'extension de code autonome',
      filename: 'cline_custom_models.json',
      code: `{
  "apiProvider": "openai-compatible",
  "openAiBaseUrl": "${baseUrl}",
  "openAiApiKey": "${apiKey}",
  "openAiModelId": "deepseek-chat"
}`,
    },
    cursor: {
      name: 'Cursor AI',
      description: 'Paramètres > Models > OpenAI API Key & Override Base URL',
      filename: 'Cursor Configuration',
      code: `Base URL : ${baseUrl}
API Key  : ${apiKey}

Modèles supportés :
- auto-nemapi (Routeur Intelligent Automatique)
- deepseek-chat (DeepSeek V3 & R1)
- qwen-plus (Qwen 2.5 Coder)
- claude-3-7-sonnet (Claude 3.7 Sonnet)
- gpt-4o (ChatGPT GPT-4o)
- gemini-2.5-flash (Google Gemini)
- kimi-k2 (Moonshot Kimi)
- glm-5 (Z.ai GLM-5)`,
    },
    aider: {
      name: 'Aider (CLI Terminal)',
      description: 'Variables d\'environnement pour l\'assistant en ligne de commande',
      filename: 'terminal.sh',
      code: `export OPENAI_API_BASE="${baseUrl}"
export OPENAI_API_KEY="${apiKey}"

# Lancer Aider avec DeepSeek
aider --model openai/deepseek-chat

# Ou lancer avec Claude 3.7 Sonnet
aider --model openai/claude-3-7-sonnet`,
    },
    python: {
      name: 'Python (SDK OpenAI)',
      description: 'Utilisation standard avec la bibliothèque officielle openai',
      filename: 'client.py',
      code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}"
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": "Tu es un assistant IA professionnel."},
        {"role": "user", "content": "Rédige une fonction d'analyse de données en Python."}
    ],
    temperature=0.7
)

print(response.choices[0].message.content)`,
    },
    curl: {
      name: 'cURL / Script Shell',
      description: 'Requête HTTP POST directe au format OpenAI',
      filename: 'request.sh',
      code: `curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "Test de connexion NemApi Gateway."}
    ]
  }'`,
    },
    continue: {
      name: 'Continue.dev',
      description: 'Configuration dans ~/.continue/config.json',
      filename: 'config.json',
      code: `{
  "models": [
    {
      "title": "NemApi DeepSeek",
      "provider": "openai",
      "model": "deepseek-chat",
      "apiBase": "${baseUrl}",
      "apiKey": "${apiKey}"
    },
    {
      "title": "NemApi Claude Sonnet",
      "provider": "openai",
      "model": "claude-3-7-sonnet",
      "apiBase": "${baseUrl}",
      "apiKey": "${apiKey}"
    }
  ]
}`,
    },
  };

  const currentConfig = configs[selectedClient];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentConfig.code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight">Guides d'Intégration Client</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Paramétrez vos IDE et outils de développement pour router leurs requêtes vers la passerelle NemApi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Sélection du Client */}
        <div className="lg:col-span-4 space-y-2">
          {(Object.keys(configs) as Array<keyof typeof configs>).map((key) => {
            const item = configs[key];
            const isSelected = selectedClient === key;
            return (
              <button
                key={key}
                id={`client-selector-${key}`}
                onClick={() => setSelectedClient(key)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <div>
                  <div className="font-semibold text-xs text-white">{item.name}</div>
                  <div className="text-[11px] text-zinc-400 truncate max-w-[220px] mt-0.5">
                    {item.description}
                  </div>
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* Colonne Extrait de Code */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-300">{currentConfig.filename}</span>

            <button
              id="copy-snippet-btn"
              onClick={handleCopy}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {copiedSnippet ? 'Copié dans le presse-papier' : 'Copier l\'extrait'}
            </button>
          </div>

          <div className="p-4 flex-1 bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-200 overflow-x-auto select-text">
            <pre className="whitespace-pre">{currentConfig.code}</pre>
          </div>

          <div className="p-3 bg-zinc-900/60 border-t border-zinc-800 text-xs text-zinc-400">
            La passerelle NemApi implémente fidèlement les standards de l'API OpenAI (streaming SSE, appels d'outils, format de complétion).
          </div>
        </div>
      </div>
    </div>
  );
};
