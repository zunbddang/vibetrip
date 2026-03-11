import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Globe, Lock, Trash2, ArrowRight, Share2 } from 'lucide-react';
import './Dashboard.css';
import ShareModal from './ShareModal';

const TripDashboard = ({ session, onSelectTrip }) => {
    const [trips, setTrips] = useState([]);
    const [newTripTitle, setNewTripTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [shareTrip, setShareTrip] = useState(null); // Trip being shared
    const [shareStatus, setShareStatus] = useState(null); // stores tripId of currently copied trip

    useEffect(() => {
        fetchTrips();
    }, [session]);

    const fetchTrips = async () => {
        try {
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('owner_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTrips(data || []);
        } catch (err) {
            console.error('Error fetching trips:', err);
        } finally {
            setLoading(false);
        }
    };

    const createTrip = async () => {
        if (!newTripTitle.trim()) {
            alert('여행 제목을 입력해주세요!');
            return;
        }
        setCreating(true);
        try {
            const { data, error } = await supabase
                .from('trips')
                .insert([{ title: newTripTitle, owner_id: session.user.id }])
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                setTrips([data[0], ...trips]);
                setNewTripTitle('');
            }
        } catch (err) {
            console.error('Create trip error:', err);
            alert('여행 생성 실패: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const togglePublic = async (trip) => {
        try {
            const { error } = await supabase
                .from('trips')
                .update({ is_public: !trip.is_public })
                .eq('id', trip.id);

            if (error) throw error;
            setTrips(trips.map(t => t.id === trip.id ? { ...t, is_public: !t.is_public } : t));
        } catch (err) {
            alert('설정 변경 실패');
        }
    };

    const deleteTrip = async (id) => {
        if (!window.confirm('정말 이 여행을 삭제할까요? 일정 데이터도 모두 삭제됩니다.')) return;
        try {
            const { error } = await supabase
                .from('trips')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTrips(trips.filter(t => t.id !== id));
        } catch (err) {
            alert('삭제 실패');
        }
    };

    const handleShare = (trip) => {
        setShareTrip(trip);
    };

    if (loading) return <div className="dashboard-loading">불러오는 중...</div>;

    return (
        <div className="dashboard-container fade-in">
            <header className="dashboard-header">
                <h1>나의 여행 목록</h1>
                <p>떠나고 싶은 여행을 만들고 공유해보세요</p>
            </header>

            <div className="create-trip-section">
                <input
                    type="text"
                    placeholder="어디로 떠나시나요? (예: 파리 일주일 여행)"
                    value={newTripTitle}
                    onChange={(e) => setNewTripTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createTrip()}
                />
                <button 
                    onClick={createTrip} 
                    className="create-btn" 
                    disabled={creating}
                >
                    {creating ? '생성 중...' : <><Plus size={20} /> 새 여행 만들기</>}
                </button>
            </div>

            <div className="trip-grid">
                {trips.length === 0 ? (
                    <div className="empty-trips">아직 등록된 여행이 없습니다.</div>
                ) : (
                    trips.map(trip => (
                        <div key={trip.id} className="trip-card">
                            <div className="trip-card-header">
                                <h3>{trip.title}</h3>
                                <div className="trip-meta">
                                    <span className={`status-badge ${trip.is_public ? 'public' : 'private'}`} onClick={() => togglePublic(trip)}>
                                        {trip.is_public ? <><Globe size={12} /> 공개</> : <><Lock size={12} /> 비공개</>}
                                    </span>
                                </div>
                            </div>
                            <div className="trip-card-actions">
                                <button className="select-trip-btn" onClick={() => onSelectTrip(trip)}>
                                    입장하기 <ArrowRight size={16} />
                                </button>
                                <button className="dashboard-share-btn" onClick={() => handleShare(trip)} title="공유하기">
                                    <Share2 size={16} />
                                </button>
                                <button className="delete-trip-btn" onClick={() => deleteTrip(trip.id)} title="삭제하기">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <ShareModal
                isOpen={!!shareTrip}
                onClose={() => setShareTrip(null)}
                tripTitle={shareTrip?.title}
                tripId={shareTrip?.id}
            />
        </div>
    );
};

export default TripDashboard;
