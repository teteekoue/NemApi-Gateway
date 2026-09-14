import React, { useState } from 'react';
import { ModelQuotaConfig, ProviderInfo, UsageStats, SubscriptionState } from '../types';
import {
  ShieldAlert,
  Sliders,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRightLeft,
  Info,
  Lock,
  RotateCcw,
  BellRing,
} from 'lucide-react';

interface QuotaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotas: Record<string, ModelQuotaConfig>;
  onSaveQuotas: (updated: Record<string, ModelQuotaConfig>) => void;
  providers: ProviderInfo[];
  stats: UsageStats;
  subscription: SubscriptionState;
  onAddLog: (level: 'info' | 'warn' | 'error' | 'success', message: string, provider?: string) => void;
}

export const QuotaManagerModal: React.FC<QuotaManagerModalProps> = ({
  isOpen,
  onClose,
  quotas,
  onSaveQuotas,
  providers,
  stats,
  subscription,
  onAddLog,
}) => {
  const [localQuotas, setLocalQuotas] = useState<Record<string, ModelQuotaConfig>>(quotas);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('deepseek-chat');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const isPremium = subscription.plan !== 'free';

  // Liste plate des modèles configurables
  const allModelsList = providers.flatMap((p) =>
    p.models.map((m) => ({
      modelId: m,
      providerId: p.id,
      providerName: p.name,
      freeAllowed: p.freeAllowed,
    }))
  );

  const activeConfig: ModelQuotaConfig = localQuotas[selectedModelKey] || {
    modelId: selectedModelKey,
    providerId: allModelsList.find((m) => m.modelId === selectedModelKey)?.providerId || 'deepseek',
    dailyLimitTokens: 500_000,
    warnThresholdPercent: 80,
    fallbackModelId: 'gemini-2.5-flash',
    fallbackProviderId: 'gemini',
    autoFallbackEnabled: true,
    rateLimitPerMinute: 60,
  };

  const handleUpdateActiveConfig = (field: keyof ModelQuotaConfig, value: any) => {
    setLocalQuotas((prev) => ({
      ...prev,
      [selectedModelKey]: {
        ...activeConfig,
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSaveQuotas(localQuotas);
    setSavedSuccess(true);
    onAddLog('success', `Règles de quotas & fallbacks enregistrées pour ${Object.keys(localQuotas).length} modèles.`);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleResetDefaults = () => {
    const defaults: Record<string, ModelQuotaConfig> = {};
    allModelsList.forEach((m) => {
      defaults[m.modelId] = {
        modelId: m.modelId,
        providerId: m.providerId,
        dailyLimitTokens: m.providerId === 'claude' || m.providerId === 'chatgpt' ? 1_000_000 : 2_000_000,
        warnThresholdPercent: 80,
        fallbackModelId: m.providerId === 'deepseek' ? 'gemini-2.5-flash' : 'deepseek-chat',
        fallbackProviderId: m.providerId === 'deepseek' ? 'gemini' : 'deepseek',
        autoFallbackEnabled: true,
        rateLimitPerMinute: 60,
      };
    });
    setLocalQuotas(defaults);
    onAddLog('info', 'Réinitialisation des quotas par défaut effectuée');
  };

  // Calcul d'utilisation pour le modèle sélectionné
  const currentProviderStats = stats.providers[activeConfig.providerId];
  const currentTokensUsed = (currentProviderStats?.prompt_tokens || 0) + (currentProviderStats?.completion_tokens || 0);
  const percentUsed = Math.min(100, Math.round((currentTokensUsed / (activeConfig.dailyLimitTokens || 1)) * 100));
  const isWarning = percentUsed >= activeConfig.warnThresholdPercent;
  const isExceeded = percentUsed >= 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#040914]/85 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-gradient-to-b from-[#0c1833] via-[#09152b] to-[#071124] border border-sky-600/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-sky-950/80 z-10 max-h-[92vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between pb-5 border-b border-sky-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Gestion Avancée des Quotas & Fallbacks</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 font-mono">
                  Sécurité Anti-429
                </span>
              </h2>
              <p className="text-xs text-sky-200/70">
                Plafonnez la consommation par modèle et basculez automatiquement sur un moteur de secours en cas de rate-limit.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-sky-300 hover:text-white hover:bg-sky-800/40 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Corps principal : Sélecteur de modèle à gauche, réglages à droite */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 overflow-y-auto flex-1 pr-1">
          {/* Liste des Modèles (4 colonnes) */}
          <div className="md:col-span-4 space-y-2 border-r border-sky-800/30 pr-0 md:pr-4">
            <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider px-2 pb-1 flex items-center justify-between">
              <span>Modèles Disponibles</span>
              <span className="font-mono text-[10px] text-sky-300/60">{allModelsList.length}</span>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {allModelsList.map((m) => {
                const isSelected = selectedModelKey === m.modelId;
                const mConfig = localQuotas[m.modelId];
                const pStats = stats.providers[m.providerId];
                const pTokens = (pStats?.prompt_tokens || 0) + (pStats?.completion_tokens || 0);
                const pPercent = mConfig ? Math.min(100, Math.round((pTokens / (mConfig.dailyLimitTokens || 1)) * 100)) : 0;

                return (
                  <button
                    key={m.modelId}
                    onClick={() => setSelectedModelKey(m.modelId)}
                    className={`w-full text-left p-3 rounded-2xl transition-all duration-150 flex items-center justify-between cursor-pointer border ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-md shadow-sky-500/20'
                        : 'bg-[#09152b] hover:bg-[#0c1c38] text-sky-200 border-sky-800/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate leading-tight">{m.modelId}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-slate-950/80 font-medium' : 'text-sky-300/60'}`}>
                        {m.providerName}
                      </div>
                    </div>
                    {pPercent > 0 && (
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ml-2 shrink-0 ${
                          isSelected
                            ? 'bg-slate-950/20 text-slate-950'
                            : pPercent >= 80
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-sky-950 text-sky-400 border border-sky-800/50'
                        }`}
                      >
                        {pPercent}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formulaire de configuration du modèle (8 colonnes) */}
          <div className="md:col-span-8 space-y-5">
            {/* Bannière de Statut du Modèle Actif */}
            <div className="p-4 rounded-2xl border border-sky-700/50 bg-[#09152b] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <span>{selectedModelKey}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                      {activeConfig.providerId.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-[11px] text-sky-300/70">
                    Utilisation actuelle : {currentTokensUsed.toLocaleString()} tokens
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      isExceeded
                        ? 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                        : isWarning
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                        : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {isExceeded ? 'Quota Atteint' : isWarning ? 'Alerte Seuil (80%+)' : 'Dans les limites'}
                  </span>
                </div>
              </div>

              {/* Jauge visuelle de quota */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-sky-300/80">
                  <span>Consommation : {percentUsed}%</span>
                  <span>Plafond : {activeConfig.dailyLimitTokens.toLocaleString()} tokens / jour</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#071124] overflow-hidden border border-sky-800/40 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      percentUsed >= 100
                        ? 'bg-rose-500'
                        : percentUsed >= 80
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-sky-400 to-cyan-400'
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Réglage 1 : Plafond Quota Quotidien */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-sky-200 flex items-center justify-between">
                <span>Plafond Journalier de Tokens</span>
                <span className="font-mono text-sky-400 font-bold">
                  {(activeConfig.dailyLimitTokens || 0).toLocaleString()} tokens
                </span>
              </label>
              <input
                type="range"
                min="100000"
                max="10000000"
                step="100000"
                value={activeConfig.dailyLimitTokens}
                onChange={(e) => handleUpdateActiveConfig('dailyLimitTokens', Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer h-2 bg-[#071124] rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-sky-400/60 font-mono">
                <span>100k tokens (Éco)</span>
                <span>2M tokens (Standard)</span>
                <span>10M tokens (Intensif)</span>
              </div>
            </div>

            {/* Réglage 2 : Seuil d'Alerte Précoce */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-sky-200 flex items-center justify-between">
                <span>Seuil d'Avertissement Visuel</span>
                <span className="font-mono text-amber-300 font-bold">{activeConfig.warnThresholdPercent}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={activeConfig.warnThresholdPercent}
                onChange={(e) => handleUpdateActiveConfig('warnThresholdPercent', Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-[#071124] rounded-lg"
              />
              <p className="text-[11px] text-sky-300/60">
                Une notification d'avertissement sera consignée dans les journaux système dès que la consommation franchira ce palier.
              </p>
            </div>

            {/* Réglage 3 : Moteur de Secours (Auto-Fallback) */}
            <div className="p-4 rounded-2xl border border-sky-700/50 bg-[#09152b]/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">Bascule Automatique en cas de 429 / Panne</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeConfig.autoFallbackEnabled}
                    onChange={(e) => handleUpdateActiveConfig('autoFallbackEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-sky-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 border border-sky-700"></div>
                </label>
              </div>

              {activeConfig.autoFallbackEnabled && (
                <div className="space-y-2 pt-1 border-t border-sky-800/40">
                  <label className="text-[11px] font-bold text-sky-300">
                    Modèle de Substitution Immédiat :
                  </label>
                  <select
                    value={activeConfig.fallbackModelId || 'gemini-2.5-flash'}
                    onChange={(e) => {
                      const selected = allModelsList.find((m) => m.modelId === e.target.value);
                      handleUpdateActiveConfig('fallbackModelId', e.target.value);
                      if (selected) {
                        handleUpdateActiveConfig('fallbackProviderId', selected.providerId);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#071124] border border-sky-700/60 text-xs font-semibold text-white focus:outline-none focus:border-sky-400"
                  >
                    {allModelsList
                      .filter((m) => m.modelId !== selectedModelKey)
                      .map((m) => (
                        <option key={m.modelId} value={m.modelId}>
                          {m.modelId} ({m.providerName})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-sky-300/60 leading-relaxed">
                    Si le modèle principal retourne une erreur HTTP 429 (Rate Limit) ou un délai dépassé, NemApi réoriente instantanément la requête vers ce moteur de secours sans interrompre votre IDE.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pied de page & actions */}
        <div className="pt-4 border-t border-sky-800/40 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl border border-sky-800/60 bg-[#071124] hover:bg-sky-900/40 text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rétablir valeurs par défaut</span>
          </button>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Enregistré avec succès</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-sky-700/50 bg-[#09152b] hover:bg-sky-900/40 text-sky-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 text-xs font-black shadow-lg shadow-sky-500/25 transition-all cursor-pointer hover:scale-105"
            >
              Enregistrer les Quotas & Fallbacks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
