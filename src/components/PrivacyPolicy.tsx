import React from 'react';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  ServerOff,
  KeyRound,
  FileText,
  AlertTriangle,
  Scale,
  Coins,
  CheckCircle2,
} from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* En-tête moderne & Engagement */}
      <div className="rounded-3xl border border-sky-700/40 bg-gradient-to-br from-[#0c1833] to-[#071124] p-6 sm:p-7 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Politique de Confidentialité & Conditions d'Utilisation
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-sky-200/70">
            Transparence Totale, Souveraineté & Protection Juridique
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold text-xs">
            100% Hors-Ligne & Protégé
          </span>
        </div>
      </div>

      <div className="space-y-6 text-xs text-sky-100/90 leading-relaxed">
        {/* Résumé de Confiance Client */}
        <div className="rounded-3xl border border-sky-600/40 bg-sky-950/40 backdrop-blur-md p-6 sm:p-7 space-y-3">
          <div className="flex items-center gap-2.5 text-sky-300 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Pourquoi vous pouvez utiliser NemApi en toute sérénité :</span>
          </div>
          <ul className="space-y-2 text-sky-200/90 text-xs list-disc list-inside">
            <li><strong>Aucune interception</strong> : vos invites de prompt, codes sources, bases de données et fichiers ne transitent par aucun serveur distant propriétaire.</li>
            <li><strong>Zéro traçage publicitaire</strong> : pas de pixels espions, pas de cookies tiers, pas de revente de données.</li>
            <li><strong>Cadre juridique clair et sécurisé</strong> : vous restez l'unique propriétaire de votre environnement et de votre usage.</li>
          </ul>
        </div>

        {/* Section 1 : Nature du Logiciel et Rôle du Développeur */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              1. Nature de l'Outil et Rôle du Concepteur
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            NemApi est un logiciel client autonome distribué comme un utilitaire technique de pontage et de productivité local (passerelle locale d'écoute <code className="font-mono text-sky-300 bg-[#060e1d] px-2 py-0.5 rounded-lg border border-sky-800/60">127.0.0.1:8090</code>). Le créateur et mainteneur du logiciel agit exclusivement en tant qu'auteur technique indépendant et développeur d'outils logiciels d'assistance technique.
          </p>
        </div>

        {/* Section 2 : Destination des Frais d'Abonnement et Financement du Support */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              2. Destination des Frais de Licence et Modèle Économique
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            Les contributions financières, frais d'accès et souscriptions de clés de licence (Pro / Lifetime) <strong>ne constituent pas une offre commerciale spéculative ou un modèle de rentabilisation à vocation publicitaire</strong>. 
            Ils sont intégralement et exclusivement alloués à la couverture des coûts réels de développement continu, à la maintenance des connecteurs, à l'ingénierie logicielle, aux tests de compatibilité multi-OS, et à la garantie d'une stabilité technique et sécuritaire permanente de l'infrastructure logicielle au profit de ses utilisateurs.
          </p>
        </div>

        {/* Section 3 : Architecture Locale et Absence de Collecte de Données */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <ServerOff className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              3. Traitement 100% Local & Zéro Télémétrie Espionne
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            Le logiciel traite l'intégralité des flux et requêtes directement sur votre équipement informatique. Vos variables d'environnement, clés API locales, contenus textuels, requêtes de code et sessions de navigation demeurent confinées à votre machine. Le créateur n'a aucun accès technique, physique ou logique à vos données privées ou à vos échanges de prompt.
          </p>
        </div>

        {/* Section 4 : Exonération de Responsabilité et Autonomie de l'Utilisateur */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              4. Responsabilité & Absence de Charge Juridique sur le Créateur
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            L'utilisateur est le seul et unique gestionnaire de l'utilisation qu'il fait du logiciel, des requêtes envoyées, des fournisseurs tiers qu'il configure et des résultats générés. 
            Le créateur du logiciel fournit cet outil « en l'état » (as-is) pour faciliter la productivité de ses utilisateurs et <strong>ne saurait être tenu pour responsable, de manière directe ou indirecte</strong>, des éventuels litiges, interruptions de services tiers, usages non conformes ou dommages découlant de l'exploitation de l'application. Aucune charge juridique, contractuelle ou délictuelle ne peut être imputée au créateur du logiciel en relation avec les activités menées par l'utilisateur.
          </p>
        </div>

        {/* Section 5 : Sécurité des Clés de Produit et Authentification */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              5. Gestion Sécurisée des Clés de Licence
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            L'attribution et la vérification des clés de produit s'effectuent de façon cryptographique et sécurisée auprès de la base de validation dédiée. Ces opérations ont pour unique finalité l'activation des privilèges techniques et ne collectent aucun profil comportemental ou donnée non essentielle.
          </p>
        </div>

        {/* Section 6 : Engagement de Continuité et Évolutions */}
        <div className="rounded-3xl border border-sky-700/40 bg-[#0c1833]/85 backdrop-blur-md p-6 sm:p-7 space-y-3 shadow-xl shadow-sky-950/30">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              6. Garantie de Qualité et Évolution du Service
            </h3>
          </div>
          <p className="text-sky-200/80 leading-relaxed">
            En rejoignant la communauté d'utilisateurs NemApi, vous bénéficiez d'une suite logicielle continuellement optimisée pour vos flux de développement quotidiens (Cursor, Cline, Roo Code, Aider, scripts Python), conçue pour maximiser votre efficacité tout en préservant votre autonomie technologique absolue.
          </p>
        </div>
      </div>
    </div>
  );
};
