import React from 'react';
import { X, Copy, ExternalLink } from 'lucide-react';
import './ShareModal.css';

const ShareModal = ({ isOpen, onClose, tripTitle, tripId }) => {
    if (!isOpen) return null;

    const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${tripId}`;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(`[VibeTrip] ${tripTitle} - 저의 여행 일정을 확인해보세요!`);

    const shareLinks = {
        kakao: `https://story.kakao.com/share?url=${encodedUrl}`,
        naver: `https://share.naver.com/web/shareView?url=${encodedUrl}&title=${encodedTitle}`,
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('링크가 복사되었습니다!');
        });
    };

    const openShare = (url) => {
        window.open(url, '_blank', 'width=600,height=600');
    };

    return (
        <div className="share-modal-overlay" onClick={onClose}>
            <div className="share-modal-content" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h3>여행 일정 공유하기</h3>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="share-trip-info">
                    <span className="share-trip-tag">Trip</span>
                    <h4>{tripTitle}</h4>
                </div>

                <div className="share-options-grid">
                    <button className="share-option kakao" onClick={() => openShare(shareLinks.kakao)}>
                        <div className="icon-circle">K</div>
                        <span>카카오톡</span>
                    </button>
                    <button className="share-option naver" onClick={() => openShare(shareLinks.naver)}>
                        <div className="icon-circle">N</div>
                        <span>네이버</span>
                    </button>
                    <button className="share-option instagram" onClick={handleCopyLink}>
                        <div className="icon-circle ig">IG</div>
                        <span>인스타그램</span>
                    </button>
                    <button className="share-option copy" onClick={handleCopyLink}>
                        <div className="icon-circle"><Copy size={18} /></div>
                        <span>링크 복사</span>
                    </button>
                </div>

                <div className="share-url-preview">
                    <input type="text" readOnly value={shareUrl} />
                    <button onClick={handleCopyLink}>복사</button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
