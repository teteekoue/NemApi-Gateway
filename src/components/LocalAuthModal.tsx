import React, { useState, useEffect } from 'react';
import { UserAccount, SubscriptionState } from '../types';
import {
  User,
  ShieldCheck,
  Laptop,
  CheckCircle2,
  ArrowRight,
  UserPlus,
  LogIn,
  X,
  Lock,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import {
  syncUserWithSheets,
  loadSavedSheetsConfig,
  DEFAULT_WEB_APP_URL,
} from '../services/googleSheetsService';

interface LocalAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: UserAccount;
  onSaveAccount: (account: UserAccount) => void;
  subscription: SubscriptionState;
}

export const LocalAuthModal: React.FC<LocalAuthModalProps> = ({
  isOpen,
  onClose,
  currentAccount,
  onSaveAccount,
  subscription,
}) => {
  const [mode, setMode] = useState<'custom' | 'quick'>('custom');
  const [name, setName] = useState(currentAccount.name || '');
  const [email, setEmail] = useState(currentAccount.email || '');
  const [organization, setOrganization] = useState(currentAccount.organization || '');
  const [receiveAnnouncements, setReceiveAnnouncements] = useState(
    currentAccount.receiveAnnouncements ?? true
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Synchronisation des champs quand la modale s'ouvre
  useEffect(() => {
    if (isOpen) {
      setName(currentAccount.name || '');
      setEmail(currentAccount.email || '');
      setOrganization(currentAccount.organization || '');
      setReceiveAnnouncements(currentAccount.receiveAnnouncements ?? true);
      setSyncNotice(null);
    }
  }, [isOpen, currentAccount]);

  // Écoute de la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Verrouillage du défilement d'arrière-plan quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickLogin = async () => {
    setIsSubmitting(true);
    const userId = currentAccount.id || `USR-${Math.floor(1000 + Math.random() * 9000)}`;
    const updated: UserAccount = {
      ...currentAccount,
      id: userId,
      name: currentAccount.name?.trim() ? currentAccount.name : 'Utilisateur Démo',
      registeredAt: currentAccount.registeredAt || new Date().toLocaleDateString('fr-FR'),
    };
    onSaveAccount(updated);
    
    // Sync avec Google Sheets
    try {
      const config = loadSavedSheetsConfig();
      await syncUserWithSheets(config.webAppUrl || DEFAULT_WEB_APP_URL, updated);
    } catch (_) {}

    try {
      localStorage.setItem('nemapi_onboarded', 'true');
    } catch (_) {}
    setIsSubmitting(false);
    onClose();
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSyncNotice('Chargement...');

    const userId = currentAccount.id && currentAccount.id !== 'USR-LOCAL-DEFAULT' 
      ? currentAccount.id 
      : `USR-${Math.floor(1000 + Math.random() * 9000)}`;

    const updated: UserAccount = {
      ...currentAccount,
      id: userId,
      name: name.trim() || 'Utilisateur NemApi',
      email: email.trim(),
      organization: organization.trim(),
      receiveAnnouncements,
      registeredAt: currentAccount.registeredAt || new Date().toLocaleDateString('fr-FR'),
    };

    // Synchronisation en direct avec la base de données
    try {
      const config = loadSavedSheetsConfig();
      const res = await syncUserWithSheets(config.webAppUrl || DEFAULT_WEB_APP_URL, updated);
      if (res.ok) {
        setSyncNotice('Enregistré avec succès !');
      }
    } catch (_) {}

    onSaveAccount(updated);
    try {
      localStorage.setItem('nemapi_onboarded', 'true');
    } catch (_) {}

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div
      id="local-auth-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#030814]/85 backdrop-blur-md p-4 sm:p-6 md:p-8 flex items-center justify-center animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
    >
      <div className="relative w-full max-w-lg bg-[#081328] border border-sky-500/40 rounded-3xl shadow-2xl shadow-sky-950/90 overflow-hidden z-10 my-auto text-left transition-all">
        {/* Lueur subtile en arrière-plan */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* En-tête fixe avec bouton de fermeture net */}
        <div className="px-6 py-4.5 border-b border-sky-800/40 bg-[#071124] flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="modal-headline" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  NemApi Gateway
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold font-mono rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Local 100%
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-0.5">
                Session locale & Attribution de licences
              </p>
            </div>
          </div>

          <button
            id="modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-sky-300/70 hover:text-white hover:bg-sky-800/50 transition-colors cursor-pointer"
            aria-label="Fermer la boîte de dialogue"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu principal */}
        <div className="p-6 sm:p-7 space-y-4 relative z-10 max-h-[calc(85vh-90px)] overflow-y-auto">
          {/* Note d'information confidentialité & local */}
          <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/40 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-sky-200">Passerelle locale sur votre machine</p>
              <p className="text-sky-300/70 leading-relaxed text-[11px]">
                Vos requêtes et vos sessions Chromium s'exécutent strictement sur votre machine (127.0.0.1:8090).
              </p>
            </div>
          </div>

          {/* Onglets de sélection du mode */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#050e1f] border border-sky-800/40">
            <button
              id="modal-tab-quick"
              type="button"
              onClick={() => setMode('quick')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'quick'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25'
                  : 'text-sky-300 hover:text-white hover:bg-sky-900/30'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Démarrage Direct</span>
            </button>
            <button
              id="modal-tab-custom"
              type="button"
              onClick={() => setMode('custom')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mode === 'custom'
                  ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25'
                  : 'text-sky-300 hover:text-white hover:bg-sky-900/30'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Personnaliser</span>
            </button>
          </div>

          {/* Mode 1 : Connexion Rapide (un clic suffit) */}
          {mode === 'quick' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 rounded-2xl border border-sky-700/40 bg-gradient-to-br from-[#0c1c38] to-[#071328] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center font-bold text-sm">
                      {(currentAccount.name || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {currentAccount.name || 'Utilisateur Local'}
                      </p>
                      <p className="text-xs text-sky-300/70 font-mono">
                        {currentAccount.id || 'USR-LOCAL-DEFAULT'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Prêt
                  </span>
                </div>

                <div className="pt-2 border-t border-sky-800/30 flex items-center justify-between text-xs text-sky-300/70">
                  <span>Licence active :</span>
                  <span className="font-semibold text-sky-200">{subscription.plan_name}</span>
                </div>
              </div>

              <p className="text-xs text-center text-sky-300/70 leading-relaxed">
                Cliquez sur le bouton ci-dessous pour ouvrir immédiatement le tableau de bord et la passerelle.
              </p>

              <button
                id="modal-start-quick-btn"
                type="button"
                onClick={handleQuickLogin}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Démarrer avec la session locale</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mode 2 : Créer / Personnaliser son Profil Local */}
          {mode === 'custom' && (
            <form onSubmit={handleCustomSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Nom ou Pseudo de l'utilisateur local *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" />
                  <input
                    id="modal-input-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Alexandre, TechLead, Admin..."
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#050e1f] border border-sky-800/50 text-white text-xs placeholder:text-sky-400/40 focus:outline-none focus:border-sky-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Adresse e-mail (facultative - pour attribution de licences)
                </label>
                <input
                  id="modal-input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@organisation.local"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050e1f] border border-sky-800/50 text-white text-xs placeholder:text-sky-400/40 focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-sky-200 mb-1.5">
                  Organisation ou Studio (facultatif)
                </label>
                <input
                  id="modal-input-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Ex: Freelance, Dev Studio, Équipe IA..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#050e1f] border border-sky-800/50 text-white text-xs placeholder:text-sky-400/40 focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="modal-announcements-check"
                  checked={receiveAnnouncements}
                  onChange={(e) => setReceiveAnnouncements(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-500 bg-[#050e1f] border-sky-700 focus:ring-sky-400 cursor-pointer"
                />
                <label
                  htmlFor="modal-announcements-check"
                  className="text-xs text-sky-200/80 cursor-pointer select-none"
                >
                  Notifié des mises à jour des adaptateurs Chromium
                </label>
              </div>

              {syncNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{syncNotice}</span>
                </div>
              )}

              <button
                id="modal-save-custom-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 cursor-pointer mt-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Chargement...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Créer mon compte & Ouvrir la passerelle</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
