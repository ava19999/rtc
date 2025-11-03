// App.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleOAuthProvider, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser
} from 'firebase/auth';

// Impor Komponen
import Header from './components/Header';
import Footer from './components/Footer';
import LoginPage from './components/LoginPage';
import CreateIdPage from './components/CreateIdPage';
import HomePage from './components/HomePage';
import ForumPage from './components/ForumPage';
import AboutPage from './components/AboutPage';
import RoomsListPage from './components/RoomsListPage';

// Impor Tipe dan Fungsi Helper
import type {
  ForumMessageItem,
  Room,
  CoinListItem,
  CryptoData,
  ChatMessage,
  Page,
  Currency,
  NewsArticle,
  User,
  GoogleProfile,
  NotificationSettings,
  RoomUserCounts,
  TypingStatus,
  TypingUsersMap,
  FirebaseTypingStatusData
} from './types';
import { isNewsArticle, isChatMessage } from './types';
import {
  fetchIdrRate,
  fetchNewsArticles,
  fetchTop500Coins,
  fetchTrendingCoins,
  fetchCoinDetails
} from './services/mockData';
import { ADMIN_USERNAMES } from './components/UserTag';
import { database, getDatabaseInstance, testDatabaseConnection } from './services/firebaseService';
import { ref, set, push, onValue, off, update, get, Database, remove, onDisconnect } from 'firebase/database';

const DEFAULT_ROOM_IDS = ['berita-kripto', 'pengumuman-aturan'];
const TYPING_TIMEOUT = 5000; // 5 detik

// Helper function untuk safely menggunakan database
const safeRef = (path: string) => {
  if (!database) {
    throw new Error('Database not initialized');
  }
  return ref(database, path);
};

// Sound notification
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.value = 0.8; // Volume 80%
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('Error memutar suara notifikasi:', error);
  }
};

const Particles: React.FC = () => (
  <div className="particles fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
    <div className="particle absolute bg-electric/50 rounded-full opacity-0" style={{ width: '3px', height: '3px', left: '10%', animation: 'drift 20s linear infinite', animationDelay: '-1s' }} />
    <div className="particle absolute bg-magenta/50 rounded-full opacity-0" style={{ width: '2px', height: '2px', left: '25%', animation: 'drift 25s linear infinite', animationDelay: '-5s' }} />
    <div className="particle absolute bg-lime/50 rounded-full opacity-0" style={{ width: '4px', height: '4px', left: '50%', animation: 'drift 15s linear infinite', animationDelay: '-10s' }} />
    <div className="particle absolute bg-electric/30 rounded-full opacity-0" style={{ width: '2px', height: '2px', left: '75%', animation: 'drift 18s linear infinite', animationDelay: '-7s' }} />
    <div className="particle absolute bg-lime/40 rounded-full opacity-0" style={{ width: '3px', height: '3px', left: '90%', animation: 'drift 22s linear infinite', animationDelay: '-3s' }} />
    <style>{`
      @keyframes drift {
        from { transform: translateY(-10vh) translateX(0); opacity: 0; }
        10% { opacity: 0.6; }
        50% { transform: translateY(50vh) translateX(10px); opacity: 0.3; }
        to { transform: translateY(110vh) translateX(-10px); opacity: 0; }
      }
    `}</style>
  </div>
);

// Helper function to update native app state for push notification suppression
const updateNativeRoomState = (roomId: string | null) => {
    // Memanggil bridge method yang diasumsikan ada di MainActivity
    if (typeof (window as any).AndroidBridge?.setCurrentRoomId === 'function') {
      (window as any).AndroidBridge.setCurrentRoomId(roomId || '');
      console.log(`[Bridge] Current room ID set to: ${roomId || 'null'}`);
    }
};

const AppContent: React.FC = () => {
  // --- STATE DEFINITIONS ---
  const [pageHistory, setPageHistory] = useState<Page[]>(['home']);
  const activePage = useMemo(() => pageHistory[pageHistory.length - 1], [pageHistory]);
  const [currency, setCurrency] = useState<Currency>('usd');
  const [idrRate, setIdrRate] = useState<number | null>(null);
  const [isRateLoading, setIsRateLoading] = useState(true);
  const [users, setUsers] = useState<{ [email: string]: User }>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<GoogleProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [analysisCounts, setAnalysisCounts] = useState<{ [key: string]: number }>({});
  const baseAnalysisCount = 1904;
  const [fullCoinList, setFullCoinList] = useState<CoinListItem[]>([]);
  const [isCoinListLoading, setIsCoinListLoading] = useState(true);
  const [coinListError, setCoinListError] = useState<string | null>(null);
  const [trendingCoins, setTrendingCoins] = useState<CryptoData[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [searchedCoin, setSearchedCoin] = useState<CryptoData | null>(null);
  
  const [rooms, setRooms] = useState<Room[]>([
    { id: 'berita-kripto', name: 'Berita Kripto', userCount: 0, isDefaultRoom: true },
    { id: 'pengumuman-aturan', name: 'Pengumuman & Aturan', userCount: 0, isDefaultRoom: true }
  ]);
  
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('joinedRoomIds');
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) { console.error('Gagal load joined rooms', e); }
    }
    return new Set(DEFAULT_ROOM_IDS);
  });
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [firebaseMessages, setFirebaseMessages] = useState<{ [roomId: string]: ForumMessageItem[] }>({});
  const [lastMessageTimestamps, setLastMessageTimestamps] = useState<{ [roomId: string]: number }>({});
  const [userLastVisit, setUserLastVisit] = useState<{ [roomId: string]: number }>({});
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({});
  const [roomUserCounts, setRoomUserCounts] = useState<RoomUserCounts>({});
  
  const [hasJoinedRoom, setHasJoinedRoom] = useState<{[roomId: string]: boolean}>(() => {
    const saved = localStorage.getItem('hasJoinedRoom');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Gagal load hasJoinedRoom', e); }
    }
    return {};
  });

  const [typingUsers, setTypingUsers] = useState<TypingUsersMap>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingListenersRef = useRef<{ [roomId: string]: () => void }>({});

  const prevTotalUnreadRef = useRef<number>(0);
  const lastSoundPlayTimeRef = useRef<number>(0);
  const roomListenersRef = useRef<{ [roomId: string]: () => void }>({});
  const lastProcessedTimestampsRef = useRef<{ [roomId: string]: number }>({});
  const userSentMessagesRef = useRef<Set<string>>(new Set());
  
  // --- PERBAIKAN UTAMA: SESSION TRACKER UNTUK USER COUNT (MENCEGAH PENAMBAHAN GANDA) ---
  const sessionJoinedRooms = useRef<Set<string>>(new Set());
  // --------------------------------------------------------------------------------------


  // --- FUNCTION DEFINITIONS (useCallback) ---
  
  const leaveCurrentRoom = useCallback(() => {
    if (!currentRoom?.id) return;
    
    const currentTime = Date.now();
    const roomId = currentRoom.id;
    
    // CATATAN: Fungsi ini HANYA menangani navigasi antar-halaman.
    // Penghitung userCount TIDAK DI DECREMENT di sini.
    
    setUserLastVisit(prev => ({
      ...prev,
      [roomId]: currentTime
    }));
    
    setUnreadCounts(prev => ({
      ...prev,
      [roomId]: 0
    }));
    
    if (database && firebaseUser?.uid) {
      const typingRef = safeRef(`typing/${roomId}/${firebaseUser.uid}`);
      remove(typingRef).catch(error => console.error("Error removing typing status on leave:", error));
    }
    
    setCurrentRoom(null);
    updateNativeRoomState(null); // <-- Mengatur ID room menjadi null/empty string di native

    console.log(`Left room: ${roomId}, reset unread count, updated last visit, removed typing status.`);
  }, [currentRoom, database, firebaseUser]); 

  const handleAndroidLoginToken = useCallback(async (idToken: string) => {
    console.log("handleAndroidLoginToken dipanggil dengan token.");
    setAuthError(null);
    if (!idToken) {
      setAuthError('Token ID Google dari Android tidak ditemukan.');
      return;
    }
    try {
      const decoded: { email: string; name: string; picture: string } = jwtDecode(idToken) as any;
      const { email, name, picture } = decoded;
      console.log("Token di-decode:", email);

      const auth = getAuth();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      
      signInWithCredential(auth, googleCredential)
        .then((userCredential) => {
          console.log("Firebase signInWithCredential sukses (dari Android)");
          const existingAppUser = Object.values(users).find(u => u.email === email);
          if (existingAppUser) {
            console.log("User sudah ada, logging in...");
            setCurrentUser(existingAppUser);
            setPendingGoogleUser(null);
            setPageHistory(['home']); // Reset history
          } else {
            console.log("User baru, mengarahkan ke CreateIdPage...");
            setPendingGoogleUser({ email, name, picture });
            if (currentUser) setCurrentUser(null);
          }
        })
        .catch((error) => {
          console.error('Firebase signInWithCredential error (from Android):', error);
          let errMsg = 'Gagal menghubungkan login Google ke Firebase.';
          if ((error as any).code === 'auth/account-exists-with-different-credential') errMsg = 'Akun dengan email ini sudah ada.';
          setAuthError(errMsg);
          if (currentUser) setCurrentUser(null);
        });
    } catch (error) {
      console.error('Google login decode/Firebase error (from Android):', error);
      setAuthError('Error memproses login Google dari Android.');
      if (currentUser) setCurrentUser(null);
    }
  }, [users, currentUser]);

  const updateRoomUserCount = useCallback(async (roomId: string, increment: boolean) => {
    if (!database) return;
    if (DEFAULT_ROOM_IDS.includes(roomId)) return;

    try {
      const roomRef = safeRef(`rooms/${roomId}/userCount`);
      const snapshot = await get(roomRef);
      const currentCount = snapshot.val() || 0;
      const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);
      
      await set(roomRef, newCount);
      
      setRoomUserCounts(prev => ({
        ...prev,
        [roomId]: newCount
      }));
    } catch (error) {
      console.error('Error updating room user count:', error);
    }
  }, [database]);

  // --- PERBAIKAN LOGIKA TOGGLE NOTIFIKASI (MENGATUR FCM SUBSCRIBE/UNSUBSCRIBE) ---
  const handleToggleNotification = useCallback((roomId: string, enabled: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [roomId]: enabled
    }));
    
    // LOGIKA FCM SUBSCRIBE/UNSUBSCRIBE UNTUK TOGGLE PER ROOM
    if (typeof (window as any).AndroidBridge?.subscribeToRoom === 'function' && !DEFAULT_ROOM_IDS.includes(roomId)) {
        if (enabled) {
            // SUBSCRIBE jika diaktifkan (Default: true)
            (window as any).AndroidBridge.subscribeToRoom(roomId);
            console.log(`[Bridge-FCM] Subscribed to topic for room: ${roomId}`);
        } else {
            // UNSUBSCRIBE jika dimatikan (false)
            (window as any).AndroidBridge.unsubscribeFromRoom(roomId);
            console.log(`[Bridge-FCM] Unsubscribed from topic for room: ${roomId}`);
        }
    }

    // Jika room yang di-toggle adalah room aktif, update native state agar supresi in-room bekerja
    if (currentRoom?.id === roomId) {
        updateNativeRoomState(roomId);
    }
  }, [currentRoom]);
  // ------------------------------------------

  const fetchTrendingData = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) { setIsTrendingLoading(true); setTrendingError(null); }
    try { setTrendingCoins(await fetchTrendingCoins()); }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal memuat data tren.';
      if (showSkeleton) setTrendingError(errorMessage);
      else console.error('Gagal menyegarkan data tren:', errorMessage);
    } finally { if (showSkeleton) setIsTrendingLoading(false); }
  }, []);

  const handleResetToTrending = useCallback(() => {
    setSearchedCoin(null);
  }, []);

  const fetchAndStoreNews = useCallback(async () => {
    try {
      const fetchedArticles = await fetchNewsArticles();
      if (fetchedArticles && fetchedArticles.length > 0) {
        const articlesWithIds: NewsArticle[] = fetchedArticles.map((article, index) => ({
          ...article,
          id: `news-${Date.now()}-${index}`,
          type: 'news' as const
        }));
        
        setNewsArticles(articlesWithIds);
        localStorage.setItem('cryptoNews', JSON.stringify(articlesWithIds));
        localStorage.setItem('lastNewsFetch', Date.now().toString());
        
        if (currentRoom?.id !== 'berita-kripto') {
          setUnreadCounts(prev => ({
            ...prev,
            'berita-kripto': (prev['berita-kripto'] || 0) + 1
          }));
        }
      }
    } catch (error) {
      console.error('Gagal mengambil berita kripto:', error);
    }
  }, [currentRoom]);

  const handleGoogleRegisterSuccess = useCallback(async (credentialResponse: CredentialResponse) => {
    setAuthError(null);
    if (!credentialResponse.credential) { setAuthError('Credential Google tidak ditemukan.'); return; }
    try {
      const decoded: { email: string; name: string; picture: string } = jwtDecode(credentialResponse.credential) as any;
      const { email, name, picture } = decoded;
      const auth = getAuth();
      const googleCredential = GoogleAuthProvider.credential(credentialResponse.credential);
      signInWithCredential(auth, googleCredential)
        .then((userCredential) => {
          const existingAppUser = Object.values(users).find(u => u.email === email);
          if (existingAppUser) {
            setCurrentUser(existingAppUser);
            setPendingGoogleUser(null);
            setPageHistory(['home']); // <-- RESET HISTORY
          } else {
            setPendingGoogleUser({ email, name, picture });
            if (currentUser) setCurrentUser(null);
          }
        })
        .catch((error) => {
          console.error('Firebase signInWithCredential error:', error);
          let errMsg = 'Gagal menghubungkan login Google ke Firebase.';
          if ((error as any).code === 'auth/account-exists-with-different-credential') errMsg = 'Akun dengan email ini sudah ada, gunakan metode login lain.';
          else if ((error as any).message) errMsg += ` (${(error as any).message})`;
          setAuthError(errMsg);
          if (currentUser) setCurrentUser(null);
        });
    } catch (error) {
      console.error('Google login decode/Firebase error:', error);
      setAuthError('Error memproses login Google.');
      if (currentUser) setCurrentUser(null);
    }
  }, [users, currentUser]);

  const handleProfileComplete = useCallback(async (username: string, password: string): Promise<string | void> => {
    setAuthError(null);
    if (!pendingGoogleUser) { setAuthError('Data Google tidak ditemukan untuk melengkapi profil.'); return 'Data Google tidak ditemukan.'; }
    if (!firebaseUser) { setAuthError('Sesi login Firebase tidak aktif untuk melengkapi profil.'); return 'Sesi login Firebase tidak aktif.'; }
    if (Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase())) {
      const errorMsg = 'Username sudah digunakan. Pilih username lain.';
      setAuthError(errorMsg);
      return errorMsg;
    }

    const newUser: User = {
      email: pendingGoogleUser.email,
      username,
      password,
      googleProfilePicture: pendingGoogleUser.picture,
      createdAt: Date.now()
    };

    setUsers(prev => ({ ...prev, [newUser.email]: newUser }));
    setCurrentUser(newUser);
    setPendingGoogleUser(null);
    setPageHistory(['home']); // <-- RESET HISTORY
  }, [users, pendingGoogleUser, firebaseUser]);

  const handleLogout = useCallback(() => {
    leaveCurrentRoom();
    updateNativeRoomState(null); // <-- Mengatur ID room menjadi null saat logout
    
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        setPageHistory(['home']); // <-- RESET HISTORY
      })
      .catch((error) => {
        console.error('Firebase signOut error:', error);
        setCurrentUser(null);
        setFirebaseUser(null);
        setPageHistory(['home']); // <-- RESET HISTORY
      });
  }, [leaveCurrentRoom]);

  const handleIncrementAnalysisCount = useCallback((coinId: string) => {
    setAnalysisCounts(prev => {
      const current = prev[coinId] || baseAnalysisCount;
      const newCounts = { ...prev, [coinId]: current + 1 };
      localStorage.setItem('analysisCounts', JSON.stringify(newCounts));
      return newCounts;
    });
  }, [baseAnalysisCount]);

  const navigateTo = useCallback((page: Page) => {
    const currentPage = pageHistory[pageHistory.length - 1];

    if (currentRoom && (page !== 'forum' || currentPage !== 'forum')) {
      leaveCurrentRoom();
    }
    
    if (page === 'home') {
      if (currentPage === 'home') {
        handleResetToTrending(); // Reset coin search jika sudah di home
      } else {
        setPageHistory(prev => [...prev, 'home']); // Navigasi ke home
      }
    } else if (page === 'forum') {
      if (currentPage === 'forum' && currentRoom) {
         // Sudah di forum, jangan lakukan apa-apa
      } else {
        // Arahkan ke daftar room
        setPageHistory(prev => [...prev, 'rooms']);
      }
    } else if (page !== currentPage) {
      // Untuk 'about', dll.
      setPageHistory(prev => [...prev, page]);
    }
  }, [pageHistory, currentRoom, leaveCurrentRoom, handleResetToTrending]);

  const handleSelectCoin = useCallback(async (coinId: string) => {
    setIsTrendingLoading(true); setTrendingError(null); setSearchedCoin(null);
    try { setSearchedCoin(await fetchCoinDetails(coinId)); }
    catch (err) { setTrendingError(err instanceof Error ? err.message : 'Gagal muat detail koin.'); }
    finally { setIsTrendingLoading(false); }
  }, []);

  const handleAndroidBackButton = useCallback(() => {
    const currentPage = pageHistory[pageHistory.length - 1];
    console.log(`[Back Button] handleAndroidBackButton. History:`, pageHistory);

    if (currentPage === 'home' && searchedCoin) {
      console.log("[Back Button] Clearing searched coin.");
      handleResetToTrending(); 
      return true; // DITANGANI
    }

    if (pageHistory.length > 1) {
      if (currentPage === 'forum') {
        console.log("[Back Button] Leaving forum room.");
        leaveCurrentRoom();
      }
      
      console.log("[Back Button] Popping page history.");
      setPageHistory(prev => prev.slice(0, -1)); // Kembali ke halaman sebelumnya
      return true; // DITANGANI
    }

    console.log("[Back Button] Already at root. Let Android exit.");
    return false; // TIDAK DITANGANI
  }, [pageHistory, leaveCurrentRoom, searchedCoin, handleResetToTrending]);


  // --- PERBAIKAN: TAMBAHKAN useEffect DI SINI ---
  // Ini akan mengekspos fungsi React ke aplikasi Android
  useEffect(() => {
    console.log("Attaching functions to window for AndroidBridge...");
    (window as any).handleAndroidLoginToken = handleAndroidLoginToken;
    (window as any).handleAndroidBackButton = handleAndroidBackButton;
    
    // Cleanup saat komponen dibongkar
    return () => {
      console.log("Cleaning up window functions for AndroidBridge.");
      delete (window as any).handleAndroidLoginToken;
      delete (window as any).handleAndroidBackButton;
    };
  }, [handleAndroidLoginToken, handleAndroidBackButton]); // <-- Tambahkan dependensi
  // --- AKHIR PERBAIKAN ---


  const handleJoinRoom = useCallback((room: Room) => {
    setCurrentRoom(room);
    updateNativeRoomState(room.id); // <-- Mengatur ID room ke room yang aktif di native
    
    // Panggil Android Bridge untuk subscribe
    // HANYA SUBSCRIBE JIKA NOTIFIKASI TIDAK DIMATIKAN di local storage (notificationSettings)
    const notificationsEnabled = room.id ? (notificationSettings[room.id] !== false) : true; // Defaultnya aktif
    
    if (typeof (window as any).AndroidBridge?.subscribeToRoom === 'function' && notificationsEnabled && !DEFAULT_ROOM_IDS.includes(room.id)) {
      (window as any).AndroidBridge.subscribeToRoom(room.id);
      console.log(`[Bridge-FCM] Subscribed to topic: ${room.id} on join.`);
    } else {
         console.log(`[Bridge-FCM] Subscription skipped for room: ${room.id} (Disabled or Default).`);
    }

    const isFirstTimeJoin = !hasJoinedRoom[room.id];
    
    setJoinedRoomIds(prev => new Set(prev).add(room.id));
    setPageHistory(prev => [...prev, 'forum']); // Navigasi ke 'forum'
    
    if (!room.isDefaultRoom) {
      // --- LOGIKA PERBAIKAN USER COUNT INCREMENT ---
      // Hanya increment jika room belum di-join di SESI INI.
      if (!sessionJoinedRooms.current.has(room.id)) {
          updateRoomUserCount(room.id, true); 
          console.log(`[handleJoinRoom] Incremented user count for room: ${room.id}`);
          sessionJoinedRooms.current.add(room.id); // Tandai sudah dihitung di sesi ini
      } else {
          console.log(`[handleJoinRoom] User already accounted for in this session: ${room.id}`);
      }
      // ---------------------------------------------

      if (isFirstTimeJoin) {
        setHasJoinedRoom(prev => ({
          ...prev,
          [room.id]: true
        }));
      }
    }
    
    setUnreadCounts(prev => ({
      ...prev,
      [room.id]: 0
    }));
    
    const currentTime = Date.now();
    setUserLastVisit(prev => ({
      ...prev,
      [room.id]: currentTime
    }));

     if (database && firebaseUser?.uid) {
       try {
        const typingRef = safeRef(`typing/${room.id}/${firebaseUser.uid}`);
        onDisconnect(typingRef).remove();
        console.log(`[JOIN] onDisconnect set for typing status in room ${room.id} on join`);
       } catch(e) { console.error("[JOIN] Error setting onDisconnect on join:", e); }
     }
  }, [updateRoomUserCount, hasJoinedRoom, database, firebaseUser, notificationSettings]);
  
  const handleLeaveRoom = useCallback(() => { 
    // Cukup panggil handleAndroidBackButton() untuk kembali
    handleAndroidBackButton();
  }, [handleAndroidBackButton]);
  
  const handleLeaveJoinedRoom = useCallback((roomId: string) => {
    if (DEFAULT_ROOM_IDS.includes(roomId)) return;
    
    // Panggil Android Bridge untuk unsubscribe - SELALU UNSUBSCRIBE DARI TOPIK SAAT LEAVE PERMANEN.
    if (typeof (window as any).AndroidBridge?.unsubscribeFromRoom === 'function') {
      (window as any).AndroidBridge.unsubscribeFromRoom(roomId);
      console.log(`[Bridge] Unsubscribed from topic: ${roomId} on permanent leave.`);
    }
    
    // --- LOGIKA PERBAIKAN USER COUNT DECREMENT (SAMA DENGAN SEBELUMNYA, DIVERIFIKASI SUDAH BENAR) ---
    if (hasJoinedRoom[roomId]) {
      updateRoomUserCount(roomId, false); // <-- User count di-decrement
      console.log(`[handleLeaveJoinedRoom] Decremented user count for room: ${roomId}`);
      setHasJoinedRoom(prev => ({
        ...prev,
        [roomId]: false
      }));
    }
    // --------------------------------------------------------------------------------------------------
    
    // --- PERBAIKAN: HAPUS FLAG SESI AGAR BISA INCREMENT LAGI JIKA RE-JOIN PERMANEN ---
    sessionJoinedRooms.current.delete(roomId); // <-- Hapus flag sesi
    
    if (currentRoom?.id === roomId) { 
      // Jika room aktif yang ditinggalkan, clear native state melalui leaveCurrentRoom
      leaveCurrentRoom();
      setPageHistory(prev => prev.slice(0, -1)); // Kembali ke halaman sebelumnya
    }

    setJoinedRoomIds(prev => { const newIds = new Set(prev); newIds.delete(roomId); return newIds; });
    setUnreadCounts(prev => { const newCounts = { ...prev }; delete newCounts[roomId]; return newCounts; });
    setUserLastVisit(prev => { const newVisits = { ...prev }; delete newVisits[roomId]; return newVisits; });
    setNotificationSettings(prev => { const newSettings = { ...prev }; delete newSettings[roomId]; return newSettings; });
    
    if (roomListenersRef.current[roomId]) {
      roomListenersRef.current[roomId]();
      delete roomListenersRef.current[roomId];
    }
    
     if (database && firebaseUser?.uid) {
       try {
        const typingRef = safeRef(`typing/${roomId}/${firebaseUser.uid}`);
        remove(typingRef).catch(error => console.error("Error removing typing status on leave joined:", error));
       } catch(e) { console.error("Error removing typing status on leave joined (outer):", e); }
     }
    
  }, [currentRoom, leaveCurrentRoom, updateRoomUserCount, hasJoinedRoom, database, firebaseUser]);

  const handleCreateRoom = useCallback((roomName: string) => {
    if (!currentUser?.username || !firebaseUser) { 
      alert('Anda harus login untuk membuat room.'); 
      return; 
    }
    
    const trimmedName = roomName.trim();
    
    if (trimmedName.length > 25) {
      alert('Nama room maksimal 25 karakter.');
      return;
    }
    
    if (trimmedName.length < 3) {
      alert('Nama room minimal 3 karakter.');
      return;
    }
    
    if (rooms.some(r => r.name.toLowerCase() === trimmedName.toLowerCase())) { 
      alert('Nama room sudah ada. Silakan pilih nama lain.'); 
      return; 
    }
    
    if (!database) {
      alert('Database tidak tersedia. Coba lagi nanti.');
      return;
    }

    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const roomData = {
      name: trimmedName,
      userCount: 1,
      createdBy: currentUser.username, 
      createdAt: Date.now(),
      isDefaultRoom: false
    };
    
    const newRoom: Room = { 
      id: roomId,
      ...roomData
    };
    
    try {
      const roomRef = safeRef(`rooms/${roomId}`);
      
      console.log('Mencoba membuat room dengan data:', roomData);
      
      set(roomRef, roomData)
      .then(() => {
        console.log('Room berhasil dibuat:', newRoom);
        setHasJoinedRoom(prev => ({
          ...prev,
          [roomId]: true
        }));
        handleJoinRoom(newRoom);
      })
      .catch((error) => {
        console.error('Gagal membuat room di Firebase:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Gagal membuat room. Coba lagi.';
        
        if (error.code === 'PERMISSION_DENIED') {
          errorMessage = 'Izin ditolak. Periksa Firebase Rules.';
        }
        
        alert(errorMessage);
      });
      
    } catch (error) {
      console.error('Error dalam handleCreateRoom:', error);
      alert('Terjadi kesalahan saat membuat room.');
    }
  }, [handleJoinRoom, rooms, currentUser, database, firebaseUser]);

  const handleDeleteRoom = useCallback((roomId: string) => {
    if (!currentUser?.username || !firebaseUser?.uid) {
      console.warn('Delete room prerequisites failed (user).');
      alert('Gagal menghapus: Anda belum login.');
      return;
    }
    const roomToDelete = rooms.find(r => r.id === roomId);
    if (!roomToDelete || DEFAULT_ROOM_IDS.includes(roomId)) {
      console.warn('Cannot delete default or non-existent room.');
      return;
    }
    if (!database) {
      console.error('Cannot delete room: Database not initialized.');
      alert('Gagal menghapus room: Koneksi database bermasalah.');
      return;
    }

    try {
      const isAdmin = ADMIN_USERNAMES.map(name => name.toLowerCase()).includes(currentUser.username.toLowerCase());
      const isCreator = roomToDelete.createdBy === currentUser.username;

      if (!isAdmin && !isCreator) {
        alert('Hanya admin atau pembuat room yang dapat menghapus room ini.');
        return;
      }

      if (window.confirm(`Anda yakin ingin menghapus room "${roomToDelete.name}" secara permanen? Semua pesan di dalamnya akan hilang.`)) {
        
        // Unsubscribe dari topik sebelum dihapus
        if (typeof (window as any).AndroidBridge?.unsubscribeFromRoom === 'function') {
          (window as any).AndroidBridge.unsubscribeFromRoom(roomId);
        }

        const roomRef = safeRef(`rooms/${roomId}`);
        remove(roomRef)
          .then(() => {
            console.log(`Room ${roomId} deleted.`);
            const messagesRef = safeRef(`messages/${roomId}`);
            return remove(messagesRef);
          })
          .then(() => {
            console.log(`Messages for room ${roomId} deleted.`);
            setHasJoinedRoom(prev => {
              const newState = { ...prev };
              delete newState[roomId];
              return newState;
            });
            if (currentRoom?.id === roomId) {
              leaveCurrentRoom();
              setPageHistory(prev => prev.slice(0, -1)); // Kembali
            }
            
            // Hapus flag sesi saat room dihapus
            sessionJoinedRooms.current.delete(roomId);
          })
          .catch(error => {
            console.error(`Gagal menghapus room ${roomId}:`, error);
            alert('Gagal menghapus room. Periksa koneksi atau izin Anda.');
          });
      }
    } catch (error) {
      console.error('Error in handleDeleteRoom (logic error):', error);
      alert('Terjadi kesalahan saat menghapus room.');
    }
  }, [currentUser, rooms, firebaseUser, currentRoom, leaveCurrentRoom]); 

  const handleSendMessage = useCallback((message: Partial<ChatMessage>) => {
    if (!database || !currentRoom?.id || !firebaseUser?.uid || !currentUser?.username) {
      console.error('Prasyarat kirim pesan gagal', { db: !!database, room: currentRoom?.id, fbUid: firebaseUser?.uid, appUser: currentUser?.username });
      alert('Gagal mengirim: Belum login, data tidak lengkap, atau masalah koneksi.');
      return;
    }
    if (!message.text?.trim() && !message.fileURL) {
      console.warn('Attempted to send an empty message.');
      return;
    }

    const roomId = currentRoom.id; 
    const messageText = message.text?.trim() || (message.fileURL ? "mengirim file" : "");
    const senderUsername = currentUser.username;

    const messageToSend: Omit<ChatMessage, 'id'> & { type: 'user'; sender: string; timestamp: number; userCreationDate: number } = {
      type: 'user',
      uid: firebaseUser.uid,
      sender: senderUsername,
      timestamp: Date.now(),
      reactions: {},
      userCreationDate: currentUser.createdAt,
      ...(message.text && { text: message.text.trim() }),
      ...(message.fileURL && { fileURL: message.fileURL }),
      ...(message.fileName && { fileName: message.fileName }),
    };

    try {
      const messageListRef = safeRef(`messages/${roomId}`);
      const newMessageRef = push(messageListRef);
      
      userSentMessagesRef.current.add(newMessageRef.key!);
      
      // 1. Kirim pesan ke Database
      set(newMessageRef, messageToSend)
        .then(() => {
          // 2. JIKA SUKSES, panggil Vercel API untuk kirim notifikasi
          if (messageText) {
            fetch('/api/sendNotification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: roomId,
                sender: senderUsername,
                text: messageText,
              }),
            }).catch(err => console.error('Gagal trigger notifikasi:', err));
          }
        })
        .catch((error) => {
          console.error('Firebase send message error:', error);
          alert(`Gagal mengirim pesan.${(error as any).code === 'PERMISSION_DENIED' ? ' Akses ditolak. Periksa aturan database.' : ''}`);
        });

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gagal mengirim pesan.');
    }
  }, [currentRoom, currentUser, firebaseUser]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    if (!database || !currentRoom?.id || !firebaseUser?.uid || !messageId || !emoji) {
      console.warn('React prerequisites failed', { db: !!database, room: currentRoom?.id, fbUid: firebaseUser?.uid, msgId: messageId, emoji });
      return;
    }
    const username = currentUser?.username;
    if (!username) { console.warn('Cannot react: Missing app username'); return; }

    try {
      const reactionUserListRef = safeRef(`messages/${currentRoom.id}/${messageId}/reactions/${emoji}`);
      get(reactionUserListRef).then((snapshot) => {
        const usersForEmoji: string[] = snapshot.val() || [];
        let updatedUsers: string[] | null;
        if (!Array.isArray(usersForEmoji)) {
          console.error('Invalid data format for reactions, expected array or null:', usersForEmoji);
          updatedUsers = [username];
        } else if (usersForEmoji.includes(username)) {
          updatedUsers = usersForEmoji.filter(u => u !== username);
          if (updatedUsers.length === 0) updatedUsers = null;
        } else {
          updatedUsers = [...usersForEmoji, username];
        }
        set(reactionUserListRef, updatedUsers).catch(error => console.error(`Failed to update reaction for emoji ${emoji}:`, error));
      }).catch(error => console.error(`Failed to get reaction data for emoji ${emoji}:`, error));
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  }, [currentRoom, currentUser, firebaseUser]);

  const handleDeleteMessage = useCallback((roomId: string, messageId: string) => {
    if (!database || !roomId || !messageId) {
      console.error('Cannot delete message: Missing database, roomId, or messageId.');
      alert('Gagal menghapus pesan: Informasi tidak lengkap.');
      return;
    }
    try {
      const messageRef = safeRef(`messages/${roomId}/${messageId}`);
      remove(messageRef).then(() => {
        console.log(`Message ${messageId} in room ${roomId} deleted successfully.`);
      }).catch(error => {
        console.error(`Failed to delete message ${messageId} in room ${roomId}:`, error);
        alert('Gagal menghapus pesan. Periksa koneksi atau izin Anda.');
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Gagal menghapus pesan.');
    }
  }, []);

  const handleStartTyping = useCallback(() => {
    if (!database || !currentRoom?.id || !firebaseUser?.uid || !currentUser?.username || currentUser?.createdAt === undefined || currentUser?.createdAt === null) {
      console.warn("[handleStartTyping] Prerequisites not met:", { db: !!database, room: currentRoom?.id, fbUid: firebaseUser?.uid, appUser: currentUser?.username, createdAtExists: currentUser?.hasOwnProperty('createdAt') });
      return;
    }

    const typingRef = safeRef(`typing/${currentRoom.id}/${firebaseUser.uid}`);
    const status: TypingStatus = {
      username: currentUser.username,
      userCreationDate: currentUser.createdAt,
      timestamp: Date.now()
    };
    console.log(`[handleStartTyping] Attempting to set status for user ${firebaseUser.uid} in room ${currentRoom.id}:`, status);

    set(typingRef, status)
    .then(() => {
      console.log(`[handleStartTyping] Status successfully set for ${firebaseUser.uid}. Setting onDisconnect.`);
      return onDisconnect(typingRef).remove();
    })
    .then(() => {
         console.log(`[handleStartTyping] onDisconnect set successfully for ${firebaseUser.uid}`);
    })
    .catch(error => console.error("[handleStartTyping] Error setting status or onDisconnect:", error));

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      console.log(`[handleStartTyping] Typing timeout reached for ${firebaseUser?.uid}. Attempting to remove status.`);
      if (database && currentRoom?.id && firebaseUser?.uid) {
          const timeoutTypingRef = safeRef(`typing/${currentRoom.id}/${firebaseUser.uid}`);
          remove(timeoutTypingRef).catch(error => console.error("[handleStartTyping] Error removing status on timeout:", error));
      } else {
          console.warn("[handleStartTyping] Cannot remove status on timeout - DB or context missing.");
      }
      typingTimeoutRef.current = null;
    }, TYPING_TIMEOUT);
  }, [database, currentRoom, firebaseUser, currentUser]);

  const handleStopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      console.log(`[handleStopTyping] Clearing typing timeout for ${firebaseUser?.uid}.`);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (!database || !currentRoom?.id || !firebaseUser?.uid) {
         console.warn("[handleStopTyping] Prerequisites not met for removal:", { db: !!database, room: currentRoom?.id, fbUid: firebaseUser?.uid });
        return;
    }
    const typingRef = safeRef(`typing/${currentRoom.id}/${firebaseUser.uid}`);
    console.log(`[handleStopTyping] Attempting to remove status for ${firebaseUser.uid} in room ${currentRoom.id}.`);
    remove(typingRef).catch(error => console.error("[handleStopTyping] Error removing status:", error));
  }, [database, currentRoom, firebaseUser]);

  // --- EFEK (useEffect) ---
  
  // Efek untuk me-load data dari local storage (dijalankan sekali)
  useEffect(() => { 
    try {
      const u = localStorage.getItem('cryptoUsers');
      if (u) setUsers(JSON.parse(u));
    } catch (e) { console.error('Gagal load users', e); }
    
    const savedSettings = localStorage.getItem('roomNotificationSettings');
    if (savedSettings) {
      try { setNotificationSettings(JSON.parse(savedSettings)); } catch (e) { console.error('Gagal load pengaturan notifikasi', e); }
    }
    
    const savedCounts = localStorage.getItem('unreadCounts'); 
    if (savedCounts) try { setUnreadCounts(JSON.parse(savedCounts)); } catch (e) { console.error('Gagal parse unreadCounts', e); } 
    
    const savedVisits = localStorage.getItem('userLastVisit'); 
    if (savedVisits) try { setUserLastVisit(JSON.parse(savedVisits)); } catch (e) { console.error('Gagal parse userLastVisit', e); } 

    const lastReset = localStorage.getItem('lastAnalysisResetDate');
    const today = new Date().toISOString().split('T')[0];
    if (lastReset !== today) {
      localStorage.setItem('analysisCounts', '{}');
      localStorage.setItem('lastAnalysisResetDate', today);
      setAnalysisCounts({});
    } else {
      const saved = localStorage.getItem('analysisCounts');
      if (saved) try { setAnalysisCounts(JSON.parse(saved)); } catch (e) { console.error('Gagal parse analysis counts', e); }
    }
  }, []);
  
  // Efek untuk menyimpan data ke local storage (dijalankan saat data berubah)
  useEffect(() => { localStorage.setItem('roomNotificationSettings', JSON.stringify(notificationSettings)); }, [notificationSettings]);
  useEffect(() => { try { localStorage.setItem('cryptoUsers', JSON.stringify(users)); } catch (e) { console.error('Gagal simpan users', e); } }, [users]);
  useEffect(() => { try { if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser)); else localStorage.removeItem('currentUser'); } catch (e) { console.error('Gagal simpan currentUser', e); } }, [currentUser]);
  useEffect(() => { try { localStorage.setItem('joinedRoomIds', JSON.stringify(Array.from(joinedRoomIds))); } catch (e) { console.error('Gagal simpan joined rooms', e); } }, [joinedRoomIds]);
  useEffect(() => { localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); }, [unreadCounts]);
  useEffect(() => { localStorage.setItem('userLastVisit', JSON.stringify(userLastVisit)); }, [userLastVisit]);
  useEffect(() => { try { localStorage.setItem('hasJoinedRoom', JSON.stringify(hasJoinedRoom)); } catch (e) { console.error('Gagal simpan hasJoinedRoom', e); } }, [hasJoinedRoom]);

  // Efek untuk listener otentikasi Firebase
  useEffect(() => {
    if (!database) {
      console.warn('Firebase Auth listener skipped: Database not initialized.');
      setIsAuthLoading(false);
      return;
    }
    const auth = getAuth();
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        const appUser = Object.values(users).find(u => u.email === user.email);
        if (appUser) {
          if (!currentUser || currentUser.email !== appUser.email) {
            setCurrentUser(appUser);
            setPendingGoogleUser(null);
             if (database && currentRoom?.id) {
               try {
                 const typingRef = safeRef(`typing/${currentRoom.id}/${user.uid}`);
                 onDisconnect(typingRef).remove();
                 console.log(`[AUTH] onDisconnect set for typing status in room ${currentRoom.id}`);
               } catch(e) { console.error("[AUTH] Error setting onDisconnect for typing status:", e); }
             }
          }
        } else if (!pendingGoogleUser) {
          console.warn('Auth listener: Firebase user exists but no matching app user found and not pending.');
        }
      } else {
        if (currentUser !== null) setCurrentUser(null);
        setPendingGoogleUser(null);
        updateNativeRoomState(null); // <-- Mengatur ID room menjadi null saat sesi berakhir
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [users, currentUser, pendingGoogleUser, database, currentRoom]);

  // Efek untuk mengambil data (API calls, dll)
  useEffect(() => { fetchTrendingData(); }, [fetchTrendingData]);
  useEffect(() => {
    const getRate = async () => {
      setIsRateLoading(true);
      try { setIdrRate(await fetchIdrRate()); }
      catch (error) { console.error('Gagal ambil kurs IDR:', error); setIdrRate(16000); }
      finally { setIsRateLoading(false); }
    };
    getRate();
  }, []);
  useEffect(() => {
    const fetchList = async () => {
      setIsCoinListLoading(true);
      setCoinListError(null);
      try { setFullCoinList(await fetchTop500Coins()); }
      catch (err) { setCoinListError('Gagal ambil daftar koin.'); }
      finally { setIsCoinListLoading(false); }
    };
    fetchList();
  }, []);
  useEffect(() => {
    const savedNews = localStorage.getItem('cryptoNews');
    const lastFetch = localStorage.getItem('lastNewsFetch');
    const now = Date.now();
    const twentyMinutes = 20 * 60 * 1000;

    if (savedNews) {
      try { setNewsArticles(JSON.parse(savedNews)); } catch (e) { console.error('Gagal load berita dari localStorage:', e); }
    }
    if (!lastFetch || (now - parseInt(lastFetch)) > twentyMinutes) {
      fetchAndStoreNews();
    }
    const newsInterval = setInterval(fetchAndStoreNews, twentyMinutes);
    return () => clearInterval(newsInterval);
  }, [fetchAndStoreNews]);

  // Efek untuk listener database (Rooms, Messages, Typing)
  useEffect(() => {
    if (!database) { console.warn('Firebase rooms listener skipped: DB not initialized.'); return; }
    const roomsRef = safeRef('rooms');
    const listener = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomsArray: Room[] = []; const userCounts: RoomUserCounts = {};
        Object.keys(data).forEach(key => {
          const roomData = data[key];
          if (roomData && typeof roomData === 'object') {
            const userCount = roomData.userCount || 0;
            roomsArray.push({ id: key, name: roomData.name, userCount: userCount, createdBy: roomData.createdBy, isDefaultRoom: roomData.isDefaultRoom || false });
            userCounts[key] = userCount;
          }
        });
        setRoomUserCounts(userCounts);
        const defaultRooms = [ { id: 'berita-kripto', name: 'Berita Kripto', userCount: 0, isDefaultRoom: true }, { id: 'pengumuman-aturan', name: 'Pengumuman & Aturan', userCount: 0, isDefaultRoom: true } ];
        const combinedRooms = [...defaultRooms, ...roomsArray.filter(r => !DEFAULT_ROOM_IDS.includes(r.id))];
        setRooms(combinedRooms);
      }
    }, (error) => { console.error('Firebase rooms listener error:', error); });
    return () => { if (database) off(roomsRef, 'value', listener); };
  }, [database]);

  useEffect(() => {
    if (!database) { console.warn('Messages listener skipped: DB not initialized.'); if (currentRoom?.id) setFirebaseMessages(prev => ({ ...prev, [currentRoom.id]: [] })); return; }
    if (!currentRoom?.id) return;
    if (currentRoom.id === 'berita-kripto') { setFirebaseMessages(prev => ({ ...prev, [currentRoom.id]: [] })); return; }

    const messagesRef = safeRef(`messages/${currentRoom.id}`);
    const listener = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val(); const messagesArray: ForumMessageItem[] = [];
      if (data) {
        Object.keys(data).forEach(key => {
          const msgData = data[key];
          if (msgData && typeof msgData === 'object' && ((msgData.timestamp && typeof msgData.timestamp === 'number') || (msgData.published_on && typeof msgData.published_on === 'number'))) {
            let type: 'news' | 'user' | 'system' | undefined = msgData.type;
            if (!type) {
              if ('published_on' in msgData && 'source' in msgData) type = 'news';
              else if (msgData.sender === 'system') type = 'system';
              else if ('sender' in msgData) type = 'user';
            }
            if (type === 'news' || type === 'user' || type === 'system') {
              const reactions = typeof msgData.reactions === 'object' && msgData.reactions !== null ? msgData.reactions : {};
              const uid = type === 'user' ? msgData.uid : undefined;
              const timestamp = type === 'news' ? msgData.published_on * 1000 : msgData.timestamp;
              const userCreationDate = type === 'user' ? msgData.userCreationDate : undefined;
              messagesArray.push({  ...msgData,  id: key,  type,  reactions,  uid,  timestamp, ...(userCreationDate && { userCreationDate }) });
            } else { console.warn('Invalid or missing message type:', key, msgData); }
          } else { console.warn('Invalid message structure or missing timestamp/published_on:', key, msgData); }
        });
      }
      const finalMessages = messagesArray.sort((a, b) => {
        const timeA = isNewsArticle(a) ? (a.published_on * 1000) : (isChatMessage(a) ? a.timestamp : 0);
        const timeB = isNewsArticle(b) ? (b.published_on * 1000) : (isChatMessage(b) ? b.timestamp : 0);
        if (!timeA && !timeB) return 0; if (!timeA) return 1; if (!timeB) return -1;
        return timeA - timeB;
      });
      setFirebaseMessages(prev => ({ ...prev, [currentRoom.id!]: finalMessages }));
    }, (error) => {
      console.error(`Firebase listener error room ${currentRoom?.id}:`, error);
      if (currentRoom?.id) setFirebaseMessages(prev => ({ ...prev, [currentRoom.id]: [] }));
    });
    return () => { if (database) off(messagesRef, 'value', listener); };
  }, [currentRoom, database]);

  // --- LOGIKA UNREAD COUNT (MEMASTIKAN PESAN SENDIRI DAN DI ROOM AKTIF TIDAK DIHITUNG) ---
  useEffect(() => {
    if (!database) return;
    Object.values(roomListenersRef.current).forEach(unsubscribe => { if (typeof unsubscribe === 'function') { unsubscribe(); } });
    roomListenersRef.current = {};
    joinedRoomIds.forEach(roomId => {
      if (roomId === 'berita-kripto' || roomId === currentRoom?.id) return;
      const messagesRef = safeRef(`messages/${roomId}`);
      const listener = onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) { setUnreadCounts(prev => ({ ...prev, [roomId]: 0 })); return; }
        const lastVisit = userLastVisit[roomId] || 0;
        let newMessagesCount = 0; 
        let hasNewMessageFromOthers = false;
        
        Object.values(data).forEach((msgData: any) => {
          if (!msgData) return;
          const timestamp = msgData.published_on ? msgData.published_on * 1000 : msgData.timestamp;
          const sender = msgData.sender; 
          const isCurrentUser = sender === currentUser?.username; // <-- Cek pesan sendiri

          // Hanya hitung jika: pesan baru, dan BUKAN dari user saat ini, dan room BUKAN room aktif
          if (timestamp > lastVisit && !isCurrentUser && roomId !== currentRoom?.id) { 
            newMessagesCount++; 
            hasNewMessageFromOthers = true; 
          }
        });
        
        // Atur count: jika ada pesan baru dari orang lain DAN user tidak di room
        if (hasNewMessageFromOthers && roomId !== currentRoom?.id) { 
            setUnreadCounts(prev => ({ ...prev, [roomId]: newMessagesCount })); 
        } 
        else { 
            setUnreadCounts(prev => ({ ...prev, [roomId]: 0 })); 
        }
      }, (error) => { console.error(`Listener error untuk room ${roomId}:`, error); });
      roomListenersRef.current[roomId] = () => off(messagesRef, 'value', listener);
    });
    return () => { Object.values(roomListenersRef.current).forEach(unsubscribe => { if (typeof unsubscribe === 'function') { unsubscribe(); } }); roomListenersRef.current = {}; };
  }, [joinedRoomIds, currentRoom, database, userLastVisit, currentUser]);
  // ------------------------------------------------------------------------

  useEffect(() => {
    if (!database) { console.warn("Typing listener skipped: DB not initialized."); return; }
    console.log("[Typing Effect] Setting up listeners for joined rooms:", Array.from(joinedRoomIds));
    Object.values(typingListenersRef.current).forEach(unsubscribe => unsubscribe());
    typingListenersRef.current = {};
    joinedRoomIds.forEach(roomId => {
      if (roomId === 'berita-kripto') return;
      const typingRoomRef = safeRef(`typing/${roomId}`);
      console.log(`[Typing Listener] Attaching to typing/${roomId}`);
      const listener = onValue(typingRoomRef, (snapshot) => {
        const typingData = snapshot.val() as FirebaseTypingStatusData[string] | null;
        console.log(`[Typing Listener] Raw data received for room ${roomId}:`, JSON.stringify(typingData));
        setTypingUsers(prev => {
          const updatedRoomTyping: { [userId: string]: TypingStatus } = {}; const now = Date.now(); let changed = false;
          if (typingData) {
            Object.entries(typingData).forEach(([userId, status]) => {
              if ( status && status.timestamp && now - status.timestamp < TYPING_TIMEOUT && userId !== firebaseUser?.uid ) {
                const username = status.username ?? 'Unknown'; const userCreationDate = status.userCreationDate ?? null; const timestamp = status.timestamp;
                updatedRoomTyping[userId] = { username, userCreationDate, timestamp };
              } else {
                 if (!status || !status.timestamp) console.log(`[Typing Listener] Filtered invalid status for ${userId} in ${roomId}`);
                 else if (!(now - status.timestamp < TYPING_TIMEOUT)) console.log(`[Typing Listener] Filtered timed out status for ${userId} in ${roomId}`);
              }
            });
          }
          const oldRoomData = prev[roomId] || {};
          if (JSON.stringify(oldRoomData) !== JSON.stringify(updatedRoomTyping)) { changed = true; console.log(`[Typing Listener] State change detected for room ${roomId}. New data:`, updatedRoomTyping); }
          if (changed) { const newState = { ...prev, [roomId]: updatedRoomTyping }; return newState; }
          return prev;
        });
      }, (error) => { console.error(`[Typing Listener] Firebase error for room ${roomId}:`, error); setTypingUsers(prev => ({ ...prev, [roomId]: {} })); });
      typingListenersRef.current[roomId] = () => { if(database) { off(typingRoomRef, 'value', listener); console.log(`[Typing Listener] Detached listener from typing/${roomId}`); } };
    });
    return () => { console.log("[Typing Effect] Cleaning up typing listeners."); Object.values(typingListenersRef.current).forEach(unsubscribe => unsubscribe()); typingListenersRef.current = {}; };
  }, [database, joinedRoomIds, firebaseUser?.uid, currentUser]);
  
  // Efek untuk update last visit saat pindah room
  useEffect(() => {
    if (currentRoom?.id) {
      const currentTime = Date.now();
      setUserLastVisit(prev => ({ ...prev, [currentRoom.id]: currentTime }));
      setUnreadCounts(prev => ({ ...prev, [currentRoom.id]: 0 }));
    }
  }, [currentRoom]);

  // --- MEMOIZED VALUES & NOTIFIKASI SUARA ---

  // Logika total unread count untuk MENGHINDARI SUARA/UNREAD JIKA:
  // 1. Sedang di room tersebut (roomId == currentRoom?.id)
  // 2. Notifikasi room dimatikan (notificationSettings[roomId] == false)
  const totalUnreadCount = useMemo(() => {
    return Object.entries(unreadCounts).reduce((total, [roomId, count]) => {
      const isViewingCurrentRoom = roomId === currentRoom?.id;
      const isNotificationDisabled = notificationSettings[roomId] === false;
      
      if (!isViewingCurrentRoom && !isNotificationDisabled) {
        return total + (count || 0);
      }
      return total;
    }, 0);
  }, [unreadCounts, notificationSettings, currentRoom]);

  // **Efek untuk memutar suara in-app** (Mengikuti fungsi sound API)
  useEffect(() => {
    const currentTotal = totalUnreadCount; 
    const previousTotal = prevTotalUnreadRef.current; 
    const now = Date.now();
    
    if (currentTotal > previousTotal && previousTotal > 0 && (now - lastSoundPlayTimeRef.current) > 1000) { 
      playNotificationSound(); 
      lastSoundPlayTimeRef.current = now; 
    }
    prevTotalUnreadRef.current = currentTotal;
  }, [totalUnreadCount]);

  const updatedRooms = useMemo(() => {
    return rooms.map(room => ({ ...room, userCount: roomUserCounts[room.id] || room.userCount || 0 }));
  }, [rooms, roomUserCounts]);
  const totalUsers = useMemo(() => updatedRooms.reduce((sum, r) => sum + (r.userCount || 0), 0), [updatedRooms]);
  const heroCoin = useMemo(() => searchedCoin || trendingCoins[0] || null, [searchedCoin, trendingCoins]);
  const otherTrendingCoins = useMemo(() => searchedCoin ? [] : trendingCoins.slice(1), [searchedCoin, trendingCoins]);
  const hotCoinForHeader = useMemo(() => trendingCoins.length > 1 ? { name: trendingCoins[1].name, logo: trendingCoins[1].image, price: trendingCoins[1].price, change: trendingCoins[1].change } : null, [trendingCoins]);
  const currentTypingUsers = useMemo(() => {
    const currentRoomId = currentRoom?.id;
    if (!currentRoomId || !typingUsers || typeof typingUsers !== 'object') { return []; }
    const roomTypingData = typingUsers[currentRoomId];
    if (!roomTypingData || typeof roomTypingData !== 'object') { return []; }
    const now = Date.now();
    const filteredUsers = Object.entries(roomTypingData)
        .filter(([userId, status]) => {
            const isNotSelf = userId !== firebaseUser?.uid;
            const isValidStatus = status && typeof status.timestamp === 'number';
            const isNotTimedOut = isValidStatus && (now - status.timestamp < TYPING_TIMEOUT);
            return isNotSelf && isValidStatus && isNotTimedOut;
        })
        .map(([userId, status]) => ({ username: status.username, userCreationDate: status.userCreationDate ?? null, timestamp: status.timestamp }));
    return filteredUsers;
  }, [typingUsers, currentRoom, firebaseUser?.uid]);

  // --- RENDER LOGIC ---
  const renderActivePage = () => {
    switch (activePage) {
      case 'home':
        return <HomePage idrRate={idrRate} isRateLoading={isRateLoading} currency={currency} onIncrementAnalysisCount={handleIncrementAnalysisCount} fullCoinList={fullCoinList} isCoinListLoading={isCoinListLoading} coinListError={coinListError} heroCoin={heroCoin} otherTrendingCoins={otherTrendingCoins} isTrendingLoading={isTrendingLoading} trendingError={trendingError} onSelectCoin={handleSelectCoin} onReloadTrending={handleResetToTrending} />;
      case 'rooms':
        return <RoomsListPage 
          rooms={updatedRooms} onJoinRoom={handleJoinRoom} onCreateRoom={handleCreateRoom} totalUsers={totalUsers} hotCoin={hotCoinForHeader} userProfile={currentUser} currentRoomId={currentRoom?.id || null} joinedRoomIds={joinedRoomIds} onLeaveJoinedRoom={handleLeaveJoinedRoom} unreadCounts={unreadCounts} onDeleteRoom={handleDeleteRoom} onToggleNotification={handleToggleNotification} notificationSettings={notificationSettings} />;
      case 'forum': {
        let displayMessages: ForumMessageItem[] = [];
        if (currentRoom) {
          if (currentRoom.id === 'berita-kripto') { displayMessages = newsArticles; } 
          else { displayMessages = firebaseMessages[currentRoom.id] || []; }
        }
        const messagesToPass = Array.isArray(displayMessages) ? displayMessages : [];
        console.log(`[Render ForumPage] Passing ${currentTypingUsers.length} typing users to ForumPage for room ${currentRoom?.id}:`, currentTypingUsers);
        return <ForumPage 
          room={currentRoom} messages={messagesToPass} userProfile={currentUser} onSendMessage={handleSendMessage} onLeaveRoom={handleLeaveRoom} onReact={handleReaction} onDeleteMessage={handleDeleteMessage} typingUsers={currentTypingUsers} onStartTyping={handleStartTyping} onStopTyping={handleStopTyping} />;
      }
      case 'about':
        return <AboutPage />;
      default:
        setPageHistory(['home']);
        return null;
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-transparent text-white flex items-center justify-center">Memverifikasi sesi Anda...</div>;
  }
  
  let contentToRender;
  if (firebaseUser) {
    if (pendingGoogleUser) {
      contentToRender = <CreateIdPage onProfileComplete={handleProfileComplete} googleProfile={pendingGoogleUser} />;
    } else if (currentUser && currentUser.username) {
      contentToRender = (
        <>
          <Header userProfile={currentUser} onLogout={handleLogout} activePage={activePage} onNavigate={navigateTo} currency={currency} onCurrencyChange={setCurrency} hotCoin={hotCoinForHeader} idrRate={idrRate} />
          <main className="flex-grow">{renderActivePage()}</main>
          <Footer />
        </>
      );
    } else if (currentUser && !currentUser.username) {
      console.warn('User logged in but missing username, showing CreateIdPage again.');
      if (currentUser.googleProfilePicture && currentUser.email) {
        contentToRender = <CreateIdPage onProfileComplete={handleProfileComplete} googleProfile={{ email: currentUser.email, name: currentUser.email, picture: currentUser.googleProfilePicture }} />;
      } else {
        console.error('Cannot show CreateIdPage: missing Google profile data. Forcing logout.');
        handleLogout();
        contentToRender = <LoginPage onGoogleRegisterSuccess={handleGoogleRegisterSuccess} />;
      }
    } else {
      console.error('Invalid state: Firebase user exists but no local user or pending Google user. Forcing logout.');
      handleLogout();
      contentToRender = <LoginPage onGoogleRegisterSuccess={handleGoogleRegisterSuccess} />;
    }
  } else {
    contentToRender = <LoginPage onGoogleRegisterSuccess={handleGoogleRegisterSuccess} />;
  }

  return (
    <div className="min-h-screen bg-transparent text-white font-sans flex flex-col">
      <Particles />
      {contentToRender}
      {authError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white p-3 rounded-lg shadow-lg z-50">
          Error: {authError} <button onClick={() => setAuthError(null)} className="ml-2 text-sm underline">Tutup</button>
        </div>
      )}
    </div>
  );
};

// Komponen <App> Anda tetap utuh
const App: React.FC = () => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

  if (!database && googleClientId) {
    return (
      <div style={{ color: 'white', backgroundColor: '#0A0A0A', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ border: '1px solid #FF00FF', padding: '20px', borderRadius: '8px', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ color: '#FF00FF', fontSize: '24px' }}>Kesalahan Koneksi Database</h1>
          <p style={{ marginTop: '10px', lineHeight: '1.6' }}>
            Gagal terhubung ke Firebase Realtime Database. Periksa konfigurasi Firebase Anda (terutama <code>FIREBASE_DATABASE_URL</code>) dan koneksi internet.
          </p>
        </div>
      </div>
    );
  }

  if (!googleClientId) {
    return (
      <div style={{ color: 'white', backgroundColor: '#0A0A0A', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ border: '1px solid #FF00FF', padding: '20px', borderRadius: '8px', textAlign: 'center', maxWidth: '500px' }}>
          <h1 style={{ color: '#FF00FF', fontSize: '24px' }}>Kesalahan Konfigurasi</h1>
          <p style={{ marginTop: '10px', lineHeight: '1.6' }}>
            Variabel lingkungan <strong>GOOGLE_CLIENT_ID</strong> tidak ditemukan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AppContent />
    </GoogleOAuthProvider>
  );
};

export default App;