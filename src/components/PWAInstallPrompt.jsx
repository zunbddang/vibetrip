import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      setIsVisible(true);
    }

    const handler = (e) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      // On PC/Android, always show the prompt if it's not already installed
      if (!isStandalone) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
       // iOS doesn't have a programmatic prompt
       return;
    }
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

  if (isIOS) {
    return (
      <div className="pwa-ios-prompt-container">
        <div className="pwa-ios-prompt-bubble">
          <div className="pwa-ios-content">
            <div className="pwa-app-icon small">
              <Download size={18} />
            </div>
            <div className="pwa-ios-text">
              <strong>VibeTrip 앱으로 설치하기</strong>
              <p>하단의 공유 버튼 <span className="ios-share-icon">⎙</span> 을 누르고 <strong>'홈 화면에 추가'</strong>를 선택하세요!</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="pwa-ios-close">✕</button>
          <div className="pwa-ios-arrow"></div>
        </div>
      </div>
    );
  }

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
