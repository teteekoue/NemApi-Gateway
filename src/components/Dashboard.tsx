import React, { useState } from 'react';
import { ProviderInfo, SubscriptionState, UsageStats, UserAccount } from '../types';
import {
  Copy,
  Check,
  Zap,
  Activity,
  ShieldCheck,
  ExternalLink,
  Terminal,
  Layers,
  ArrowUpRight,
  Laptop,
  ShieldAlert,
} from 'lucide-react';

interface DashboardProps {
  providers: ProviderInfo[];
  subscription: SubscriptionState;
  account?: UserAccount;
  stats: UsageStats;
  proxyConnected: boolean;
  apiKeysEnabled: boolean;
  activeKey: string;
  onSelectProviderForTest: (providerId: string, model: string) => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenQuotaModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  providers,
  subscription,
  account,
  stats,
  proxyConnected,
  apiKeysEnabled,
  activeKey,
  onSelectProviderForTest,
  onNavigateToTab,
  onOpenQuotaModal,
}) => {
  const [selectedSnippetTab, setSelectedSnippetTab] = useState<'cursor' | 'cline' | 'python' | 'curl'>('cursor');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  const isPremium = subscription.plan !== 'free';
  const freeTokenLimit = 30_000_000;
  const currentTokensUsed = stats.prompt_tokens + stats.completion_tokens;
  const tokenPercentage = isPremium
    ? 100
    : Math.min(100, Math.round((currentTokensUsed / freeTokenLimit) * 100));

  const baseUrl = 'http://127.0.0.1:8090/v1';

  const snippets = {
    cursor: `Base URL: ${baseUrl}\nAPI Key:  ${apiKeysEnabled ? (activeKey || 'nemapi-token...') : 'Optionnel (mode sans clé actif)'}\nModèle :  deepseek-chat ou claude-3-7-sonnet ou gpt-4o`,
    cline: `{\n  "apiProvider": "openai-compatible",\n  "openAiBaseUrl": "${baseUrl}",\n  "openAiApiKey": "${apiKeysEnabled ? (activeKey || 'nemapi-token...') : 'nemapi-token-direct'}",\n  "openAiModelId": "deepseek-chat"\n}`,
    python: `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}",\n    api_key="${apiKeysEnabled ? (activeKey || 'nemapi-token...') : 'direct'}"\n)\nresponse = client.chat.completions.create(\n    model="deepseek-chat",\n    messages=[{"role": "user", "content": "Bonjour !"}]\n)\nprint(response.choices[0].message.content)`,
    curl: `curl -X POST "${baseUrl}/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${apiKeysEnabled ? (activeKey || 'nemapi-token...') : 'direct'}" \\\n  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Bonjour"}]}'`,
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippets[selectedSnippetTab]);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleCopyBaseUrl = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopiedBaseUrl(true);
    setTimeout(() => setCopiedBaseUrl(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* 1. Carte Héro de Statut Global & Connectivité */}
      <div className="relative rounded-3xl border border-sky-600/30 bg-gradient-to-br from-[#0e1d3d]/90 via-[#0a152d]/85 to-[#060e1d]/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl shadow-sky-950/50 overflow-hidden">
        {/* Lueur subtile en arrière-plan */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="relative flex h-3.5 w-3.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    proxyConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                    proxyConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                NemApi Local Bridge
              </h2>
              <span className="text-xs px-3 py-1 rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-300 font-mono font-bold">
                127.0.0.1:8090
              </span>
              {account?.name && (
                <span className="text-xs text-sky-200/70 hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-950/60 border border-sky-800/40">
                  <Laptop className="w-3 h-3 text-sky-400" />
                  <span>Session :</span>
                  <strong className="text-white font-bold">{account.name}</strong>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-sky-200/70 leading-relaxed max-w-3xl font-normal">
              Routage local compatible OpenAI avec session Chromium haute vitesse. Aucune télémétrie distante, vos requêtes et clés ne quittent jamais votre machine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Quotas & Fallbacks */}
            {onOpenQuotaModal && (
              <button
                onClick={onOpenQuotaModal}
                className="px-4 py-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-sm hover:-translate-y-0.5"
                title="Gérer les quotas journaliers et fallbacks par modèle"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="font-bold">Quotas & Fallback</span>
              </button>
            )}

            {/* Mode Auth */}
            <button
              onClick={() => onNavigateToTab('keys')}
              className="px-4 py-2 rounded-2xl border border-sky-700/50 bg-[#09152b] hover:bg-sky-900/60 hover:border-sky-500/50 text-sky-200 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-sm hover:-translate-y-0.5"
            >
              <span className="text-sky-400/80 font-medium">Auth :</span>
              <span className="font-bold text-white">
                {apiKeysEnabled ? 'Protection Clé Active' : 'Mode Sans Clé'}
              </span>
            </button>

            {/* Plan Licence */}
            <button
              onClick={() => onNavigateToTab('account')}
              className={`px-4 py-2 rounded-2xl border transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md hover:-translate-y-0.5 ${
                isPremium
                  ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/20 to-amber-500/10 text-amber-300 hover:border-amber-400'
                  : 'border-sky-700/50 bg-[#09152b] text-sky-200 hover:border-sky-500/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-sky-300/80">Plan :</span>
              <span className="font-bold text-white">{subscription.plan_name}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Cartes Métriques Clés (KPIs) bien arrondies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Requêtes */}
        <div className="rounded-3xl border border-sky-700/30 bg-[#0c1833]/80 backdrop-blur-md p-5 space-y-2.5 shadow-lg shadow-sky-950/25 hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
            <span>Requêtes Traitées</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {stats.requests.toLocaleString()}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              100% Succès
            </span>
          </div>
          <div className="text-[11px] text-sky-300/60">
            Acheminées sans friction aux moteurs IA
          </div>
        </div>

        {/* Volume de Tokens */}
        <div className="rounded-3xl border border-sky-700/30 bg-[#0c1833]/80 backdrop-blur-md p-5 space-y-2.5 shadow-lg shadow-sky-950/25 hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
            <span>Volume de Tokens</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {((stats.prompt_tokens + stats.completion_tokens) / 1000).toFixed(1)}k
            </span>
            <span className="text-xs font-semibold text-sky-300/80">In + Out</span>
          </div>
          <div className="text-[11px] text-sky-300/60">
            {stats.prompt_tokens.toLocaleString()} in / {stats.completion_tokens.toLocaleString()} out
          </div>
        </div>

        {/* Économies Réalisées */}
        <div className="rounded-3xl border border-sky-700/30 bg-[#0c1833]/80 backdrop-blur-md p-5 space-y-2.5 shadow-lg shadow-sky-950/25 hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
            <span>Économies Estimées</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
              ${stats.estimated_cost.toFixed(3)}
            </span>
            <span className="text-xs font-medium text-sky-300/80">Équiv. API</span>
          </div>
          <div className="text-[11px] text-sky-300/60">
            Économisées par rapport aux API officielles
          </div>
        </div>

        {/* Moteurs Opérationnels */}
        <div className="rounded-3xl border border-sky-700/30 bg-[#0c1833]/80 backdrop-blur-md p-5 space-y-2.5 shadow-lg shadow-sky-950/25 hover:border-sky-500/40 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs text-sky-300 font-semibold">
            <span>Moteurs Débloqués</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black font-mono text-white tracking-tight">
              {isPremium ? '8 / 8' : '3 / 8'}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                isPremium
                  ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                  : 'bg-sky-500/15 text-sky-300 border-sky-400/30'
              }`}
            >
              {isPremium ? 'Illimité' : 'Gratuit'}
            </span>
          </div>
          <div className="text-[11px] text-sky-300/60">
            {isPremium ? 'Tous les 8 moteurs prêts' : 'Auto, DeepSeek & Gemini inclus'}
          </div>
        </div>
      </div>

      {/* 3. Jauge de Quota Journalier bien arrondie */}
      <div className="rounded-3xl border border-sky-800/40 bg-[#0b1731]/80 backdrop-blur-md p-5 sm:p-6 space-y-3 shadow-lg shadow-sky-950/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Quota Quotidien de Tokens</span>
            <span className="text-sky-300/70 font-mono">
              {isPremium
                ? 'Illimité (Licence active rattachée)'
                : `${currentTokensUsed.toLocaleString()} / ${freeTokenLimit.toLocaleString()} tokens`}
            </span>
          </div>
          {!isPremium && (
            <button
              onClick={() => onNavigateToTab('account')}
              className="text-sky-400 hover:text-sky-300 font-bold underline underline-offset-2 cursor-pointer self-start sm:self-auto"
            >
              Associer une licence illimitée →
            </button>
          )}
        </div>

        <div className="w-full bg-[#060e1d] rounded-full h-3.5 overflow-hidden border border-sky-800/60 p-0.5">
          <div
            className={`h-full transition-all duration-700 rounded-full ${
              isPremium
                ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 w-full animate-pulse'
                : 'bg-gradient-to-r from-sky-500 to-cyan-400'
            }`}
            style={{ width: `${isPremium ? 100 : Math.max(3, tokenPercentage)}%` }}
          />
        </div>
      </div>

      {/* 4. Section Connexion Rapide des Outils (Cursor, Cline, Python, cURL) */}
      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-xl shadow-sky-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-800/40 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Intégration Directe IDE & Outils Développeurs
              </h3>
            </div>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Utilisez la passerelle locale exactement comme l'API officielle OpenAI dans Cursor, Cline, Roo ou vos scripts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-sky-300/80 font-mono font-semibold">Base URL :</span>
            <button
              onClick={handleCopyBaseUrl}
              className="px-3.5 py-2 rounded-2xl border border-sky-600/50 bg-[#081226] hover:bg-sky-900/50 text-xs font-mono text-sky-200 transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:border-sky-400"
            >
              <span>{baseUrl}</span>
              {copiedBaseUrl ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-sky-400" />
              )}
            </button>
          </div>
        </div>

        {/* Onglets d'outils bien arrondis */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-[#071124] p-1.5 rounded-2xl border border-sky-800/60">
            {(['cursor', 'cline', 'python', 'curl'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedSnippetTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSnippetTab === tab
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25'
                    : 'text-sky-200/70 hover:text-white hover:bg-sky-900/30'
                }`}
              >
                {tab === 'cursor' ? 'Cursor AI' : tab === 'cline' ? 'Cline / VS Code' : tab === 'python' ? 'Python' : 'cURL'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopySnippet}
            className="px-4 py-2 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Configuration copiée !</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Copier le snippet</span>
              </>
            )}
          </button>
        </div>

        {/* Affichage du code avec police JetBrains Mono */}
        <div className="p-4 sm:p-5 bg-[#060e1d] rounded-2xl border border-sky-800/60 font-mono text-xs text-sky-100 overflow-x-auto select-text shadow-inner">
          <pre className="whitespace-pre font-mono">{snippets[selectedSnippetTab]}</pre>
        </div>
      </div>

      {/* 5. Grille Complète des 8 Moteurs IA */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-800/40 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Moteurs d'IA Intégrés ({providers.length})
            </h3>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Chaque moteur dispose d'un adaptateur natif optimisé via session Chromium locale.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-sky-300 bg-sky-950/80 px-3 py-1.5 rounded-full border border-sky-700/50 font-bold">
              {isPremium
                ? `${providers.length} débloqués en illimité`
                : `${providers.filter((p) => p.freeAllowed).length} inclus en accès libre`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {providers.map((p) => {
            const isAllowed = isPremium || p.freeAllowed;
            const pStats = stats.providers[p.id] || { requests: 0, prompt_tokens: 0, completion_tokens: 0 };

            return (
              <div
                key={p.id}
                id={`dashboard-provider-${p.id}`}
                className={`rounded-3xl border p-5 sm:p-6 flex flex-col justify-between transition-all duration-250 ${
                  isAllowed
                    ? 'border-sky-700/40 bg-[#0c1833]/85 hover:border-sky-400/60 hover:-translate-y-1 shadow-xl shadow-sky-950/30'
                    : 'border-sky-900/40 bg-[#081226]/70 opacity-80'
                }`}
              >
                <div>
                  {/* En-tête avec vrai logo officiel PNG */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.logo}
                        alt={`${p.name} Logo`}
                        className="w-11 h-11 rounded-2xl border border-sky-600/50 bg-[#081328] p-1.5 object-contain shadow-md"
                      />
                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {p.name}
                        </h4>
                        <div className="font-mono text-xs text-sky-300/80">
                          {p.canonicalModel}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isAllowed
                          ? p.freeAllowed
                            ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                            : 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                          : 'border-sky-800/40 bg-sky-950/60 text-sky-300/60'
                      }`}
                    >
                      {isAllowed ? (p.freeAllowed ? 'Gratuit' : 'Premium') : 'Licence Requise'}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-sky-200/70 mb-3.5 leading-relaxed">
                    {p.description}
                  </p>

                  {/* Modèles & Alias */}
                  <div className="mb-3.5">
                    <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1.5">
                      Alias supportés :
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.aliases.slice(0, 3).map((a) => (
                        <span
                          key={a}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#060e1d] text-sky-200 border border-sky-800/50"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Statistiques d'usage par moteur */}
                  <div className="p-3 rounded-2xl bg-[#060e1d] border border-sky-800/50 text-[11px] text-sky-300/80 mb-4 flex items-center justify-between font-mono">
                    <span>{pStats.requests} req</span>
                    <span>{((pStats.prompt_tokens + pStats.completion_tokens) / 1000).toFixed(1)}k tok</span>
                    <span className="text-emerald-400 font-bold">${(pStats.cost || 0).toFixed(4)}</span>
                  </div>
                </div>

                {/* Boutons d'action bien arrondis */}
                <div className="pt-3.5 border-t border-sky-800/40 flex items-center justify-between gap-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-xl bg-[#081226] hover:bg-sky-900/50 text-sky-200 border border-sky-700/50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Portail</span>
                    <ExternalLink className="w-3 h-3 text-sky-400" />
                  </a>

                  {isAllowed ? (
                    <button
                      id={`dash-test-${p.id}`}
                      onClick={() => onSelectProviderForTest(p.id, p.canonicalModel)}
                      className="text-xs px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold transition-all shadow-md shadow-sky-500/20 cursor-pointer flex items-center gap-1.5 hover:-translate-y-0.5"
                    >
                      <Terminal className="w-3.5 h-3.5 text-slate-950" />
                      <span>Tester dans la Console</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onNavigateToTab('account')}
                      className="text-xs px-3.5 py-1.5 rounded-2xl border border-amber-400/50 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 font-bold transition-colors cursor-pointer"
                    >
                      Débloquer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
