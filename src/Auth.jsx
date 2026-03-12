import React, { useState } from 'react';
import { supabase } from './supabase';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
    const [mode, setMode] = useState('login'); // login or signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('가입 확인 이메일을 보냈습니다! 메일을 확인해주세요.');
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.user) onAuthSuccess(data.user);
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
            });
            if (error) throw error;
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container fade-in">
            <div className="auth-card">
                <div className="auth-logo">VibeTrip ✨</div>
                <p className="auth-subtitle">나만의 여행을 기록하고 친구와 공유하세요</p>

                <form onSubmit={handleAuth} className="auth-form">
                    <input
                        type="email"
                        placeholder="이메일"
                        className="auth-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        className="auth-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>또는</span>
                </div>

                <button 
                    type="button" 
                    className="auth-google-btn" 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                        <path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.85 2.21c1.67-1.53 2.64-3.79 2.64-6.56Z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.85-2.21c-.79.53-1.8.85-3.11.85-2.39 0-4.41-1.61-5.14-3.77L1.01 13.9C2.48 16.33 5.3 18 9 18Z" fill="#34A853" />
                        <path d="M3.86 10.74c-.19-.56-.3-1.17-.3-1.74s.11-1.18.3-1.74L1.01 5.05C.37 6.24 0 7.59 0 9s.37 2.76 1.01 3.95l2.85-2.21Z" fill="#FBBC05" />
                        <path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.3 0 2.48 1.67 1.01 4.1L3.86 6.3c.73-2.16 2.75-3.77 5.14-3.77Z" fill="#EA4335" />
                    </svg>
                    Google로 로그인
                </button>

                {message && <p className="auth-message">{message}</p>}

                <div className="auth-toggle">
                    {mode === 'login' ? (
                        <p>계정이 없으신가요? <span onClick={() => setMode('signup')}>회원가입</span></p>
                    ) : (
                        <p>이미 계정이 있으신가요? <span onClick={() => setMode('login')}>로그인</span></p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Auth;
