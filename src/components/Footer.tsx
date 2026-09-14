import React from 'react';

interface FooterProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  proxyConnected?: boolean;
  subscription?: any;
  account?: any;
  onOpenAuthModal?: () => void;
}

export const Footer: React.FC<FooterProps> = () => {
  // Le pied de page est épuré : suppression de toutes les indexations, liens et mentions
  return null;
};

