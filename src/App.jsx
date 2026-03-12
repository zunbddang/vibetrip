import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Autocomplete
} from '@react-google-maps/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Home, Map as MapIcon, Image as ImageIcon, SquarePlus, Heart, MessageCircle, Bookmark, Download, MapPin, Share2, TableProperties, LocateFixed, Search, GripVertical, List, Camera, Upload, Square, CheckSquare, Trash2, Star } from 'lucide-react';
import './index.css';
import './Drawer.css';
import './Dashboard.css';
import { supabase } from './supabase';
import Auth from './Auth';
import TripDashboard from './TripDashboard';
import ShareModal from './ShareModal';

const DAY_COLORS = [
  '#ed4956', // Day 1: Red
  '#0095f6', // Day 2: Blue
  '#16a34a', // Day 3: Green
  '#f59e0b', // Day 4: Orange
  '#a855f7', // Day 5: Purple
  '#06b6d4', // Day 6: Cyan
  '#ec4899', // Day 7: Pink
];

const getDayColor = (day) => {
  if (!day || day < 1) return '#262626';
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
};

const SortableRow = ({ spot, handleUpdateSpot, handleDeleteRow }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: spot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="modern-sheet-row">
      <div className="row-drag" {...attributes} {...listeners}>
        <GripVertical size={16} color="#ccc" />
      </div>
      
      <div className="row-content">
        <div className="row-main-info">
          <div className="row-type-icon" title={spot.type}>
            {spot.type === 'food' ? <Heart size={16} fill="#ed4956" color="#ed4956" /> : 
             spot.type === 'hotel' ? <Home size={16} color="#0095f6" /> :
             spot.type === 'landmark' ? <MapPin size={16} color="#16a34a" /> :
             spot.type === 'transport' ? <LocateFixed size={16} color="#8e8e8e" /> :
             <MapPin size={16} />}
          </div>
          <input
            type="text"
            className="row-input-name"
            value={spot.name || ''}
            onChange={(e) => handleUpdateSpot(spot.id, 'name', e.target.value)}
            placeholder="장소명"
          />
          <button className="row-delete-btn" onClick={() => handleDeleteRow(spot.id)}>×</button>
        </div>
        
        <div className="row-sub-info">
          <div className="row-meta">
            <input
              type="number"
              className="row-input-day"
              value={spot.day || 1}
              onChange={(e) => handleUpdateSpot(spot.id, 'day', parseInt(e.target.value) || 1)}
            />
            <span className="row-day-label">일차</span>
            <input
              type="date"
              className="row-input-date"
              value={spot.date || ''}
              onChange={(e) => handleUpdateSpot(spot.id, 'date', e.target.value)}
            />
          </div>
          <input
            type="text"
            className="row-input-memo"
            value={spot.memo || ''}
            onChange={(e) => handleUpdateSpot(spot.id, 'memo', e.target.value)}
            placeholder="상세 메모"
          />
        </div>
      </div>
    </div>
  );
};

const GALLERY_DATA = [
  { id: 1, url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80", user: "Dad" },
  { id: 2, url: "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=400&q=80", user: "Mom" },
  { id: 3, url: "https://images.unsplash.com/photo-1431274172761-fca41d93e114?auto=format&fit=crop&w=400&q=80", user: "Sister" },
  { id: 4, url: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=400&q=80", user: "Dad" },
  { id: 5, url: "https://images.unsplash.com/photo-1503917988258-f19178c1ef5b?auto=format&fit=crop&w=400&q=80", user: "Brother" },
  { id: 6, url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=400&q=80", user: "Mom" }
];

const LIBRARIES = ["places"];

const App = () => {
  const [session, setSession] = useState(null);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [activeTab, setActiveTab] = useState('feed');
  const [selectedDay, setSelectedDay] = useState(null); // null for 'All'
  const [tripSpots, setTripSpots] = useState([]);
  const [tripPhotos, setTripPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]); // For batch download
  const [searchedPlace, setSearchedPlace] = useState(null);
  const [map, setMap] = useState(null);
  const [formInput, setFormInput] = useState({
    day: 1,
    date: new Date().toISOString().split('T')[0],
    type: 'itinerary',
    memo: '',
    rating: null,
    reviews: null,
    phone: null,
    openingHours: null
  });
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 48.8566, lng: 2.3522 });
  const [mapZoom, setMapZoom] = useState(12);
  const [userLocation, setUserLocation] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const mapSearchRef = useRef(null);

  // Handle URL Sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedTripId = params.get('trip');
    if (sharedTripId) {
      const fetchSharedTrip = async (id) => {
        setIsLoading(true);
        try {
          const { data, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', id)
            .single();
          if (error) throw error;
          setCurrentTrip(data);

          // Save to shared trips in localStorage if logged in and not owner
          const currentSession = await supabase.auth.getSession();
          const userId = currentSession.data.session?.user?.id;
          if (userId && data.owner_id !== userId) {
            const sharedKeys = 'vibe-trip-shared-ids';
            const storedIds = JSON.parse(localStorage.getItem(sharedKeys) || '[]');
            if (!storedIds.includes(id)) {
              localStorage.setItem(sharedKeys, JSON.stringify([...storedIds, id]));
            }
          }
        } catch (err) {
          console.error('Error fetching shared trip:', err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSharedTrip(sharedTripId);
    }
  }, []);

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription?.unsubscribe();
  }, []);

  // Fetch spots when trip is selected
  useEffect(() => {
    if (!currentTrip) {
      setTripSpots([]);
      setTripPhotos([]);
      return;
    }
    const fetchSpots = async () => {
      setIsLoading(true);
      const { data: spots, error: spotsError } = await supabase
        .from('spots')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('day', { ascending: true })
        .order('order_index', { ascending: true })
        .order('id', { ascending: true });

      if (spotsError) {
        console.error('Error fetching spots:', spotsError);
      } else {
        const processedSpots = (spots || []).map(s => ({
          ...s,
          photoUrl: s.photo_url,
          isLiked: s.is_liked || false,
          isBookmarked: s.is_bookmarked || false,
          comments: s.comments || [],
          orderIndex: s.order_index || 0,
          uploaderName: s.uploader_name || '익명'
        }));
        setTripSpots(processedSpots);
        if (processedSpots.length > 0) {
          setMapCenter({ lat: processedSpots[0].lat, lng: processedSpots[0].lng });
          setMapZoom(13);
        }
      }

      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .eq('trip_id', currentTrip.id)
        .order('created_at', { ascending: false });

      if (photosError) {
        console.error('Error fetching photos:', photosError);
      } else {
        setTripPhotos(photos || []);
      }
      setIsLoading(false);
    };
    fetchSpots();

    // Real-time Subscription for spots
    const spotsChannel = supabase
      .channel(`spots-at-${currentTrip.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spots',
          filter: `trip_id=eq.${currentTrip.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSpot = {
              ...payload.new,
              photoUrl: payload.new.photo_url,
              isLiked: payload.new.is_liked,
              isBookmarked: payload.new.is_bookmarked,
              comments: payload.new.comments || [],
              orderIndex: payload.new.order_index || 0,
              uploaderName: payload.new.uploader_name || '익명'
            };
            setTripSpots(prev => {
              if (prev.find(s => s.id === newSpot.id)) return prev;
              return [...prev, newSpot].sort((a, b) => {
                if (a.day !== b.day) return a.day - b.day;
                if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
                return a.id - b.id;
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedSpot = {
              ...payload.new,
              photoUrl: payload.new.photo_url,
              isLiked: payload.new.is_liked,
              isBookmarked: payload.new.is_bookmarked,
              comments: payload.new.comments || [],
              orderIndex: payload.new.order_index || 0,
              uploaderName: payload.new.uploader_name || '익명'
            };
            setTripSpots(prev => prev.map(s => s.id === updatedSpot.id ? updatedSpot : s).sort((a, b) => {
              if (a.day !== b.day) return a.day - b.day;
              if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
              return a.id - b.id;
            }));
          } else if (payload.eventType === 'DELETE') {
            setTripSpots(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const photosChannel = supabase
      .channel(`photos-at-${currentTrip.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos',
          filter: `trip_id=eq.${currentTrip.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTripPhotos(prev => {
              if (prev.find(p => p.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setTripPhotos(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const tripChannel = supabase
      .channel(`trip-meta-${currentTrip.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${currentTrip.id}`
        },
        (payload) => {
          setCurrentTrip(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(spotsChannel);
      supabase.removeChannel(photosChannel);
      supabase.removeChannel(tripChannel);
    };
  }, [currentTrip]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !session?.user?.id) return;

    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('trip-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trip-photos')
        .getPublicUrl(filePath);

      const uploaderName = session.user.email.split('@')[0];
      setSelectedSpot(prev => ({ ...prev, photoUrl: publicUrl, uploaderName }));
      // If it's an existing spot, sync immediately
      if (selectedSpot && !String(selectedSpot.id).startsWith('temp-')) {
        syncSpot({ ...selectedSpot, photoUrl: publicUrl, uploaderName });
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      let errorMsg = '이미지 업로드에 실패했습니다.';
      if (err.message.includes('storage/quota-exceeded')) errorMsg = '저장 공간이 부족합니다.';
      else if (err.message.includes('auth')) errorMsg = '인증 세션이 만료되었습니다. 다시 로그인해주세요.';
      alert(errorMsg + '\n(Error: ' + err.message + ')');
    } finally {
      setIsLoading(false);
    }
  };

  const isReadOnly = currentTrip && session?.user?.id !== currentTrip.owner_id;

  const syncSpot = async (spot) => {
    // Only authenticated users can sync to the database
    if (!currentTrip || !session?.user?.id) return;
    
    // Check if the spot already exists in the database (to handle ownership and IDs)
    const isPermanentId = spot.id && !String(spot.id).startsWith('temp-');

    // Sanitize: Only send fields that exist in our database schema
    const dbSpot = {
      name: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      type: spot.type,
      memo: spot.memo,
      photo_url: spot.photoUrl || null,
      day: spot.day || 1,
      date: spot.date,
      trip_id: currentTrip.id,
      is_liked: spot.isLiked || false,
      is_bookmarked: spot.isBookmarked || false,
      comments: spot.comments || [],
      order_index: spot.orderIndex || 0,
      uploader_name: spot.uploaderName || session.user.email.split('@')[0]
    };

    // If it's an update, preserve the original uploader's user_id
    // If it's a new spot, set the current user as owner
    if (isPermanentId) {
      dbSpot.id = spot.id;
      // Note: We don't overwrite user_id on update to preserve original uploader
    } else {
      dbSpot.user_id = session.user.id;
    }

    try {
      const { data, error } = await supabase
        .from('spots')
        .upsert(dbSpot, { onConflict: 'id' })
        .select();

      if (error) throw error;

      // If it's a new spot, update its ID in local state with the DB-assigned ID
      if (data && data[0] && !isPermanentId) {
        setTripSpots(prev => prev.map(s => s.id === spot.id ? { ...s, id: data[0].id, user_id: data[0].user_id } : s));
      }
    } catch (err) {
      console.error('Error syncing spot:', err);
      alert('일정 저장 실패: ' + err.message);
    }
  };

  useEffect(() => {
    if (selectedSpot && !String(selectedSpot.id).startsWith('temp-')) {
      setFormInput({
        day: selectedSpot.day || 1,
        date: selectedSpot.date || new Date().toISOString().split('T')[0],
        type: selectedSpot.type || 'itinerary',
        memo: selectedSpot.memo || '',
        rating: selectedSpot.rating || null,
        reviews: selectedSpot.reviews || null,
        phone: selectedSpot.phone || null,
        openingHours: selectedSpot.openingHours || null
      });
    }
  }, [selectedSpot]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleShare = () => {
    if (currentTrip) setIsShareModalOpen(true);
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex(prev => (prev + 1) % tripPhotos.length);
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => (prev - 1 + tripPhotos.length) % tripPhotos.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, tripPhotos]);

  const handleCenterOnMe = () => {
    if (userLocation && map) {
      map.panTo(userLocation);
      map.setZoom(15);
    }
  };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
    language: "ko"
  });

  const onMapSearchLoad = (autocomplete) => { mapSearchRef.current = autocomplete; };
  const onMapPlaceChanged = () => {
    if (mapSearchRef.current !== null) {
      const place = mapSearchRef.current.getPlace();
      if (place?.geometry) {
        let photoUrl = null;
        if (place.photos && place.photos.length > 0) {
          photoUrl = place.photos[0].getUrl({ maxWidth: 600, maxHeight: 600 });
        }
        const tempId = 'temp-' + Date.now();
        const newPlace = {
          id: tempId,
          name: place.name, // Will be localized (Korean)
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          type: "itinerary",
          memo: place.formatted_address,
          photoUrl: photoUrl,
          day: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].day : 1,
          date: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].date : new Date().toISOString().split('T')[0]
        };
        setSearchedPlace(newPlace);
        setSelectedSpot(newPlace);

        // Fetch English name in background to enrichment search result
        if (place.place_id && window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ placeId: place.place_id, language: 'en' }, (resultsEn, statusEn) => {
            if (statusEn === "OK" && resultsEn && resultsEn[0]) {
              const enResult = resultsEn.find(r => r.types.includes('point_of_interest') || r.types.includes('establishment')) || resultsEn[0];
              const enPoi = enResult.address_components.find(c =>
                c.types.includes("point_of_interest") || c.types.includes("establishment") ||
                c.types.includes("premise") || c.types.includes("natural_feature") ||
                c.types.includes("park") || c.types.includes("airport")
              );
              const enName = enPoi ? enPoi.long_name : enResult.formatted_address.split(',')[0].trim();

              if (enName && enName !== place.name) {
                const dualName = `${place.name} (${enName})`;
                setSelectedSpot(prev => {
                  if (prev && prev.id === tempId) return { ...prev, name: dualName };
                  return prev;
                });
                setSearchedPlace(prev => {
                  if (prev && prev.id === tempId) return { ...prev, name: dualName };
                  return prev;
                });
              }
            }
          });
        }

        const newPos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        if (place.geometry.viewport) {
          map?.fitBounds(place.geometry.viewport);
          setMapCenter(newPos);
        } else {
          map?.panTo(newPos);
          setMapCenter(newPos);
          setMapZoom(15);
        }
      }
    }
  };

  const onMapClick = (e) => {
    if (isReadOnly) return;

    // If user clicked on a POI (Place of Interest)
    if (e.placeId) {
      if (e.stop) e.stop(); // Prevent default Google Maps InfoWindow

      const tempId = 'temp-' + Date.now();
      setSelectedSpot({
        id: tempId,
        name: "장소 정보 불러오는 중...",
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        type: "itinerary",
        memo: "상세 정보를 가져오고 있습니다...",
        day: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].day : 1,
        date: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].date : new Date().toISOString().split('T')[0]
      });

      const service = new window.google.maps.places.PlacesService(map);
      service.getDetails({ placeId: e.placeId, language: 'ko' }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          // Fetch English name too
          service.getDetails({ placeId: e.placeId, language: 'en' }, (placeEn, statusEn) => {
            let finalName = place.name;
            if (statusEn === "OK" && placeEn && placeEn.name !== place.name) {
              finalName = `${place.name} (${placeEn.name})`;
            }

            let photoUrl = null;
            if (place.photos && place.photos.length > 0) {
              photoUrl = place.photos[0].getUrl({ maxWidth: 600, maxHeight: 600 });
            }

            setSelectedSpot(prev => {
              if (prev && prev.id === tempId) {
                return {
                  ...prev,
                  name: finalName,
                  memo: place.formatted_address,
                  photoUrl: photoUrl,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                  rating: place.rating,
                  reviews: place.user_ratings_total,
                  phone: place.formatted_phone_number,
                  openingHours: place.opening_hours?.weekday_text
                };
              }
              return prev;
            });
          });
        }
      });
      return;
    }

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    const tempId = 'temp-' + Date.now();
    const tempSpot = {
      id: tempId,
      name: "장소 확인 중...",
      lat,
      lng,
      type: "itinerary",
      memo: "위치 정보를 불러오는 중입니다...",
      day: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].day : 1,
      date: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].date : new Date().toISOString().split('T')[0]
    };

    setSelectedSpot(tempSpot);
    setSearchedPlace(null);

    // Dual-language Reverse Geocoding for coordinates
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();

      const fetchName = (lang) => new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng }, language: lang }, (results, status) => {
          if (status === "OK" && results && results.length > 0) {
            const result = results.find(r => r.types.includes('point_of_interest') || r.types.includes('establishment')) || results[0];
            let name = "";
            const poi = result.address_components.find(c =>
              c.types.includes("point_of_interest") || c.types.includes("establishment") ||
              c.types.includes("premise") || c.types.includes("natural_feature") ||
              c.types.includes("park") || c.types.includes("airport")
            );
            name = poi ? poi.long_name : result.formatted_address.split(',')[0].trim();
            resolve({ name, address: result.formatted_address });
          } else {
            resolve(null);
          }
        });
      });

      Promise.all([fetchName('ko'), fetchName('en')]).then(([koRes, enRes]) => {
        let finalName = "지도상 지점";
        let finalMemo = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        if (koRes) {
          finalName = koRes.name;
          finalMemo = koRes.address;
          if (enRes && enRes.name && enRes.name !== koRes.name) {
            // Check if names are actually different (not just same name in different script if possible, 
            // but usually this is what "병기" means)
            finalName = `${koRes.name} (${enRes.name})`;
          }
        } else if (enRes) {
          finalName = enRes.name;
          finalMemo = enRes.address;
        }

        setSelectedSpot(prev => {
          if (prev && prev.id === tempId) {
            return { ...prev, name: finalName, memo: finalMemo };
          }
          return prev;
        });
      });
    }
  };

  const handleUpdateSpot = (id, field, value) => {
    // If the user isn't logged in, they can't save anything permanently.
    // Locally it will still update in the state.
    
    let updatedSpot = null;
    setTripSpots(prev => {
      return prev.map(s => {
        if (s.id === id) {
          updatedSpot = { ...s, [field]: value };
          return updatedSpot;
        }
        return s;
      });
    });

    // We use a small trick: if updatedSpot is still null (e.g. state was set but not yet updated),
    // we find it directly from the current tripSpots.
    // But since we are doing this synchronously, updatedSpot SHOULD be set if id matched.
    if (!updatedSpot) {
      const current = tripSpots.find(s => s.id === id);
      if (current) updatedSpot = { ...current, [field]: value };
    }

    if (updatedSpot && session?.user?.id) {
      syncSpot(updatedSpot);
    }
  };

  const handleToggleLike = (id) => {
    // Local state update is allowed for everyone. 
    // handleUpdateSpot will check for session before calling syncSpot.
    const spot = tripSpots.find(s => s.id === id);
    if (spot) {
      handleUpdateSpot(id, 'isLiked', !spot.isLiked);
    }
  };

  const handleToggleBookmark = (id) => {
    // Local state update is allowed for everyone.
    const spot = tripSpots.find(s => s.id === id);
    if (spot) {
      handleUpdateSpot(id, 'isBookmarked', !spot.isBookmarked);
    }
  };

  const handleAddComment = (spotId, text) => {
    if (!session?.user?.id || !text.trim()) return;
    const spot = tripSpots.find(s => s.id === spotId);
    if (spot) {
      const newComment = {
        id: Date.now(),
        userId: session.user.id,
        userName: session.user.email.split('@')[0],
        text: text,
        createdAt: new Date().toISOString()
      };
      handleUpdateSpot(spotId, 'comments', [...(spot.comments || []), newComment]);
    }
  };

  const handleEditComment = (spotId, commentId, newText) => {
    const spot = tripSpots.find(s => s.id === spotId);
    if (spot) {
      const updatedComments = spot.comments.map(c =>
        c.id === commentId && c.userId === session?.user?.id ? { ...c, text: newText } : c
      );
      handleUpdateSpot(spotId, 'comments', updatedComments);
    }
  };

  const handleDeleteComment = (spotId, commentId) => {
    const spot = tripSpots.find(s => s.id === spotId);
    if (spot) {
      const updatedComments = spot.comments.filter(c =>
        !(c.id === commentId && c.userId === session?.user?.id)
      );
      handleUpdateSpot(spotId, 'comments', updatedComments);
    }
  };

  const handleOptimizeRoute = (day) => {
    if (isReadOnly) return;
    
    const daySpots = tripSpots.filter(s => s.day === day);
    if (daySpots.length <= 2) return; // Nothing to optimize for 1 or 2 spots

    const optimized = [];
    let remaining = [...daySpots];
    
    // Start with the first spot in the current order
    let current = remaining.shift();
    optimized.push(current);

    const getDist = (a, b) => {
      return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
    };

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minOrderDist = getDist(current, remaining[0]);
      
      for (let i = 1; i < remaining.length; i++) {
        const d = getDist(current, remaining[i]);
        if (d < minOrderDist) {
          minOrderDist = d;
          nearestIdx = i;
        }
      }
      
      current = remaining.splice(nearestIdx, 1)[0];
      optimized.push(current);
    }

    // Update orderIndex for each spot and sync
    optimized.forEach((spot, idx) => {
      const updated = { ...spot, orderIndex: idx };
      setTripSpots(prev => prev.map(s => s.id === spot.id ? updated : s));
      syncSpot(updated);
    });
    
    alert(`Day ${day} 동선이 최단 거리로 최적화되었습니다! ✨`);
  };

  const handleDeleteRow = async (id) => {
    if (isReadOnly) return;
    try {
      const { error } = await supabase.from('spots').delete().eq('id', id);
      if (error) throw error;
      setTripSpots(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRow = () => {
    if (isReadOnly) return;
    const newSpot = {
      id: 'temp-' + Date.now(),
      day: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].day : 1,
      date: tripSpots.length > 0 ? tripSpots[tripSpots.length - 1].date : new Date().toISOString().split('T')[0],
      name: "새로운 장소",
      lat: mapCenter.lat,
      lng: mapCenter.lng,
      type: 'itinerary',
      memo: '',
      isLiked: false,
      likedCount: 0,
      comments: [],
      isBookmarked: false
    };
    setTripSpots(prev => [...prev, newSpot]);
    syncSpot(newSpot);
  };

  const groupSpotsByDay = useMemo(() => {
    const groups = {};
    tripSpots.forEach(spot => {
      if (!groups[spot.day]) groups[spot.day] = { day: spot.day, date: spot.date, spots: [] };
      groups[spot.day].spots.push(spot);
    });
    
    let result = Object.values(groups).sort((a, b) => a.day - b.day);
    
    if (selectedDay !== null) {
      result = result.filter(g => g.day === selectedDay);
    }
    
    return result;
  }, [tripSpots, selectedDay]);

  const uniqueDays = useMemo(() => {
    const days = [...new Set((tripSpots || []).map(s => Number(s.day)))].filter(d => !isNaN(d) && d !== null);
    return days.sort((a, b) => a - b);
  }, [tripSpots]);

  const participants = useMemo(() => {
    const names = new Set();
    // Add owner to participants list
    if (currentTrip?.owner_id) {
        // We might not have the email easily, but we can at least show 'Owner' or fetch it.
        // For now, let's stick to uploaders from spots/photos as primary.
    }
    tripSpots.forEach(s => s.uploaderName && names.add(s.uploaderName));
    tripPhotos.forEach(p => p.uploader_name && names.add(p.uploader_name));
    return [...names].filter(n => n && n !== '익명');
  }, [tripSpots, tripPhotos, currentTrip]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    // Removed setCurrentTrip(null) to keep trip visible after logout
  };

  const handleDownloadPhoto = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'vibe-trip-photo.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const togglePhotoSelection = (id) => {
    setSelectedPhotos(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleDeletePhoto = async (photo) => {
    if (isReadOnly) return;
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase.from('photos').delete().eq('id', photo.id);
      if (error) throw error;
      setTripPhotos(prev => prev.filter(p => p.id !== photo.id));
      setSelectedPhotos(prev => prev.filter(id => id !== photo.id));
    } catch (err) {
      console.error('Delete photo failed:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleBatchDownload = async () => {
    if (selectedPhotos.length === 0) return;
    setIsLoading(true);
    for (const photoId of selectedPhotos) {
      const photo = tripPhotos.find(p => p.id === photoId);
      if (photo?.url) {
        await handleDownloadPhoto(photo.url, `trip-photo-${photoId}.jpg`);
        await new Promise(r => setTimeout(r, 300));
      }
    }
    setIsLoading(false);
    setSelectedPhotos([]);
    alert(`${selectedPhotos.length}개의 사진 다운로드가 시작되었습니다.`);
  };

  const handleBackToDashboard = () => {
    setCurrentTrip(null);
    const url = new URL(window.location);
    url.searchParams.delete('trip');
    window.history.pushState({}, '', url);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setTripSpots((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(items, oldIndex, newIndex);
          
          // Re-calibrate orderIndex for ALL items to be safe, 
          // or at least those in the same group. 
          // For simplicity and reliability, we sync the moved items.
          const updatedItems = newItems.map((item, index) => ({
            ...item,
            orderIndex: index
          }));

          // Only sync those that actually changed or just the affected range.
          // For now, syncing the ones that were moved is good.
          // But to be 100% sure the DB matches the UI:
          if (!isReadOnly) {
            updatedItems.forEach((item, idx) => {
              // We only sync if the orderIndex actually changed or it's the active/over item
              if (items[idx]?.id !== updatedItems[idx]?.id || items[idx]?.orderIndex !== idx) {
                syncSpot(updatedItems[idx]);
              }
            });
          }
          
          return updatedItems;
        }
        return items;
      });
    }
  };

  if (!session && !currentTrip) return <Auth onAuthSuccess={(user) => setSession({ user })} />;

  if (session && !currentTrip) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1 className="logo">VibeTrip ✨</h1>
          <button className="logout-btn" onClick={handleLogout}>로그아웃</button>
        </header>
        <TripDashboard session={session} onSelectTrip={(trip) => setCurrentTrip(trip)} />
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          tripTitle={currentTrip?.title || "나의 여행"}
          tripId={currentTrip?.id}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {session && <button className="back-btn" onClick={handleBackToDashboard}><List size={20} /></button>}
          <h1 className="logo" onClick={() => setActiveTab('feed')}>{currentTrip?.title || 'VibeTrip ✨'}</h1>
        </div>
        <div className="header-right">
          {participants.length > 0 && (
            <div className="participants-list" title="참여 중인 친구들">
              {participants.map(name => (
                <div key={name} className="participant-dot" title={name}>
                  {name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}
          {session ? (
            <button className="logout-btn" onClick={handleLogout} style={{ marginRight: '10px', fontSize: '13px', border: 'none', background: 'none', color: '#8e8e8e', cursor: 'pointer' }}>로그아웃</button>
          ) : (
            <button className="login-btn" onClick={handleBackToDashboard} style={{ marginRight: '10px', fontSize: '13px', border: 'none', background: '#0095f6', color: 'white', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>로그인</button>
          )}
          {currentTrip && (
            <button className="share-icon-btn" onClick={handleShare}>
              <Share2 size={20} />
            </button>
          )}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && <div className="loading-overlay"><div className="spinner"></div><span>불러오는 중...</span></div>}

        {currentTrip && tripSpots.length > 0 && activeTab !== 'gallery' && (
          <div className="day-selector-container">
            <button 
              className={`day-tab ${selectedDay === null ? 'active' : ''}`} 
              onClick={() => setSelectedDay(null)}
            >
              전체
            </button>
            {uniqueDays.map(day => (
              <button 
                key={day} 
                className={`day-tab ${selectedDay === day ? 'active' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                Day {day}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="feed-container fade-in">
            {groupSpotsByDay.length === 0 ? (
              <div className="empty-feed-container">
                <div className="empty-feed-icon">📔</div>
                <h2 className="empty-feed-title">아직 여행 일정이 없어요!</h2>
                <p className="empty-feed-text">
                  하단의 <b>Map</b> 탭에서 가고 싶은 장소를 찍거나,<br />
                  <b>Sheet</b> 탭에서 일정을 짜보세요! ✨
                </p>
                <div className="empty-feed-hint">
                  지도를 툭 누르면 장소 정보가 숑- 하고 나타나요 🪄
                </div>
              </div>
            ) : (() => {
              let globalIndex = 0;
              return groupSpotsByDay.map((dayData) => (
                <div key={dayData.day}>
                  <div className="date-badge">Day {dayData.day} • {dayData.date}</div>
                  {dayData.spots.map((spot) => {
                    globalIndex++;
                    const currentIndex = globalIndex;
                    return (
                      <div key={spot.id} className="post-card">
                        <div className="post-header">
                          <div className="post-avatar">{currentIndex}</div>
                          <div className="post-username">{spot.name}</div>
                        </div>
                        <div className="post-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                          {spot.photoUrl ? <img src={spot.photoUrl} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MapPin size={48} color="#ccc" />}
                        </div>
                        <div className="post-actions">
                          <Heart
                            size={24}
                            className={`action-icon ${spot.isLiked ? 'liked' : ''}`}
                            onClick={() => handleToggleLike(spot.id)}
                            fill={spot.isLiked ? "#ed4956" : "none"}
                            color={spot.isLiked ? "#ed4956" : "currentColor"}
                          />
                          <MessageCircle size={24} className="action-icon" onClick={() => {
                            const input = document.getElementById(`comment-input-${spot.id}`);
                            if (input) input.focus();
                          }} />
                          <Bookmark
                            size={24}
                            className={`action-icon ${spot.isBookmarked ? 'bookmarked' : ''}`}
                            onClick={() => handleToggleBookmark(spot.id)}
                            fill={spot.isBookmarked ? "#0095f6" : "none"}
                            color={spot.isBookmarked ? "#0095f6" : "currentColor"}
                            style={{ marginLeft: 'auto' }}
                          />
                        </div>
                        <div className="post-caption">
                          <div className="caption-content">
                            <span className="post-username-small">{spot.name}</span>
                            <span className="type-tag-mini">
                              {spot.type === 'food' ? '🍴 맛집' : 
                               spot.type === 'hotel' ? '🏨 숙소' :
                               spot.type === 'landmark' ? '📍 관광' :
                               spot.type === 'transport' ? '🚌 교통' : '📍 일정'}
                            </span>
                            <div className="memo-text">{spot.memo}</div>
                          </div>

                          {/* Comments Section */}
                          <div className="comments-list">
                            {(spot.comments || []).map(comment => (
                              <div key={comment.id} className="comment-item">
                                <span className="comment-user">{comment.userName}</span>
                                <span className="comment-text">{comment.text}</span>
                                {comment.userId === session?.user?.id && (
                                  <div className="comment-ops">
                                    <button onClick={() => {
                                      const newText = prompt('댓글 수정:', comment.text);
                                      if (newText) handleEditComment(spot.id, comment.id, newText);
                                    }}>수정</button>
                                    <button onClick={() => handleDeleteComment(spot.id, comment.id)}>삭제</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {session ? (
                            <div className="comment-input-area">
                              <input
                                id={`comment-input-${spot.id}`}
                                className="comment-input"
                                placeholder="댓글 달기..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.target.value.trim()) {
                                    handleAddComment(spot.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="comment-input-area guest">
                              <p className="login-hint" onClick={handleBackToDashboard} style={{ fontSize: '12px', color: '#8e8e8e', textAlign: 'center', cursor: 'pointer', margin: '8px 0' }}>로그인하고 댓글을 남겨보세요! 💬</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}

        {activeTab === 'map' && (
          <div className="map-view-container fade-in">
            <div className={`map-wrapper ${isLoaded ? 'loaded' : ''}`}>
              <div className="map-search-overlay">
                <Autocomplete onLoad={onMapSearchLoad} onPlaceChanged={onMapPlaceChanged}>
                  <div className="map-search-box">
                    <Search size={18} color="#8e8e8e" />
                    <input
                      type="text"
                      placeholder="장소 검색 및 일정 추가..."
                      className="map-search-input"
                      disabled={isReadOnly}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const pacContainer = document.querySelector('.pac-container');
                          if (pacContainer && pacContainer.style.display !== 'none') {
                            const firstItem = pacContainer.querySelector('.pac-item');
                            if (firstItem) {
                              const downArrow = new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, which: 40, bubbles: true });
                              const enter = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true });
                              e.target.dispatchEvent(downArrow);
                              e.target.dispatchEvent(enter);
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </Autocomplete>
              </div>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={mapZoom}
                onLoad={m => setMap(m)}
                onClick={onMapClick}
                onDragEnd={() => map && setMapCenter({ lat: map.getCenter().lat(), lng: map.getCenter().lng() })}
                onZoomChanged={() => map && setMapZoom(map.getZoom())}
                options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: true }}
              >
                {tripSpots.filter(s => selectedDay === null || s.day === selectedDay).map((spot, idx) => (
                  <Marker
                    key={spot.id}
                    position={{ lat: spot.lat, lng: spot.lng }}
                    label={{ text: String(idx + 1), color: "white", fontWeight: "bold" }}
                    icon={(window.google && window.google.maps) ? {
                      path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
                      fillColor: getDayColor(spot.day),
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: "white",
                      scale: 1,
                      labelOrigin: new window.google.maps.Point(0, -30)
                    } : undefined}
                    onClick={() => {
                      setSelectedSpot(spot);
                      setSearchedPlace(null);

                      // Enrichment: If it doesn't look like dual language, try to fetch
                      if (window.google && window.google.maps && !spot.name.includes('(')) {
                        const geocoder = new window.google.maps.Geocoder();
                        const fetchN = (lang) => new Promise(r => {
                          geocoder.geocode({ location: { lat: spot.lat, lng: spot.lng }, language: lang }, (res, stat) => {
                            if (stat === "OK" && res?.[0]) {
                              const result = res.find(r => r.types.includes('point_of_interest') || r.types.includes('establishment')) || res[0];
                              const poi = result.address_components.find(c =>
                                c.types.includes("point_of_interest") || c.types.includes("establishment")
                              );
                              r(poi ? poi.long_name : result.formatted_address.split(',')[0].trim());
                            } else r(null);
                          });
                        });
                        Promise.all([fetchN('ko'), fetchN('en')]).then(([ko, en]) => {
                          if (ko && en && ko !== en) {
                            const dual = `${ko} (${en})`;
                            setSelectedSpot(prev => prev && prev.id === spot.id ? { ...prev, name: dual } : prev);
                          } else if (ko) {
                            setSelectedSpot(prev => prev && prev.id === spot.id ? { ...prev, name: ko } : prev);
                          }
                        });
                      }
                    }}
                  />
                ))}
                {searchedPlace && !isReadOnly && <Marker position={{ lat: searchedPlace.lat, lng: searchedPlace.lng }} icon="http://maps.google.com/mapfiles/ms/icons/red-pushpin.png" onClick={() => setSelectedSpot(searchedPlace)} />}
              </GoogleMap>
              <button className="locate-btn" onClick={handleCenterOnMe}><LocateFixed size={20} /></button>
            </div>

            <div className={`map-plan-drawer ${selectedSpot ? 'open' : ''}`}>
              {selectedSpot && (
                <div className="drawer-content-wrapper fade-in">
                  <div className="drawer-header">
                    <h3>{isReadOnly ? '일정 확인하기' : (String(selectedSpot.id).startsWith('temp-') ? '일정 계획하기' : '일정 수정하기')}</h3>
                    <button className="drawer-close-btn" onClick={() => { setSelectedSpot(null); setSearchedPlace(null); }}>×</button>
                  </div>
                  <div className="drawer-photo-section">
                    {selectedSpot.photoUrl ? (
                      <div className="drawer-photo-container">
                        <img src={selectedSpot.photoUrl} alt={selectedSpot.name} className="drawer-photo" />
                        {!isReadOnly && (
                          <label className="photo-edit-overlay">
                            <Camera size={20} />
                            <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                          </label>
                        )}
                      </div>
                    ) : (
                      !isReadOnly && (
                        <label className="photo-upload-placeholder">
                          <Upload size={32} />
                          <span>사진 추가하기</span>
                          <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                        </label>
                      )
                    )}
                  </div>
                  <div className="drawer-info">
                    <h4 className="drawer-title">{selectedSpot.name}</h4>
                    {selectedSpot.rating && (
                      <div className="drawer-rating">
                        <Star size={14} fill="#f59e0b" color="#f59e0b" />
                        <span className="rating-score">{selectedSpot.rating}</span>
                        <span className="rating-count">({selectedSpot.reviews})</span>
                      </div>
                    )}
                    <p className="drawer-address">{selectedSpot.memo}</p>
                    {selectedSpot.phone && <div className="drawer-meta-item"><span className="meta-label">전화:</span> {selectedSpot.phone}</div>}
                    {selectedSpot.openingHours && Array.isArray(selectedSpot.openingHours) && (
                      <div className="drawer-opening-hours">
                        <span className="meta-label">영업시간:</span>
                        <ul>
                          {selectedSpot.openingHours.map((line, idx) => <li key={idx}>{line}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="drawer-form">
                    <div className="drawer-row">
                      <div className="drawer-group"><label>일차</label><input type="number" className="drawer-input" value={formInput.day} onChange={(e) => setFormInput(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))} disabled={isReadOnly} /></div>
                      <div className="drawer-group"><label>날짜</label><input type="date" className="drawer-input" value={formInput.date} onChange={(e) => setFormInput(prev => ({ ...prev, date: e.target.value }))} disabled={isReadOnly} /></div>
                    </div>
                    <div className="drawer-group">
                      <label>분류</label>
                      <select 
                        className="drawer-select" 
                        value={formInput.type} 
                        onChange={(e) => setFormInput(prev => ({ ...prev, type: e.target.value }))} 
                        disabled={isReadOnly}
                      >
                        <option value="itinerary">일정 📍</option>
                        <option value="food">맛집 🍴</option>
                        <option value="hotel">숙소 🏨</option>
                        <option value="landmark">관광 🏛️</option>
                        <option value="transport">교통 🚌</option>
                      </select>
                    </div>
                    <div className="drawer-group"><label>상세 메모</label><textarea className="drawer-textarea" placeholder="이 장소에서 무엇을 할까요?" value={formInput.memo} onChange={(e) => setFormInput(prev => ({ ...prev, memo: e.target.value }))} disabled={isReadOnly} /></div>
                  </div>
                  {!isReadOnly && (
                    String(selectedSpot.id).startsWith('temp-') ? (
                      <button className="drawer-add-btn" onClick={() => {
                        const finalSpot = { ...selectedSpot, id: Date.now(), day: formInput.day, date: formInput.date, type: formInput.type, memo: formInput.memo || selectedSpot.memo };
                        setTripSpots(prev => [...prev, finalSpot].sort((a, b) => a.day !== b.day ? a.day - b.day : a.id - b.id));
                        syncSpot(finalSpot); setSelectedSpot(null); setSearchedPlace(null);
                      }}>내 여행에 담기</button>
                    ) : (
                      <div className="drawer-action-group">
                        <button className="drawer-update-btn" onClick={() => {
                          const updatedSpot = { ...selectedSpot, ...formInput };
                          setTripSpots(prev => prev.map(s => s.id === selectedSpot.id ? updatedSpot : s).sort((a, b) => a.day !== b.day ? a.day - b.day : a.id - b.id));
                          syncSpot(updatedSpot); setSelectedSpot(null);
                        }}>수정 저장</button>
                        <button className="drawer-delete-btn-map" onClick={() => { handleDeleteRow(selectedSpot.id); setSelectedSpot(null); }}>일정 삭제</button>
                      </div>
                    )
                  )}
                  {isReadOnly && <p className="read-only-notice" style={{ textAlign: 'center', color: '#8e8e8e', marginTop: '20px' }}>공유된 일정은 수정할 수 없습니다.</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="gallery-view-container fade-in">
            <div className="gallery-header">
              <div className="gallery-stats">
                <h3>📜 Memory Lane</h3>
                <span>총 {(tripSpots || []).filter(s => s.photoUrl).length}개의 추억</span>
              </div>
              <div className="gallery-actions">
                {selectedPhotos.length > 0 && (
                  <button className="batch-download-btn" onClick={handleBatchDownload}>
                    <Download size={16} /> {selectedPhotos.length}개 다운로드
                  </button>
                )}
                    <label className="batch-upload-btn">
                  <Upload size={16} /> 사진 업로드
                  <input type="file" hidden multiple accept="image/*" onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    setIsLoading(true);
                    for (const file of files) {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${session.user.id}/${Date.now()}_${Math.random()}.${fileExt}`;
                      const { data, error } = await supabase.storage.from('trip-photos').upload(fileName, file);
                      if (!error) {
                        const { data: { publicUrl } } = supabase.storage.from('trip-photos').getPublicUrl(fileName);
                        const { error: dbError } = await supabase
                          .from('photos')
                          .insert([{
                            trip_id: currentTrip.id,
                            user_id: session.user.id,
                            url: publicUrl,
                            uploader_name: session.user.email.split('@')[0]
                          }]);
                        
                        if (dbError) throw dbError;
                      }
                      await new Promise(r => setTimeout(r, 200));
                    }
                    setIsLoading(false);
                    alert(`${files.length}개의 사진이 업로드되었습니다.`);
                  }} />
                </label>
              </div>
            </div>

            <div className="gallery-grid">
              {tripPhotos.map((photo, idx) => (
                <div 
                  key={photo.id} 
                  className={`gallery-item ${selectedPhotos.includes(photo.id) ? 'selected' : ''}`}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img src={photo.url} alt="Trip memory" />
                  
                  <div className="gallery-item-overlay">
                    <div className="uploader-tag">@{photo.uploader_name || '익명'}</div>
                    <div className="gallery-item-actions" onClick={e => e.stopPropagation()}>
                      {!isReadOnly && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }} style={{ color: '#ed4956' }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(photo.url, `vibe-trip-${photo.id}.jpg`); }}>
                        <Download size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photo.id); }}>
                        {selectedPhotos.includes(photo.id) ? <CheckSquare size={16} color="#3897f0" /> : <Square size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {tripPhotos.length === 0 && (
                <div className="empty-gallery">
                  <ImageIcon size={48} color="#dbdbdb" />
                  <p>아직 피드 전용 사진이 없습니다.</p>
                  <span>아래 버튼을 통해 소중한 추억을 공유해 보세요!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'table' && (
          <div className="modern-table-container fade-in">
            <div className="modern-sheet-header">
              <div className="header-title-group">
                <h3>📅 여행 일정</h3>
                <span className="spot-count">총 {tripSpots.length}개</span>
              </div>
              {!isReadOnly && (
                <button className="modern-add-btn" onClick={handleAddRow}>
                  <SquarePlus size={18} /> 일정 추가
                </button>
              )}
            </div>

            <div className="modern-list-wrapper">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="modern-rows-container">
                  <SortableContext 
                    items={tripSpots.filter(s => selectedDay === null || String(s.day) === String(selectedDay)).map(s => s.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    {groupSpotsByDay.map((dayData) => (
                      <div key={dayData.day} className="modern-day-group">
                        <div className="modern-day-header">
                          <div className="day-info">
                            <span className="day-badge">Day {dayData.day}</span>
                            <span className="day-date">{dayData.date}</span>
                          </div>
                          {!isReadOnly && dayData.spots.length > 1 && (
                            <button 
                              className="modern-optimize-btn" 
                              onClick={() => handleOptimizeRoute(dayData.day)}
                            >
                              <MapPin size={12} /> 최적화 ✨
                            </button>
                          )}
                        </div>
                        <div className="day-spots-list">
                          {dayData.spots.map((spot) => (
                            <SortableRow 
                              key={spot.id} 
                              spot={spot} 
                              handleUpdateSpot={handleUpdateSpot} 
                              handleDeleteRow={handleDeleteRow} 
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
              
              {tripSpots.length === 0 && (
                <div className="modern-empty-state">
                  <div className="empty-icon">🗺️</div>
                  <p>아직 일정이 없습니다.</p>
                  <span>지도에서 장소를 추가해 보세요!</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}><Home size={24} /><span>Feed</span></button>
        <button className={`nav-item ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}><TableProperties size={24} /><span>Sheet</span></button>
        <button className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}><MapIcon size={24} /><span>Map</span></button>
        <button className={`nav-item ${activeTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveTab('gallery')}><ImageIcon size={24} /><span>Album</span></button>
      </nav>
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tripTitle={currentTrip?.title || "나의 여행"}
        tripId={currentTrip?.id}
      />
      
      {lightboxIndex !== null && tripPhotos[lightboxIndex] && (
        <div className="lightbox-overlay" onClick={() => setLightboxIndex(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={tripPhotos[lightboxIndex].url} alt="Lightbox view" className="lightbox-main-img" />
            
            <button className="lightbox-nav-btn prev" onClick={() => setLightboxIndex((lightboxIndex - 1 + tripPhotos.length) % tripPhotos.length)}>
              ‹
            </button>
            <button className="lightbox-nav-btn next" onClick={() => setLightboxIndex((lightboxIndex + 1) % tripPhotos.length)}>
              ›
            </button>

            <div className="lightbox-top-actions">
              <button className="lightbox-action-btn close" onClick={() => setLightboxIndex(null)}>×</button>
            </div>
            
            <div className="lightbox-center-actions">
               <button className="lightbox-download-hub" onClick={() => handleDownloadPhoto(tripPhotos[lightboxIndex].url, `vibe-trip-${tripPhotos[lightboxIndex].id}.jpg`)}>
                <Download size={24} />
                <span>선명하게 저장하기</span>
              </button>
            </div>

            <div className="lightbox-bottom-info">
              <span className="uploader">@{tripPhotos[lightboxIndex].uploader_name || '익명'}님의 소중한 추억</span>
              <span className="counter">{lightboxIndex + 1} / {tripPhotos.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
