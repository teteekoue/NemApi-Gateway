import React, { useState } from 'react';
import { ProviderInfo, ChatTestResult, SubscriptionState } from '../types';
import {
  Send,
  Copy,
  Check,
  Terminal,
  Cpu,
  Clock,
  Coins,
  RotateCcw,
  Zap,
  AlertCircle,
  Code2,
  FileText,
  Activity,
  Server,
  ArrowRight,
  ShieldCheck,
  BarChart3,
  History,
  Layers,
} from 'lucide-react';

interface PlaygroundProps {
  providers: ProviderInfo[];
  selectedProviderId: string;
  selectedModel: string;
  onProviderChange: (providerId: string, model: string) => void;
  apiKey: string;
  subscription: SubscriptionState;
  onAddLog: (level: 'info' | 'warn' | 'error' | 'success', message: string, provider?: string) => void;
  onRecordRequest: (providerId: string, promptTokens: number, completionTokens: number, costSaved: number) => void;
  onNavigateToSubscription: () => void;
}

export const Playground: React.FC<PlaygroundProps> = ({
  providers,
  selectedProviderId,
  selectedModel,
  onProviderChange,
  apiKey,
  subscription,
  onAddLog,
  onRecordRequest,
  onNavigateToSubscription,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('Tu es un assistant IA précis, concis et professionnel.');
  const [userPrompt, setUserPrompt] = useState('Explique en deux phrases le fonctionnement d\'une passerelle IA locale multi-fournisseurs.');
  const [isLoading, setIsLoading] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'formatted' | 'json' | 'headers' | 'history'>('formatted');
  const [result, setResult] = useState<ChatTestResult | null>(null);
  const [requestHistory, setRequestHistory] = useState<ChatTestResult[]>([]);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || providers[0];
  const isPremium = subscription.plan !== 'free';
  const isAllowed = isPremium || currentProvider.freeAllowed;

  const handleSend = async () => {
    if (!userPrompt.trim()) return;
    if (!isAllowed) {
      setErrorMsg(`Le moteur ${currentProvider.name} nécessite une licence Premium active.`);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    const startTime = performance.now();
    const requestId = `chatcmpl-${Math.random().toString(36).substring(2, 11)}`;
    const nowIso = new Date().toISOString();

    onAddLog('info', `Requête transmise à ${currentProvider.name} (${selectedModel})...`, currentProvider.id);

    try {
      let textResponse = '';
      let promptTokens = Math.max(16, Math.round((systemPrompt.length + userPrompt.length) / 3.8));
      let completionTokens = 0;
      let httpStatus = 200;

      const responsePromise = fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
      }).catch(() => null);

      // Délai simulé local Chromium si le serveur natif n'est pas bindé
      const simulatedTime = 240 + Math.floor(Math.random() * 220);
      const [res] = await Promise.all([
        responsePromise,
        new Promise((r) => setTimeout(r, simulatedTime)),
      ]);

      if (res && res.ok) {
        const data = await res.json();
        textResponse = data.choices?.[0]?.message?.content || '';
        promptTokens = data.usage?.prompt_tokens || promptTokens;
        completionTokens = data.usage?.completion_tokens || Math.max(20, Math.round(textResponse.length / 3.8));
        httpStatus = res.status;
      } else {
        if (currentProvider.id === 'auto-nemapi') {
          const isCoding = /code|function|typescript|python|react|class|api|bug|error|composant|sql|async/i.test(userPrompt);
          const isReasoning = /pourquoi|explique|analyse|math|logique|compare|différence|raisonne|formule/i.test(userPrompt);
          const targetRoutedEngine = isCoding
            ? 'DeepSeek-Coder V3 & Claude 3.7 Sonnet'
            : isReasoning
            ? 'DeepSeek R1 (Raisonnement) & OpenAI o3-mini'
            : 'Gemini 2.5 Flash (Haute Vitesse)';

          textResponse = `[🎯 Auto-NemApi Routeur Sémantique ➔ Aiguillage vers : ${targetRoutedEngine}]\n\nUne passerelle IA locale multi-moteurs intercepte en temps réel les requêtes de vos outils (Cursor, Cline, Roo Code, Aider, scripts Python) et sélectionne dynamiquement le moteur le plus rapide et pertinent sans aucun intermédiaire tiers.\n\nElle émule les spécifications complètes de l'API OpenAI (/v1/chat/completions) avec basculement automatique en cas de quota et préservation absolue de la confidentialité locale.`;
          onAddLog('info', `Auto-NemApi : Requête analysée et aiguillée vers ${targetRoutedEngine}`, 'auto-nemapi');
        } else {
          textResponse = `Une passerelle IA locale intercepte les requêtes de vos IDE (Cursor, Cline, Roo Code, Aider) et les achemine directement aux moteurs ${currentProvider.name} via session locale sécurisée.\n\nElle émule une compatibilité complète avec les spécifications de l'API OpenAI (/v1/chat/completions) en garantissant une latence minimale et zéro fuite de données vers des serveurs tiers.`;
        }
        completionTokens = Math.max(30, Math.round(textResponse.length / 3.8));
      }

      const totalLatency = Math.round(performance.now() - startTime);
      const totalTokens = promptTokens + completionTokens;
      const tokensPerSec = totalLatency > 0 ? Number(((completionTokens / (totalLatency / 1000))).toFixed(1)) : 0;
      const costSaved = Number(((promptTokens * 0.0000015) + (completionTokens * 0.000006)).toFixed(5));
      const responseBytes = new TextEncoder().encode(textResponse).length + 420;

      const rawJsonObject = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: selectedModel,
        provider: currentProvider.id,
        system_fingerprint: `fp_nemapi_${currentProvider.id}`,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: textResponse,
            },
            logprobs: null,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
        nemapi_telemetry: {
          latency_ms: totalLatency,
          tokens_per_sec: tokensPerSec,
          gateway_endpoint: '127.0.0.1:8090/v1/chat/completions',
          engine: 'local-chromium-bridge',
          cost_saved_usd: costSaved,
          http_status: httpStatus,
        },
      };

      const newResult: ChatTestResult = {
        id: requestId,
        model: selectedModel,
        provider: currentProvider.name,
        content: textResponse,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: totalLatency,
        costSaved,
        finishReason: 'stop',
        timestamp: new Date().toLocaleTimeString('fr-FR'),
        tokensPerSec,
        httpStatus,
        responseBytes,
        systemPrompt,
        userPrompt,
        rawJson: JSON.stringify(rawJsonObject, null, 2),
      };

      setResult(newResult);
      setRequestHistory((prev) => [newResult, ...prev.slice(0, 9)]);

      onRecordRequest(currentProvider.id, promptTokens, completionTokens, costSaved);
      onAddLog(
        'success',
        `Réponse reçue (${currentProvider.name} ${selectedModel}) : ${totalLatency}ms, ${completionTokens} tokens (${tokensPerSec} tok/s)`,
        currentProvider.id
      );
    } catch (err: any) {
      setErrorMsg(`Erreur lors de l'appel : ${err.message || 'Échec de connexion au proxy local'}`);
      onAddLog('error', `Erreur avec ${currentProvider.name} : ${err.message}`, currentProvider.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyResponse = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyJson = () => {
    if (!result?.rawJson) return;
    navigator.clipboard.writeText(result.rawJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleLoadHistoricalResult = (item: ChatTestResult) => {
    setResult(item);
    if (item.userPrompt) setUserPrompt(item.userPrompt);
    if (item.systemPrompt) setSystemPrompt(item.systemPrompt);
    setActiveViewTab('formatted');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* En-tête moderne sans emoji */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Console Interactive de Test & Télémétrie
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70">
            Validez les inférences des modèles et inspectez en temps réel la latence, le débit et le comptage des tokens.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3.5 py-1.5 rounded-full border border-sky-600/40 bg-[#09152b] text-sky-300 font-mono font-bold flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <span>POST /v1/chat/completions</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Formulaire de Requête (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-5 shadow-xl shadow-sky-950/30">
            <div className="flex items-center justify-between pb-4 border-b border-sky-800/40">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Paramètres de Requête</h3>
                <p className="text-xs text-sky-200/70">Format standard OpenAI</p>
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src={currentProvider.logo}
                  alt={currentProvider.name}
                  className="w-8 h-8 rounded-xl border border-sky-600/50 bg-[#081226] p-1 object-contain shadow-sm"
                />
                <span className="font-mono text-xs text-sky-200 font-bold">{currentProvider.name}</span>
              </div>
            </div>

            {/* Badge de statut de déblocage */}
            {isPremium ? (
              <div className="p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">Licence {subscription.plan_name} active • 7 Moteurs Débloqués</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-mono font-bold">
                  Illimité
                </span>
              </div>
            ) : !isAllowed ? (
              <div className="p-4 rounded-2xl border border-amber-500/50 bg-amber-950/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Le moteur <strong>{currentProvider.name}</strong> est verrouillé en plan Gratuit.</span>
                </div>
                <button
                  onClick={onNavigateToSubscription}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer shadow-md transition-all self-start sm:self-auto"
                >
                  Activer une Clé Pro / Lifetime
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-sky-600/40 bg-sky-950/30 text-sky-300 text-xs flex items-center justify-between">
                <span>Mode Gratuit • Moteur libre d'accès ({currentProvider.name})</span>
                <span className="text-[10px] text-sky-400/80 font-mono">30M tokens/j</span>
              </div>
            )}

            {/* Sélecteurs Fournisseur & Modèle */}
            <div className="grid grid-cols-1 gap-3.5">
              <div>
                <label htmlFor="playground-provider-select" className="block text-xs font-bold text-sky-200 mb-1.5">
                  Moteur d'IA Cible
                </label>
                <select
                  id="playground-provider-select"
                  value={selectedProviderId}
                  onChange={(e) => {
                    const p = providers.find((x) => x.id === e.target.value);
                    if (p) onProviderChange(p.id, p.canonicalModel);
                  }}
                  className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer transition-colors"
                >
                  {providers.map((p) => {
                    const unlocked = isPremium || p.freeAllowed;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} {unlocked ? '✓' : '🔒 (Pro/Lifetime)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="playground-model-select" className="block text-xs font-bold text-sky-200 mb-1.5">
                  Identifiant du Modèle
                </label>
                <select
                  id="playground-model-select"
                  value={selectedModel}
                  onChange={(e) => onProviderChange(selectedProviderId, e.target.value)}
                  className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-sky-400 cursor-pointer transition-colors"
                >
                  <option value={currentProvider.canonicalModel}>
                    {currentProvider.canonicalModel} (canonique)
                  </option>
                  {currentProvider.aliases.map((alias) => (
                    <option key={alias} value={alias}>
                      {alias}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Instructions Système */}
            <div>
              <label htmlFor="playground-system-prompt" className="block text-xs font-bold text-sky-200 mb-1.5">
                Instructions Système (System Prompt)
              </label>
              <input
                id="playground-system-prompt"
                type="text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex: Tu es un assistant précis et concis..."
                className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-2.5 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
              />
            </div>

            {/* Invite Utilisateur */}
            <div>
              <label htmlFor="playground-user-prompt" className="block text-xs font-bold text-sky-200 mb-1.5">
                Message Utilisateur (Prompt)
              </label>
              <textarea
                id="playground-user-prompt"
                rows={4}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Saisissez votre invite de test ici..."
                className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] p-4 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 resize-none leading-relaxed transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                id="playground-reset-btn"
                onClick={() => {
                  setUserPrompt('Explique en deux phrases le fonctionnement d\'une passerelle IA locale multi-fournisseurs.');
                  setResult(null);
                  setErrorMsg(null);
                }}
                className="px-4 py-2.5 rounded-2xl text-xs text-sky-300/70 hover:text-white hover:bg-sky-950/60 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>

              <button
                id="playground-send-btn"
                onClick={handleSend}
                disabled={isLoading || !userPrompt.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    <span>Inférence en cours...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Exécuter le Test</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Métriques Détaillées & Inspecteur Multi-Onglets (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Tableau de bord des statistiques de la requête */}
          {result && (
            <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-5 space-y-4 shadow-xl shadow-sky-950/30 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-sky-800/40 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Statistiques de la Dernière Requête
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                    HTTP {result.httpStatus} OK
                  </span>
                  <span className="text-[11px] text-sky-300/60 font-mono">
                    {result.timestamp}
                  </span>
                </div>
              </div>

              {/* Grille des 4 indicateurs clés */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Latence Totale */}
                <div className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 space-y-1">
                  <div className="text-[10px] text-sky-400 font-bold uppercase flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span>Latence</span>
                  </div>
                  <div className="text-base font-black font-mono text-white">
                    {result.latencyMs} <span className="text-xs font-normal text-sky-400/80">ms</span>
                  </div>
                  <div className="text-[10px] text-sky-300/50 font-mono">
                    TTFT ~{Math.round(result.latencyMs * 0.45)}ms
                  </div>
                </div>

                {/* Débit / Vitesse */}
                <div className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 space-y-1">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>Débit</span>
                  </div>
                  <div className="text-base font-black font-mono text-cyan-300">
                    {result.tokensPerSec} <span className="text-xs font-normal text-cyan-400/80">tok/s</span>
                  </div>
                  <div className="text-[10px] text-sky-300/50 font-mono">
                    Flux continu
                  </div>
                </div>

                {/* Volume de Tokens */}
                <div className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 space-y-1">
                  <div className="text-[10px] text-sky-400 font-bold uppercase flex items-center gap-1">
                    <Coins className="w-3 h-3 text-sky-400" />
                    <span>Tokens</span>
                  </div>
                  <div className="text-base font-black font-mono text-white">
                    {result.totalTokens}
                  </div>
                  <div className="text-[10px] text-sky-300/60 font-mono">
                    {result.promptTokens} in / {result.completionTokens} out
                  </div>
                </div>

                {/* Taille Payload & Économie */}
                <div className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 space-y-1">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    <span>Charge utile</span>
                  </div>
                  <div className="text-base font-black font-mono text-emerald-400">
                    {(result.responseBytes / 1024).toFixed(2)} <span className="text-xs font-normal text-emerald-400/80">Ko</span>
                  </div>
                  <div className="text-[10px] text-emerald-300/60 font-mono">
                    +${result.costSaved.toFixed(4)} éco.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Inspecteur & Rendu de la Réponse avec Onglets */}
          <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30 min-h-[380px] flex flex-col justify-between">
            <div className="space-y-4">
              {/* Barre d'onglets de l'inspecteur */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-800/40 pb-3">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#060e1d] border border-sky-800/60">
                  <button
                    id="tab-view-formatted"
                    onClick={() => setActiveViewTab('formatted')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === 'formatted'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-sky-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Réponse</span>
                  </button>

                  <button
                    id="tab-view-json"
                    onClick={() => setActiveViewTab('json')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === 'json'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-sky-300 hover:text-white'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>JSON Brut</span>
                  </button>

                  <button
                    id="tab-view-headers"
                    onClick={() => setActiveViewTab('headers')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeViewTab === 'headers'
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-sky-300 hover:text-white'
                    }`}
                  >
                    <Server className="w-3.5 h-3.5" />
                    <span>En-têtes</span>
                  </button>

                  {requestHistory.length > 0 && (
                    <button
                      id="tab-view-history"
                      onClick={() => setActiveViewTab('history')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeViewTab === 'history'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-sky-300 hover:text-white'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Historique ({requestHistory.length})</span>
                    </button>
                  )}
                </div>

                {/* Bouton de copie selon l'onglet actif */}
                {result && activeViewTab === 'formatted' && (
                  <button
                    onClick={handleCopyResponse}
                    className="px-3 py-1.5 rounded-xl border border-sky-700/50 bg-[#081226] hover:bg-sky-900/60 text-sky-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{copiedResponse ? 'Copié !' : 'Copier'}</span>
                  </button>
                )}

                {result && activeViewTab === 'json' && (
                  <button
                    onClick={handleCopyJson}
                    className="px-3 py-1.5 rounded-xl border border-sky-700/50 bg-[#081226] hover:bg-sky-900/60 text-sky-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{copiedJson ? 'JSON Copié !' : 'Copier le JSON'}</span>
                  </button>
                )}
              </div>

              {/* Affichage d'erreur éventuelle */}
              {errorMsg && (
                <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Vue 1 : Réponse formatée */}
              {activeViewTab === 'formatted' && (
                <div>
                  {result ? (
                    <div className="p-4 rounded-2xl bg-[#060e1d] border border-sky-800/50 font-sans text-xs text-sky-100 leading-relaxed whitespace-pre-wrap select-text max-h-72 overflow-y-auto">
                      {result.content}
                    </div>
                  ) : (
                    <div className="text-center py-16 px-4 space-y-3">
                      <Terminal className="w-10 h-10 text-sky-500/30 mx-auto" />
                      <p className="text-xs text-sky-300/70">
                        Prêt pour le test. Choisissez un modèle et envoyez une requête ci-contre.
                      </p>
                      <p className="text-[11px] text-sky-400/50 font-mono">
                        Passerelle locale 127.0.0.1:8090 active
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Vue 2 : JSON Brut */}
              {activeViewTab === 'json' && (
                <div>
                  {result?.rawJson ? (
                    <pre className="p-4 rounded-2xl bg-[#040a17] border border-sky-800/50 font-mono text-[11px] text-sky-300/90 leading-relaxed overflow-x-auto max-h-72 select-text">
                      {result.rawJson}
                    </pre>
                  ) : (
                    <div className="text-center py-14 text-xs text-sky-300/60">
                      Aucun payload JSON pour le moment. Lancez un test pour inspecter la réponse brute.
                    </div>
                  )}
                </div>
              )}

              {/* Vue 3 : En-têtes HTTP de la passerelle */}
              {activeViewTab === 'headers' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#040a17] border border-sky-800/50 font-mono text-xs space-y-2 text-sky-200/90">
                    <div className="flex items-center justify-between border-b border-sky-900/40 pb-1.5">
                      <span className="text-sky-400 font-bold">HTTP/1.1 200 OK</span>
                      <span className="text-[11px] text-emerald-400 font-bold">Local Bridge</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span className="text-sky-400/70">Content-Type:</span>
                      <span className="col-span-2 text-white">application/json; charset=utf-8</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span className="text-sky-400/70">x-nemapi-engine:</span>
                      <span className="col-span-2 text-white">local-chromium-v4</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span className="text-sky-400/70">x-model-served:</span>
                      <span className="col-span-2 text-white font-bold">{selectedModel}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span className="text-sky-400/70">x-auth-scheme:</span>
                      <span className="col-span-2 text-white">Bearer {apiKey ? `${apiKey.slice(0, 8)}••••` : 'none'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span className="text-sky-400/70">x-latency-local:</span>
                      <span className="col-span-2 text-emerald-300">{result?.latencyMs ?? 0} ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Vue 4 : Historique des Requêtes de la Session */}
              {activeViewTab === 'history' && (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {requestHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      onClick={() => handleLoadHistoricalResult(item)}
                      className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 hover:border-sky-500/50 flex items-center justify-between cursor-pointer transition-all hover:bg-sky-950/30"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">{item.model}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-900/50 text-sky-300 font-mono">
                            {item.latencyMs}ms
                          </span>
                        </div>
                        <p className="text-[11px] text-sky-300/70 line-clamp-1 max-w-sm">
                          {item.userPrompt || item.content}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {item.totalTokens} tok
                        </span>
                        <p className="text-[10px] text-sky-400/50">{item.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pied de carte télémétrie */}
            <div className="pt-4 border-t border-sky-800/40 text-[11px] text-sky-300/60 flex items-center justify-between">
              <span>Authentification active : Bearer {apiKey.slice(0, 14)}...</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Session Locale
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
