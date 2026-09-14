import React, { useState } from 'react';
import { UserAccount, SubscriptionState, UserAssignedLicense } from '../types';
import { activateLicense } from '../utils/licenseValidator';
import {
  syncUserWithSheets,
  saveLicenseToSheets,
  loadSavedSheetsConfig,
  DEFAULT_WEB_APP_URL,
} from '../services/googleSheetsService';
import {
  User,
  Mail,
  Building2,
  Bell,
  KeyRound,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Download,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  Laptop,
  FileSpreadsheet,
  LogOut,
  LogIn,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

interface AccountViewProps {
  account: UserAccount;
  onUpdateAccount: (updated: UserAccount) => void;
  subscription: SubscriptionState;
  onUpdateSubscription: (newSub: SubscriptionState) => void;
  onAddLog: (level: 'info' | 'warn' | 'error' | 'success', message: string) => void;
  onOpenAuthModal?: () => void;
  onLogout?: (resetAll: boolean) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  account,
  onUpdateAccount,
  subscription,
  onUpdateSubscription,
  onAddLog,
  onOpenAuthModal,
  onLogout,
}) => {
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [organization, setOrganization] = useState(account.organization || '');
  const [receiveAnnouncements, setReceiveAnnouncements] = useState(account.receiveAnnouncements);

  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [licenseNote, setLicenseNote] = useState('');
  const [isAssociating, setIsAssociating] = useState(false);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [licenseMessage, setLicenseMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);

  const isPremium = subscription.plan !== 'free';

  // Enregistrer les informations du profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingSheets(true);

    const updated: UserAccount = {
      ...account,
      name: name.trim() || 'Utilisateur NemApi',
      email: email.trim(),
      organization: organization.trim(),
      receiveAnnouncements,
    };
    onUpdateAccount(updated);

    // Sync avec la base de données
    try {
      const config = loadSavedSheetsConfig();
      await syncUserWithSheets(config.webAppUrl || DEFAULT_WEB_APP_URL, updated);
      setSaveStatus('Informations du compte mises à jour et synchronisées avec la base de données !');
    } catch (_) {
      setSaveStatus('Informations du compte mises à jour localement');
    }

    setIsSyncingSheets(false);
    onAddLog('success', `Profil utilisateur mis à jour (${updated.name} - ${updated.email || 'Sans e-mail'})`);
    setTimeout(() => setSaveStatus(null), 4000);
  };

  // Associer une nouvelle clé de licence au compte
  const handleAssociateLicense = async (keyInput?: string) => {
    const key = (keyInput || newLicenseKey).trim().toUpperCase();
    if (!key) {
      setLicenseMessage({ text: 'Veuillez renseigner une clé de licence valide.', type: 'error' });
      return;
    }

    setIsAssociating(true);
    setLicenseMessage(null);

    try {
      const result = await activateLicense(key, name || 'Utilisateur', email);
      if (result.ok && result.subscription) {
        onUpdateSubscription(result.subscription);

        const existingIdx = account.assignedLicenses.findIndex((l) => l.key === key);
        const newLicense: UserAssignedLicense = {
          key,
          plan: result.subscription.plan,
          plan_name: result.subscription.plan_name,
          activatedAt: new Date().toLocaleDateString('fr-FR'),
          status: 'active',
          notes: licenseNote.trim() || (key.startsWith('PL') ? 'Licence Permanente' : 'Licence Annuelle'),
        };

        let updatedLicenses: UserAssignedLicense[];
        if (existingIdx >= 0) {
          updatedLicenses = account.assignedLicenses.map((l, i) => (i === existingIdx ? newLicense : l));
        } else {
          updatedLicenses = [newLicense, ...account.assignedLicenses];
        }

        const updatedAccount: UserAccount = {
          ...account,
          assignedLicenses: updatedLicenses,
        };

        onUpdateAccount(updatedAccount);

        // Sauvegarde dans la base de données
        try {
          const config = loadSavedSheetsConfig();
          await saveLicenseToSheets(config.webAppUrl || DEFAULT_WEB_APP_URL, {
            key,
            tier: result.subscription.plan,
            plan_name: result.subscription.plan_name,
            user_id: account.id,
            user_email: email,
            notes: newLicense.notes,
          });
        } catch (_) {}

        setNewLicenseKey('');
        setLicenseNote('');
        setLicenseMessage({
          text: `Licence ${result.subscription.plan_name} associée et enregistrée avec succès !`,
          type: 'success',
        });
        onAddLog('success', `Licence ${key} associée au compte et enregistrée dans la base de données`);
      } else {
        setLicenseMessage({
          text: result.error || 'La clé renseignée est introuvable ou invalide.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setLicenseMessage({ text: `Erreur d'association : ${err.message}`, type: 'error' });
    } finally {
      setIsAssociating(false);
    }
  };

  // Basculer la licence active
  const handleSwitchActiveLicense = async (lic: UserAssignedLicense) => {
    setIsAssociating(true);
    setLicenseMessage(null);
    try {
      const res = await activateLicense(lic.key, name || 'Utilisateur');
      if (res.ok && res.subscription) {
        onUpdateSubscription(res.subscription);
        setLicenseMessage({
          text: `Licence ${lic.plan_name} (${lic.key.slice(0, 4)}••••) définie comme licence active.`,
          type: 'success',
        });
        onAddLog('info', `Licence active modifiée pour : ${lic.plan_name}`);
      }
    } catch (_) {
      setLicenseMessage({ text: 'Erreur lors de l\'activation de la clé sélectionnée.', type: 'error' });
    } finally {
      setIsAssociating(false);
    }
  };

  // Supprimer / détacher une licence
  const handleRemoveLicense = (keyToRemove: string) => {
    if (!confirm('Détacher cette clé de licence de votre compte utilisateur local ?')) return;
    const updatedLicenses = account.assignedLicenses.filter((l) => l.key !== keyToRemove);
    onUpdateAccount({
      ...account,
      assignedLicenses: updatedLicenses,
    });
    if (subscription.product_key === keyToRemove) {
      onUpdateSubscription({
        plan: 'free',
        plan_name: 'Gratuit',
        user: name,
      });
    }
    onAddLog('warn', `Clé ${keyToRemove.slice(0, 4)}•••• détachée du compte`);
  };

  // Exporter les données du compte au format JSON
  const handleExportAccountData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ account, subscription }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nemapi-user-${account.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onAddLog('info', 'Données de compte exportées au format JSON');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* En-tête de section moderne */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1936] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Espace Compte & Titulaire Local
            </h2>
            <span className="text-xs px-3 py-1 rounded-full border border-sky-400/40 bg-sky-500/15 text-sky-300 font-mono font-bold">
              ID: {account.id}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70 font-normal">
            Gestion du profil local, préférences de notifications d'adaptateurs et attribution des licences logicielles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportAccountData}
            className="px-4 py-2.5 rounded-2xl border border-sky-600/50 bg-[#091730] hover:bg-sky-900/60 text-sky-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shadow-md hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Exporter Profil (JSON)</span>
          </button>
        </div>
      </div>

      {/* Bannière de confirmation de sauvegarde */}
      {saveStatus && (
        <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/50 text-emerald-300 text-xs font-bold animate-in fade-in flex items-center gap-2.5 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* Colonne Gauche : Formulaire Coordonnées & Préférences (7 cols) */}
        <div className="lg:col-span-7 space-y-7">
          <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-6 shadow-xl shadow-sky-950/30">
            <div className="flex items-center justify-between pb-4 border-b border-sky-800/40">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">Coordonnées du Titulaire</h3>
                <p className="text-xs text-sky-200/70">
                  Stockées localement sur votre ordinateur pour identifier le propriétaire des licences.
                </p>
              </div>

              <div className="w-11 h-11 rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-black text-slate-950 text-base shadow-md">
                {(name.trim() || 'U')[0].toUpperCase()}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    <span>Nom ou Pseudo</span>
                    <span className="text-sky-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Alexandre Dev"
                    className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Organisation (optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="ex: Studio IA / Freelance"
                    className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-400" />
                  <span>Adresse e-mail (facultative)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@developpeur.local"
                  className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>

              {/* Préférence Annonces et Mises à jour */}
              <div className="p-4 rounded-2xl border border-sky-800/50 bg-[#071124] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">
                      Annonces & Mises à Jour du Logiciel
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-300/70 leading-relaxed">
                    Recevoir les alertes d'évolution des 7 moteurs, les correctifs Chromium et les nouveaux modèles IA disponibles.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={receiveAnnouncements}
                    onChange={(e) => setReceiveAnnouncements(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#09152b] peer-focus:outline-none rounded-full peer border border-sky-700/60 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="py-3 px-6 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/25 transition-all cursor-pointer flex items-center gap-2 hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer les coordonnées</span>
                </button>
              </div>
            </form>
          </div>

          {/* Module d'association de nouvelle clé produit */}
          <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-5 shadow-xl shadow-sky-950/30">
            <div className="pb-3 border-b border-sky-800/40">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <span>Associer une Clé de Licence</span>
              </h3>
              <p className="text-xs text-sky-200/70 mt-0.5">
                Renseignez votre clé de produit de licence pour l'assigner à votre compte.
              </p>
            </div>

            {licenseMessage && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                  licenseMessage.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-950/50 text-rose-300'
                }`}
              >
                {licenseMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{licenseMessage.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-sky-200">
                  Clé de Licence Produit
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value.toUpperCase())}
                    placeholder="Saisissez votre clé de produit"
                    maxLength={128}
                    className="flex-1 rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-3 text-xs font-mono text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors uppercase"
                  />
                  <button
                    onClick={() => handleAssociateLicense()}
                    disabled={isAssociating}
                    className="py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/25 transition-all cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                  >
                    {isAssociating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Chargement...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Associer au Compte</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-sky-200">
                  Libellé ou note pour cette licence (optionnel)
                </label>
                <input
                  type="text"
                  value={licenseNote}
                  onChange={(e) => setLicenseNote(e.target.value)}
                  placeholder="ex: Poste principal MacBook Pro"
                  className="w-full rounded-2xl border border-sky-800/60 bg-[#060e1d] px-4 py-2.5 text-xs text-white placeholder:text-sky-400/30 focus:outline-none focus:border-sky-400 transition-colors"
                />
              </div>

              {/* Note de sécurité sur les clés de licence */}
              <div className="p-3.5 rounded-2xl border border-sky-800/50 bg-[#071124] text-xs text-sky-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-sky-300 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Validation & Synchronisation Base de Données</span>
                </div>
                <p className="text-[11px] text-sky-300/70 leading-relaxed">
                  Toute clé activée est authentifiée auprès de la base de données et automatiquement synchronisée dans votre compte.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Statut de la Licence Active & Liste des Licences (5 cols) */}
        <div className="lg:col-span-5 space-y-7">
          {/* Carte Résumé Licence Active */}
          <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 space-y-4 shadow-xl shadow-sky-950/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                Licence Actuellement Utilisée
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isPremium
                    ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                    : 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                }`}
              >
                {subscription.plan_name}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-black text-white">
                {isPremium ? 'Moteurs Complets (8/8)' : 'Formule Standard (3/8)'}
              </div>
              <p className="text-xs text-sky-200/70 leading-relaxed">
                {isPremium
                  ? 'Accès illimité sans plafond à Routeur Auto, DeepSeek, Gemini, Claude, ChatGPT, Qwen, Kimi et Z.ai.'
                  : 'Accès permanent aux modèles Auto, DeepSeek et Gemini.'}
              </p>
            </div>

            {subscription.product_key && (
              <div className="p-3.5 rounded-2xl bg-[#060e1d] border border-sky-800/60 font-mono text-xs text-sky-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-sky-400 font-bold uppercase">Clé Active :</div>
                  <div>{subscription.product_key}</div>
                </div>
                <button
                  onClick={() => copyToClipboard(subscription.product_key!, 'active')}
                  className="p-1.5 rounded-xl hover:bg-sky-900/60 text-sky-300 transition-colors cursor-pointer"
                  title="Copier la clé"
                >
                  {copiedKey === 'active' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Tableau des Licences Associées au Compte */}
          <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 space-y-4 shadow-xl shadow-sky-950/30">
            <div className="flex items-center justify-between pb-3 border-b border-sky-800/40">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Licences Assignées ({account.assignedLicenses.length})
              </h3>
              <span className="text-[11px] text-sky-400/80 font-mono font-semibold">
                Portefeuille Local
              </span>
            </div>

            {account.assignedLicenses.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-2xl border border-dashed border-sky-800/50 bg-[#060e1d]/50 space-y-2">
                <KeyRound className="w-8 h-8 text-sky-500/40 mx-auto" />
                <p className="text-xs text-sky-300/70">
                  Aucune clé de licence n'est encore enregistrée sur ce compte.
                </p>
                <p className="text-[11px] text-sky-400/60">
                  Utilisez les clés de test ci-contre ou saisissez une clé achetée.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {account.assignedLicenses.map((lic) => {
                  const isCurrentActive = subscription.product_key === lic.key;
                  return (
                    <div
                      key={lic.key}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrentActive
                          ? 'border-sky-400/60 bg-sky-500/15 shadow-md'
                          : 'border-sky-800/50 bg-[#071124]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">
                              {lic.key}
                            </span>
                            {isCurrentActive && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-400 text-slate-950">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-sky-300/70 mt-0.5">
                            {lic.notes || lic.plan_name} • Assignée le {lic.activatedAt}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            lic.plan === 'premium_lifetime'
                              ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                              : 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                          }`}
                        >
                          {lic.plan_name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-sky-800/30 text-xs">
                        {!isCurrentActive ? (
                          <button
                            onClick={() => handleSwitchActiveLicense(lic)}
                            className="text-xs font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 cursor-pointer"
                          >
                            Activer sur cette passerelle
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            En cours d'utilisation
                          </span>
                        )}

                        <button
                          onClick={() => handleRemoveLicense(lic.key)}
                          className="text-[11px] text-rose-400/70 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Détacher</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section d'Administration de Session & Déconnexion / Reconnexion */}
          <div className="rounded-3xl border border-sky-700/50 bg-gradient-to-br from-[#0c1833] via-[#09142b] to-[#060e1d] p-6 space-y-5 shadow-2xl shadow-sky-950/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sky-800/40 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Administration de Session & Données Locales
                  </h3>
                  <p className="text-[11px] text-sky-300/70">
                    Gestion de l'accès, déconnexion et purge du stockage local
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 self-start sm:self-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Session Active ({account.id || 'USR-LOCAL'})
              </span>
            </div>

            {/* État de la session actuelle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#060e1d] border border-sky-800/40 space-y-1">
                <div className="text-[10px] font-bold uppercase text-sky-400/80">Utilisateur Actif</div>
                <div className="font-bold text-white truncate">{account.name.trim() || 'Non Renseigné'}</div>
                <div className="text-[10px] text-sky-300/60 truncate">{account.email || 'Mode invité local'}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#060e1d] border border-sky-800/40 space-y-1">
                <div className="text-[10px] font-bold uppercase text-sky-400/80">Stockage Local (Navigateur)</div>
                <div className="font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5" />
                  localStorage Actif
                </div>
                <div className="text-[10px] text-sky-300/60">Profil & Licences persistés</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#060e1d] border border-sky-800/40 space-y-1">
                <div className="text-[10px] font-bold uppercase text-sky-400/80">Statut Passerelle</div>
                <div className="font-bold text-sky-200 truncate">{subscription.plan_name}</div>
                <div className="text-[10px] text-sky-300/60 font-mono">127.0.0.1:8090</div>
              </div>
            </div>

            {/* Actions principales d'administration */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2.5">
                {/* Bouton Se Déconnecter */}
                <button
                  onClick={() => setShowConfirmLogout(true)}
                  className="px-4 py-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se Déconnecter</span>
                </button>

                {/* Bouton Reconnexion / Changer d'utilisateur */}
                <button
                  onClick={() => {
                    if (onOpenAuthModal) onOpenAuthModal();
                  }}
                  className="px-4 py-2.5 rounded-2xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <LogIn className="w-4 h-4 text-sky-400" />
                  <span>Se Reconnecter / Changer de Compte</span>
                </button>
              </div>

              {/* Bouton Purger toutes les données locales */}
              <button
                onClick={() => setShowConfirmPurge(true)}
                className="px-3.5 py-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purger les données locales</span>
              </button>
            </div>

            {/* Boîte de confirmation de déconnexion */}
            {showConfirmLogout && (
              <div className="p-4 rounded-2xl border border-amber-500/60 bg-amber-950/40 text-xs text-amber-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-white text-sm">Confirmer la déconnexion ?</p>
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                      Vos identifiants locaux seront supprimés de cette machine. Vous serez immédiatement redirigé vers l'interface de reconnexion pour saisir ou créer un compte.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    onClick={() => setShowConfirmLogout(false)}
                    className="px-3 py-1.5 rounded-xl border border-sky-800 bg-[#060e1d] text-sky-300 hover:text-white text-xs cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmLogout(false);
                      if (onLogout) {
                        onLogout(false);
                      } else {
                        try {
                          localStorage.removeItem('nemapi_user_account');
                          localStorage.removeItem('nemapi_onboarded');
                        } catch (_) {}
                        if (onOpenAuthModal) onOpenAuthModal();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    Oui, se déconnecter
                  </button>
                </div>
              </div>
            )}

            {/* Boîte de confirmation de purge totale */}
            {showConfirmPurge && (
              <div className="p-4 rounded-2xl border border-rose-500/60 bg-rose-950/50 text-xs text-rose-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-white text-sm">Purger intégralement les données locales ?</p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                      Cette action supprimera toutes les clés API locales, l'historique de consommation, les licences en cache et vos informations de profil. La passerelle reviendra à son état initial d'installation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    onClick={() => setShowConfirmPurge(false)}
                    className="px-3 py-1.5 rounded-xl border border-sky-800 bg-[#060e1d] text-sky-300 hover:text-white text-xs cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmPurge(false);
                      if (onLogout) {
                        onLogout(true);
                      } else {
                        try {
                          localStorage.clear();
                        } catch (_) {}
                        window.location.reload();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs cursor-pointer shadow-md"
                  >
                    Confirmer la purge complète
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
