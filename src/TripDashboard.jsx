import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabase';
import { Plus, Globe, Lock, Trash2, ArrowRight, Share2, Search } from 'lucide-react';
import './Dashboard.css';
import ShareModal from './ShareModal';
import UserAvatar from './UserAvatar';

const TripDashboard = ({ session, onSelectTrip, onLogout, onUpdateProfile }) => {
    const [trips, setTrips] = useState([]);
    const [newTripTitle, setNewTripTitle] = useState('');
    const [sharedLink, setSharedLink] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [editTripId, setEditTripId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [addingShared, setAddingShared] = useState(false);
    const [shareTrip, setShareTrip] = useState(null); // Trip being shared
    const [shareStatus, setShareStatus] = useState(null); // stores tripId of currently copied trip
    const [participants, setParticipants] = useState({}); // tripId -> Set of names

    useEffect(() => {
        fetchTrips();
    }, [session]);

    const fetchTrips = async () => {
        try {
            // Get user's own trips
            const { data: ownData, error: ownError } = await supabase
                .from('trips')
                .select('*')
                .eq('owner_id', session.user.id)
                .order('created_at', { ascending: false });

            if (ownError) throw ownError;

            // Get shared trips from localStorage
            const sharedKeys = 'vibe-trip-shared-ids';
            const sharedIds = JSON.parse(localStorage.getItem(sharedKeys) || '[]');
            
            let sharedData = [];
            if (sharedIds.length > 0) {
                const { data: sData, error: sError } = await supabase
                    .from('trips')
                    .select('*')
                    .in('id', sharedIds)
                    .neq('owner_id', session.user.id); // Ensure we don't duplicate own trips
                
                if (!sError) sharedData = sData || [];
            }

            const allTrips = [...(ownData || []), ...sharedData];
            setTrips(allTrips);

            // Fetch participants (uploaders + members) for all these trips
            const tripIds = allTrips.map(t => t.id);
            if (tripIds.length > 0) {
                const [spotsRes, photosRes, membersRes] = await Promise.all([
                    supabase.from('spots').select('trip_id, uploader_name').in('trip_id', tripIds),
                    supabase.from('photos').select('trip_id, uploader_name').in('trip_id', tripIds),
                    supabase.from('trip_members').select('trip_id, user_name').in('trip_id', tripIds)
                ]);

                const participantMap = {};
                const processData = (data, nameKey) => {
                    data?.forEach(item => {
                        const name = item[nameKey];
                        if (!name || name === '익명') return;
                        if (!participantMap[item.trip_id]) participantMap[item.trip_id] = new Set();
                        participantMap[item.trip_id].add(name);
                    });
                };

                processData(spotsRes.data, 'uploader_name');
                processData(photosRes.data, 'uploader_name');
                processData(membersRes.data, 'user_name');
                
                // Convert Sets to Arrays for state
                const finalMap = {};
                Object.keys(participantMap).forEach(tid => {
                    finalMap[tid] = [...participantMap[tid]];
                });
                setParticipants(finalMap);
            }
        } catch (err) {
            console.error('Error fetching trips:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSharedLink = async () => {
        if (!sharedLink.trim()) {
            alert('공유 링크를 입력해주세요!');
            return;
        }

        try {
            setAddingShared(true);
            const url = new URL(sharedLink);
            const tripId = url.searchParams.get('trip');

            if (!tripId) {
                alert('올바른 공유 링크 형식이 아닙니다. (?trip=... 형식이 포함되어야 합니다)');
                return;
            }

            // Check if already in trips
            if (trips.some(t => String(t.id) === tripId)) {
                alert('이미 목록에 있는 여행입니다.');
                setSharedLink('');
                return;
            }

            // Verify trip exists in Supabase
            const { data, error } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single();

            if (error || !data) {
                alert('여행 정보를 찾을 수 없습니다. 링크를 다시 확인해주세요.');
                return;
            }

            // Save to localStorage
            const sharedKeys = 'vibe-trip-shared-ids';
            const storedIds = JSON.parse(localStorage.getItem(sharedKeys) || '[]');
            if (!storedIds.includes(tripId)) {
                localStorage.setItem(sharedKeys, JSON.stringify([...storedIds, tripId]));
            }

            // Also record in database trip_members if possible
            try {
                const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                await supabase
                    .from('trip_members')
                    .upsert([{ trip_id: tripId, user_id: session.user.id, user_name: userName }], { onConflict: 'trip_id,user_id' });
            } catch (e) {
                console.warn('Failed to record trip_member (table might not exist):', e);
            }

            // Refresh list
            fetchTrips();
            setSharedLink('');
            alert('여행 일정이 추가되었습니다!');
        } catch (err) {
            alert('링크 처리 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setAddingShared(false);
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
                const newTrip = data[0];
                
                // Also record owner as a member
                try {
                    const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
                    await supabase
                        .from('trip_members')
                        .upsert([{ trip_id: newTrip.id, user_id: session.user.id, user_name: userName }], { onConflict: 'trip_id,user_id' });
                } catch (e) {
                    console.warn('Failed to record owner as member:', e);
                }

                setTrips([newTrip, ...trips]);
                setNewTripTitle('');
            }
        } catch (err) {
            console.error('Create trip error:', err);
            alert('여행 생성 실패: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const saveRename = async (id) => {
        if (!editTitle.trim()) return setEditTripId(null);
        try {
            const { error } = await supabase
                .from('trips')
                .update({ title: editTitle })
                .eq('id', id);

            if (error) throw error;
            setTrips(trips.map(t => t.id === id ? { ...t, title: editTitle } : t));
            setEditTripId(null);
        } catch (err) {
            alert('제목 수정 실패');
        }
    };

    const togglePublic = async (trip) => {
        if (trip.owner_id !== session.user.id) return;
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

    const deleteTrip = async (trip) => {
        const isOwner = trip.owner_id === session.user.id;
        const confirmMsg = isOwner 
            ? '정말 이 여행을 삭제할까요? 일정 데이터도 모두 삭제됩니다.' 
            : '이 공유된 여행을 내 목록에서 제거할까요?';
            
        if (!window.confirm(confirmMsg)) return;

        if (isOwner) {
            try {
                const { error } = await supabase
                    .from('trips')
                    .delete()
                    .eq('id', trip.id);

                if (error) throw error;
                setTrips(trips.filter(t => t.id !== trip.id));
            } catch (err) {
                alert('삭제 실패');
            }
        } else {
            // Remove from localStorage
            const sharedKeys = 'vibe-trip-shared-ids';
            const storedIds = JSON.parse(localStorage.getItem(sharedKeys) || '[]');
            const updatedIds = storedIds.filter(id => id !== trip.id);
            localStorage.setItem(sharedKeys, JSON.stringify(updatedIds));
            setTrips(trips.filter(t => t.id !== trip.id));
        }
    };

    const handleShare = (trip) => {
        setShareTrip(trip);
    };

    const filteredTrips = trips
        .filter(trip => trip.title.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
            return new Date(a.created_at) - new Date(b.created_at);
        });

    if (loading) return <div className="dashboard-loading">불러오는 중...</div>;

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-welcome">
                <h1 className="dashboard-title">나의 여행 목록</h1>
                <p className="dashboard-subtitle">떠나고 싶은 여행을 만들고 공유해보세요</p>
            </div>

            <div className="dashboard-inputs">
                <div className="input-group">
                    <label>새 여행 만들기</label>
                    <div className="input-with-btn">
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
                            {creating ? '생성 중...' : <><Plus size={20} /> 만들기</>}
                        </button>
                    </div>
                </div>

                <div className="input-group">
                    <label>공유 링크로 추가하기</label>
                    <div className="input-with-btn">
                        <input
                            type="text"
                            placeholder="공유받은 링크를 붙여넣으세요"
                            value={sharedLink}
                            onChange={(e) => setSharedLink(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSharedLink()}
                        />
                        <button 
                            onClick={handleAddSharedLink} 
                            className="add-shared-btn" 
                            disabled={addingShared}
                        >
                            {addingShared ? '추가 중...' : <><Share2 size={20} /> 추가</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="dashboard-controls">
                <div className="search-box">
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="여행 제목 검색..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="newest">최신순</option>
                    <option value="oldest">오래된순</option>
                </select>
            </div>

            <div className="trip-grid">
                {filteredTrips.length === 0 ? (
                    <div className="empty-trips">
                        {searchTerm ? '검색 결과가 없습니다.' : '아직 등록된 여행이 없습니다.'}
                    </div>
                ) : (
                    filteredTrips.map(trip => {
                        const isOwner = trip.owner_id === session.user.id;
                        return (
                            <div key={trip.id} className="trip-card">
                                <div className="trip-card-header">
                                    {editTripId === trip.id ? (
                                        <input
                                            type="text"
                                            className="edit-title-input"
                                            value={editTitle}
                                            autoFocus
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => saveRename(trip.id)}
                                            onKeyPress={(e) => e.key === 'Enter' && saveRename(trip.id)}
                                        />
                                    ) : (
                                        <h3 onClick={() => {
                                            if (isOwner) {
                                                setEditTripId(trip.id);
                                                setEditTitle(trip.title);
                                            }
                                        }}>
                                            {trip.title}
                                        </h3>
                                    )}
                                    <div className="trip-meta">
                                        {isOwner ? (
                                            <span className={`status-badge ${trip.is_public ? 'public' : 'private'}`} onClick={() => togglePublic(trip)}>
                                                {trip.is_public ? <><Globe size={12} /> 공개</> : <><Lock size={12} /> 비공개</>}
                                            </span>
                                        ) : (
                                            <span className="status-badge shared">
                                                <Share2 size={12} /> 공유됨
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Participant Avatars */}
                                    {participants[trip.id] && participants[trip.id].length > 0 && (
                                        <div className="trip-participants-stack">
                                            {participants[trip.id].slice(0, 4).map((name, i) => (
                                                <div 
                                                    key={name} 
                                                    className="participant-avatar" 
                                                    title={name}
                                                    style={{ zIndex: 10 - i, backgroundColor: `hsl(${(name.length * 40) % 360}, 70%, 65%)` }}
                                                >
                                                  {name.charAt(0).toUpperCase()}
                                                </div>
                                            ))}
                                            {participants[trip.id].length > 4 && (
                                                <div className="participant-more">
                                                    +{participants[trip.id].length - 4}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="trip-card-actions">
                                    <button className="select-trip-btn" onClick={() => onSelectTrip(trip)}>
                                        입장하기 <ArrowRight size={16} />
                                    </button>
                                    <button className="dashboard-share-btn" onClick={() => handleShare(trip)} title="공유하기">
                                        <Share2 size={16} />
                                    </button>
                                    <button className="delete-trip-btn" onClick={() => deleteTrip(trip)} title={isOwner ? "삭제하기" : "목록에서 제거"}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
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
