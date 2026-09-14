import React, { useState } from 'react';
import { SubscriptionState } from '../types';
import { activateLicense } from '../utils/licenseValidator';
import {
  CreditCard,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Zap,
  AlertCircle,
  Clock,
  Infinity,
  Check,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';

interface SubscriptionViewProps {
  subscription: SubscriptionState;
  onUpdateSubscription: (newSub: SubscriptionState) => void;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  subscription,
  onUpdateSubscription,
}) => {
  const [inputKey, setInputKey] = useState('');
  const [inputUser, setInputUser] = useState(subscription.user || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const isPremium = subscription.plan !== 'free';

  const handleActivate = async () => {
    if (!inputKey.trim()) {
      setMessage({ text: 'Veuillez saisir votre clé de licence Pro ou Lifetime.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await activateLicense(inputKey.trim(), inputUser.trim());
      if (result.ok && result.subscription) {
        onUpdateSubscription(result.subscription);
        setMessage({
          text: `Licence ${result.subscription.plan_name} activée avec succès ! Les moteurs IA sont maintenant débloqués.`,
          type: 'success',
        });
        setInputKey('');
      } else {
        setMessage({
          text: result.error || 'Clé de licence invalide ou introuvable dans la base de données.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setMessage({
        text: `Erreur lors de l'activation : ${err.message || 'Erreur inconnue'}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Voulez-vous vraiment réinitialiser la licence et revenir au mode Gratuit ?')) {
      return;
    }
    setLoading(true);
    try {
      await fetch('/subscription/deactivate', { method: 'POST' }).catch(() => {});
    } catch (_) {}

    const freeSub: SubscriptionState = {
      plan: 'free',
      plan_name: 'Gratuit',
      user: inputUser,
    };
    onUpdateSubscription(freeSub);
    setMessage({ text: 'Licence réinitialisée. L\'application fonctionne en mode Gratuit.', type: 'info' });
    setLoading(false);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* En-tête de section */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Licences Logicielles & Déverrouillage
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70">
            Activez votre clé de licence Pro ou Lifetime pour débloquer l'accès sans restriction à tous les moteurs IA.
          </p>
        </div>

        {/* Badge d'état du plan actuel */}
        <div className="flex items-center gap-2">
          <span
            className={`px-4 py-2 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
              isPremium
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-lg shadow-amber-950/30'
                : 'border-sky-500/40 bg-sky-500/15 text-sky-300'
            }`}
          >
            {isPremium ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-sky-400" />}
            <span>{subscription.plan_name}</span>
          </span>
        </div>
      </div>

      {/* Message de statut */}
      {message && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-lg ${
            message.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
              : message.type === 'error'
              ? 'border-rose-500/40 bg-rose-950/50 text-rose-300'
              : 'border-sky-500/40 bg-sky-950/50 text-sky-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grille Activation & Détails */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Colonne Formulaire d'activation (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-xl shadow-sky-950/30">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-400" />
              <span>Activer une Clé de Licence</span>
            </h3>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Saisissez votre clé de produit de licence pour débloquer l'accès complet.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-sky-200 mb-1.5">
                Nom du Titulaire de Licence
              </label>
              <input
                type="text"
                id="license-user-input"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                placeholder="Ex : Alexandre D."
                className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sky-200 mb-1.5">
                Clé de Produit
              </label>
              <input
                type="text"
                id="license-key-input"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                placeholder="Saisissez votre clé de produit"
                maxLength={128}
                className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs font-mono text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 uppercase tracking-wider transition-colors"
              />
              <div className="text-[11px] text-sky-300/60 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Vérification instantanée auprès de la base de données</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="license-activate-btn"
              onClick={handleActivate}
              disabled={loading || !inputKey.trim()}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-sky-500/25 flex items-center gap-2 hover:-translate-y-0.5"
            >
              <Zap className="w-4 h-4" />
              <span>{loading ? 'Chargement...' : 'Valider & Débloquer les Moteurs IA'}</span>
            </button>

            {isPremium && (
              <button
                onClick={handleDeactivate}
                disabled={loading}
                className="px-4 py-3 rounded-2xl border border-sky-700/60 hover:bg-sky-900/60 bg-[#071124] text-sky-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Désactiver l'abonnement
              </button>
            )}
          </div>
        </div>

        {/* Colonne Statut & Droits Actuels (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between shadow-xl shadow-sky-950/30">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Droits & État de Licence</span>
            </h3>

            <div className="mt-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-sky-800/30">
                <span className="text-sky-300/70 font-semibold">Plan Actuel</span>
                <span className="font-bold text-white">{subscription.plan_name}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-sky-800/30">
                <span className="text-sky-300/70 font-semibold">Clé Enregistrée</span>
                <span className="font-mono text-sky-100 font-bold">
                  {subscription.product_key
                    ? `${subscription.product_key.slice(0, 8)}••••••••${subscription.product_key.slice(-4)}`
                    : 'Aucune (Mode Gratuit)'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-sky-800/30">
                <span className="text-sky-300/70 font-semibold">Moteurs IA Débloqués</span>
                <span className={`font-bold ${isPremium ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {isPremium ? '8 / 8 Débloqués (Tous)' : '3 / 8 (Auto, DeepSeek, Gemini)'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-sky-800/30">
                <span className="text-sky-300/70 font-semibold">Quota Journalier</span>
                <span className="font-bold text-white">
                  {isPremium ? 'Illimité' : '30 000 000 tokens / jour'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sky-300/70 font-semibold">Validité</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {isPremium ? (subscription.expires_at || 'Active') : 'Accès gratuit permanent'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-sky-800/40 mt-6">
            <div className="p-3.5 rounded-2xl border border-sky-700/40 bg-[#071124] text-xs text-sky-200/80 leading-relaxed">
              La licence est vérifiée et synchronisée avec votre base de données.
            </div>
          </div>
        </div>
      </div>

      {/* Grille des 3 Formules Commerciales */}
      <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-xl shadow-sky-950/30">
        <h3 className="text-base font-bold text-white tracking-tight">Formules & Niveaux d'Accès</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
          {/* Gratuit */}
          <div className="p-5 rounded-2xl border border-sky-800/40 bg-[#071124] space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">Gratuit (Free)</h4>
                <span className="text-xs px-2.5 py-0.5 rounded-full border border-sky-700/50 text-sky-300 font-bold">0 $</span>
              </div>
              <p className="text-xs text-sky-200/70 mt-2 leading-relaxed">
                Sans clé de licence. Idéal pour tester l'environnement local avec les moteurs de base.
              </p>
              <ul className="text-xs text-sky-300/80 space-y-2 mt-4">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>2 moteurs IA de base (DeepSeek & Gemini)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>30M tokens / jour</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>Passerelle locale /v1/chat/completions</span>
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-sky-400/60 pt-3 border-t border-sky-800/40 font-bold">Inclus par défaut sans clé</div>
          </div>

          {/* Pro Annuel */}
          <div className="p-5 rounded-2xl border border-amber-400/50 bg-[#0e1d3a] space-y-4 flex flex-col justify-between shadow-lg shadow-amber-950/20">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-amber-300 text-sm">Pro Annuel</h4>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                  10 $/an
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-2 leading-relaxed">
                Clé de licence requise. Débloque les 7 moteurs pour 365 jours complets.
              </p>
              <ul className="text-xs text-sky-200 space-y-2 mt-4">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Les 7 moteurs IA 100% débloqués</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Claude 3.7 Sonnet & ChatGPT GPT-4o / o1</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Qwen 2.5 Coder, Kimi K2, Z.ai GLM-4</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tokens illimités & mises à jour</span>
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-amber-300/80 pt-3 border-t border-sky-800/40 font-bold">Clé sécurisée NEM-PRO-...</div>
          </div>

          {/* Lifetime À vie */}
          <div className="p-5 rounded-2xl border border-sky-400/50 bg-[#0e2447] space-y-4 flex flex-col justify-between shadow-lg shadow-sky-950/40">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sky-300 text-sm">Lifetime À Vie</h4>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/40 font-bold">
                  99 $ unique
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-2 leading-relaxed">
                Clé de licence requise. Accès permanent illimité à vie sans abonnement ni expiration.
              </p>
              <ul className="text-xs text-sky-200 space-y-2 mt-4">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>Accès permanent à vie à tous les moteurs</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>Déblocage automatique des futurs modèles IA</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-sky-400" />
                  <span>Support technique dédié prioritaire</span>
                </li>
              </ul>
            </div>
            <div className="text-[11px] text-sky-300/80 pt-3 border-t border-sky-800/40 font-bold">Clé sécurisée NEM-LIFE-...</div>
          </div>
        </div>
      </div>
    </div>
  );
};
