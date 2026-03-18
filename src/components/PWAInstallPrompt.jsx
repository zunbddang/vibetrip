import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-install-prompt-container">
      <div className="pwa-install-prompt-card">
        <div className="pwa-app-icon">
          <Download />
        </div>
        <div className="pwa-text-content">
          <h3 className="pwa-title">VibeTrip 설치하기</h3>
          <p className="pwa-description">홈 화면에 추가하고 더 편하게 기록하세요!</p>
        </div>
        <div className="pwa-actions">
          <button onClick={handleInstallClick} className="pwa-install-btn">
            설치
          </button>
          <button onClick={handleDismiss} className="pwa-close-btn">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
