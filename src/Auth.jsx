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

    return (
        <div className="auth-container fade-in">
            <div className="auth-card">
                <div className="auth-logo">✈️ Vibe Trip</div>
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
