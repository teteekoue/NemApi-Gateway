import React from 'react';
import { ProviderInfo, SubscriptionState } from '../types';

interface ProvidersGridProps {
  providers: ProviderInfo[];
  subscription: SubscriptionState;
  onSelectProviderForTest: (providerId: string, model: string) => void;
  onNavigateToSubscription: () => void;
}

export const ProvidersGrid: React.FC<ProvidersGridProps> = ({
  providers,
  subscription,
  onSelectProviderForTest,
  onNavigateToSubscription,
}) => {
  const isPremium = subscription.plan !== 'free';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Fournisseurs d'Intelligence Artificielle</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            7 moteurs IA synchronisés en temps réel avec le navigateur Chromium intégré.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900 text-xs text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>7/7 Passerelles Opérationnelles</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {providers.map((p) => {
          const isAllowed = isPremium || p.freeAllowed;

          return (
            <div
              key={p.id}
              id={`provider-card-${p.id}`}
              className={`rounded-xl border p-5 flex flex-col justify-between transition-colors ${
                isAllowed
                  ? 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  : 'border-zinc-800/80 bg-zinc-950/60 opacity-90'
              }`}
            >
              <div>
                {/* En-tête : Vrai logo de marque & Statut */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.logo}
                      alt={`${p.name} Logo`}
                      className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-950 p-1 object-contain"
                    />
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {p.name}
                      </h3>
                      <div className="font-mono text-xs text-zinc-400">
                        {p.canonicalModel}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      isAllowed
                        ? p.freeAllowed
                          ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-400'
                          : 'border-amber-500/30 bg-amber-950/30 text-amber-400'
                        : 'border-zinc-700 bg-zinc-800/80 text-zinc-400'
                    }`}
                  >
                    {isAllowed ? (p.freeAllowed ? 'Gratuit' : 'Premium') : 'Licence Requise'}
                  </span>
                </div>

                {/* Description technique sobre */}
                <p className="text-xs text-zinc-400 mb-3.5 leading-relaxed">
                  {p.description}
                </p>

                {/* Modèles & Alias supportés */}
                <div className="mb-3.5">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1">
                    Alias reconnus par le proxy :
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.aliases.slice(0, 4).map((alias) => (
                      <span
                        key={alias}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Spécificités architecturales */}
                <div className="space-y-1 mb-4">
                  {p.features.slice(0, 2).map((feat, idx) => (
                    <div key={idx} className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-zinc-400" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pied de carte : Statut d'accès & Actions */}
              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                <div className="text-[11px] text-zinc-400">
                  <span>Éco : ${(p.completionPrice * 1000).toFixed(2)}/1M tokens</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    Portail
                  </a>

                  {isAllowed ? (
                    <button
                      id={`test-provider-btn-${p.id}`}
                      onClick={() => onSelectProviderForTest(p.id, p.canonicalModel)}
                      className="text-xs px-3 py-1 rounded bg-white hover:bg-zinc-200 text-black font-semibold transition-colors cursor-pointer"
                    >
                      Tester
                    </button>
                  ) : (
                    <button
                      onClick={onNavigateToSubscription}
                      className="text-xs px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 font-medium transition-colors cursor-pointer"
                    >
                      Débloquer
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
