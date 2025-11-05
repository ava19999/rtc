// ava19999/rtc/rtc-09b2646bbe674aaaa08c62f5338b30469b9e2c8d/App.tsx
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
  fetchCoinDetails,
  fetchSpecificCoins // <-- IMPOR FUNGSI BARU
} from './services/mockData';
import { ADMIN_USERNAMES } from './components/UserTag';
import { database, getDatabaseInstance, testDatabaseConnection } from './services/firebaseService';
import { 
  ref, set, push, onValue, off, update, get, Database, remove, onDisconnect,
  query, orderByChild, equalTo // Pastikan query diimpor
} from 'firebase/database';

// --- PERUBAHAN DI SINI ---
const DEFAULT_ROOM_IDS = ['berita-kripto', 'pengumuman-aturan', 'tanya-atmin'];
// --- AKHIR PERUBAHAN ---

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
  // Memanggil bridge method yang ada di MainActivity
  if (typeof (window as any).AndroidBridge?.setCurrentRoomId === 'function') {
    (window as any).AndroidBridge.setCurrentRoomId(roomId || '');
    console.log(`[Bridge] Current room ID set to: ${roomId || 'null'}`);
  }
};

// Helper function to update native user state
const updateNativeUserState = (userId: string | null) => {
  if (typeof (window as any).AndroidBridge?.setCurrentUserId === 'function') {
    (window as any).AndroidBridge.setCurrentUserId(userId || '');
    console.log(`[Bridge] Current user ID set to: ${userId || 'null'}`);
  }
};

// Helper function to update native sound settings
const updateNativeSoundState = (enabled: boolean) => {
  if (typeof (window as any).AndroidBridge?.setNotificationSoundEnabled === 'function') {
    (window as any).AndroidBridge.setNotificationSoundEnabled(enabled);
    console.log(`[Bridge] Notification sound set to: ${enabled}`);
  }
};

const AppContent: React.FC = () => {
  // --- STATE DEFINITIONS ---
  const [pageHistory, setPageHistory] = useState<Page[]>(['home']);
  const activePage = useMemo(() => pageHistory[pageHistory.length - 1], [pageHistory]);
  const [currency, setCurrency] = useState<Currency>('usd');
  const [idrRate, setIdrRate] = useState<number | null>(null);
  const [isRateLoading, setIsRateLoading] = useState(true);
  
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
  
  // --- TAMBAHAN STATE BARU UNTUK HERO ---
  const [staticHeroCoins, setStaticHeroCoins] = useState<CryptoData[]>([]);
  const [isStaticHeroLoading, setIsStaticHeroLoading] = useState(true);
  const [staticHeroError, setStaticHeroError] = useState<string | null>(null);
  // --- AKHIR TAMBAHAN STATE ---

  // --- PERUBAHAN DI SINI ---
  const [rooms, setRooms] = useState<Room[]>([
    { id: 'berita-kripto', name: 'Berita Kripto', userCount: 0, isDefaultRoom: true },
    { id: 'pengumuman-aturan', name: 'Pengumuman & Aturan', userCount: 0, isDefaultRoom: true },
    { id: 'tanya-atmin', name: 'Tanya #atmin', userCount: 0, isDefaultRoom: true }
  ]);
  // --- AKHIR PERUBAHAN ---
  
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

  // --- TAMBAHAN REF UNTUK DETEKSI KOIN BARU ---
  // Menyimpan ID koin dari daftar peluang sebelumnya
  const prevOpportunityIdsRef = useRef<Set<string>>(new Set());
  // --- AKHIR TAMBAHAN REF ---

  const prevTotalUnreadRef = useRef<number>(0);
  const lastSoundPlayTimeRef = useRef<number>(0);
  const roomListenersRef = useRef<{ [roomId: string]: () => void }>({});
  const lastProcessedTimestampsRef = useRef<{ [roomId: string]: number }>({});
  const userSentMessagesRef = useRef<Set<string>>(new Set());

  // --- FUNCTION DEFINITIONS (useCallback) ---
  
  const leaveCurrentRoom = useCallback(() => {
    if (!currentRoom?.id) return;
    
    const currentTime = Date.now();
    const roomId = currentRoom.id;
    
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
    updateNativeRoomState(null); 

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
      const auth = getAuth();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      
      await signInWithCredential(auth, googleCredential);
      console.log("Android sign-in credential submitted. Waiting for onAuthStateChanged...");

    } catch (error: any) {
      console.error('Firebase signInWithCredential error (from Android):', error);
      let errMsg = 'Gagal menghubungkan login Google ke Firebase.';
      if (error.code === 'auth/account-exists-with-different-credential') errMsg = 'Akun dengan email ini sudah ada.';
      setAuthError(errMsg);
      if (currentUser) setCurrentUser(null);
    }
  }, [currentUser]);

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

  const handleToggleNotification = useCallback((roomId: string, enabled: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [roomId]: enabled
    }));
    
    updateNativeSoundState(enabled);
    
    if (typeof (window as any).AndroidBridge?.subscribeToRoom === 'function' && !DEFAULT_ROOM_IDS.includes(roomId)) {
        if (enabled) {
            (window as any).AndroidBridge.subscribeToRoom(roomId);
            console.log(`[Bridge-FCM] Subscribed to topic for room: ${roomId}`);
        } else {
            (window as any).AndroidBridge.unsubscribeFromRoom(roomId);
            console.log(`[Bridge-FCM] Unsubscribed from topic for room: ${roomId}`);
        }
    }

    if (currentRoom?.id === roomId) {
        updateNativeRoomState(roomId);
    }
  }, [currentRoom]);

  // --- MODIFIKASI fetchTrendingData ---
  const fetchTrendingData = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) { setIsTrendingLoading(true); setTrendingError(null); }
    try { 
      const newTrendingCoins = await fetchTrendingCoins();
      setTrendingCoins(newTrendingCoins); 

      // --- LOGIKA NOTIFIKASI DIMULAI ---
      if (newTrendingCoins.length > 0) {
        // Ambil ID dari *semua* koin trending
        const newOpportunityIds = new Set(newTrendingCoins.map(c => c.id));
        const previousIds = prevOpportunityIdsRef.current;

        // Hanya cek jika ini bukan fetch pertama kali (previousIds sudah ada isinya)
        if (previousIds.size > 0) {
          const newlyAddedCoins: CryptoData[] = [];
          for (const coin of newTrendingCoins) {
            // Jika koin baru tidak ada di daftar ID sebelumnya, berarti koin baru
            if (!previousIds.has(coin.id)) {
              newlyAddedCoins.push(coin);
            }
          }
          
          // Jika ada koin baru
          if (newlyAddedCoins.length > 0) {
            console.log("Peluang baru terdeteksi:", newlyAddedCoins.map(c => c.name));
            
            // Kirim notifikasi untuk koin baru pertama yang terdeteksi
            const firstNewCoin = newlyAddedCoins[0];
            const messageBody = `Peluang Baru: ${firstNewCoin.name} (${firstNewCoin.symbol}) terdeteksi!`;

            // Panggil API serverless baru kita
            fetch('/api/sendOpportunityNotification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messageBody: messageBody,
                coinName: firstNewCoin.name,
                coinId: firstNewCoin.id,
                coinImage: firstNewCoin.image // <-- Kirim logo
              }),
            }).catch(err => console.error('Gagal trigger notifikasi peluang:', err));
          }
        }
        
        // Update ref dengan ID baru untuk perbandingan berikutnya
        prevOpportunityIdsRef.current = newOpportunityIds;
      }
      // --- LOGIKA NOTIFIKASI SELESAI ---

    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal memuat data tren.';
      if (showSkeleton) setTrendingError(errorMessage);
      else console.error('Gagal menyegarkan data tren:', errorMessage);
    } finally { if (showSkeleton) setIsTrendingLoading(false); }
  }, []); // <-- Tidak ada dependensi state
  // --- AKHIR MODIFIKASI ---

  // --- TAMBAHKAN FUNGSI BARU INI ---
  const fetchStaticHeroData = useCallback(async () => {
    setIsStaticHeroLoading(true);
    setStaticHeroError(null);
    try {
      const coinIds = ['bitcoin', 'ethereum', 'solana'];
      const coins = await fetchSpecificCoins(coinIds);
      // Pastikan urutan BTC, ETH, SOL
      const orderedCoins = coinIds.map(id => coins.find(c => c.id === id)).filter(Boolean) as CryptoData[];
      setStaticHeroCoins(orderedCoins);
    } catch (err) {
      setStaticHeroError(err instanceof Error ? err.message : 'Gagal memuat data hero coin.');
    } finally {
      setIsStaticHeroLoading(false);
    }
  }, []);
  // --- AKHIR TAMBAHAN FUNGSI ---

  const handleResetToTrending = useCallback(() => {
    setSearchedCoin(null);
  }, []);

  const handleReloadPage = useCallback(() => {
    console.log("Reload page requested by user.");
    // Muat ulang kedua set data
    fetchTrendingData(true);
    fetchStaticHeroData();
  }, [fetchTrendingData, fetchStaticHeroData]);

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
    if (!credentialResponse.credential) { 
      setAuthError('Credential Google tidak ditemukan.'); 
      return; 
    }
    try {
      const auth = getAuth();
      const googleCredential = GoogleAuthProvider.credential(credentialResponse.credential);
      
      await signInWithCredential(auth, googleCredential);
      console.log("Google sign-in credential submitted. Waiting for onAuthStateChanged...");

    } catch (error: any) {
      console.error('Google login/Firebase error:', error);
      let errMsg = 'Gagal memproses login Google.';
      if (error.code === 'auth/account-exists-with-different-credential') {
        errMsg = 'Akun dengan email ini sudah ada, gunakan metode login lain.';
      } else if (error.message) {
        errMsg += ` (${error.message})`;
      }
      setAuthError(errMsg);
      if (currentUser) setCurrentUser(null);
    }
  }, [currentUser]);

  const handleProfileComplete = useCallback(async (username: string, password: string): Promise<string | void> => {
    setAuthError(null);
    if (!pendingGoogleUser) { setAuthError('Data Google tidak ditemukan.'); return 'Data Google tidak ditemukan.'; }
    if (!firebaseUser) { setAuthError('Sesi Firebase tidak aktif.'); return 'Sesi Firebase tidak aktif.'; }
    if (!database) { setAuthError('Database tidak terhubung.'); return 'Database tidak terhubung.'; }

    const trimmedUsername = username.trim();
    
    // Cek keunikan username di database
    const usernameRef = safeRef(`usernames/${trimmedUsername.toLowerCase()}`);
    const usernameSnapshot = await get(usernameRef);

    if (usernameSnapshot.exists()) {
      const errorMsg = 'Username sudah digunakan. Pilih username lain.';
      setAuthError(errorMsg);
      return errorMsg;
    }

    const newUser: User = {
      email: pendingGoogleUser.email,
      username: trimmedUsername,
      googleProfilePicture: pendingGoogleUser.picture,
      createdAt: Date.now()
    };

    const userRef = safeRef(`users/${firebaseUser.uid}`);
    
    try {
      await set(userRef, newUser);
      await set(usernameRef, firebaseUser.uid); // Simpan indeks username

      setCurrentUser(newUser);
      setPendingGoogleUser(null);
      setPageHistory(['home']); 

      updateNativeUserState(trimmedUsername);

    } catch (dbError) {
      console.error("Gagal menyimpan user baru ke RTDB:", dbError);
      const errorMsg = "Gagal menyimpan profil. Coba lagi.";
      setAuthError(errorMsg);
      return errorMsg;
    }

  }, [pendingGoogleUser, firebaseUser, database]);

  // --- MODIFIKASI handleLogout ---
  const handleLogout = useCallback(() => {
    leaveCurrentRoom();
    updateNativeRoomState(null); 
    updateNativeUserState(null);

    // --- TAMBAHAN: UNSUBSCRIBE DARI TOPIK PELUANG ---
    if (typeof (window as any).AndroidBridge?.unsubscribeFromRoom === 'function') {
      (window as any).AndroidBridge.unsubscribeFromRoom('peluang_baru'); // <-- Diganti
      console.log('[Bridge-FCM] Unsubscribed from peluang_baru topic.');
    }
    // --- AKHIR TAMBAHAN ---

    const auth = getAuth();
    signOut(auth)
      .then(() => {
        setPageHistory(['home']); 
      })
      .catch((error) => {
        console.error('Firebase signOut error:', error);
        setCurrentUser(null);
        setFirebaseUser(null);
        setPageHistory(['home']);
      });
  }, [leaveCurrentRoom]);
  // --- AKHIR MODIFIKASI ---

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
        handleResetToTrending(); 
      } else {
        setPageHistory(prev => [...prev, 'home']);
      }
    } else if (page === 'forum') {
      if (currentPage === 'forum' && currentRoom) {
         // Sudah di forum, jangan lakukan apa-apa
      } else {
        setPageHistory(prev => [...prev, 'rooms']);
      }
    } else if (page !== currentPage) {
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
      setPageHistory(prev => prev.slice(0, -1)); 
      return true; // DITANGANI
    }

    console.log("[Back Button] Already at root. Let Android exit.");
    return false; // TIDAK DITANGANI
  }, [pageHistory, leaveCurrentRoom, searchedCoin, handleResetToTrending]);

  useEffect(() => {
    console.log("Attaching functions to window for AndroidBridge...");
    (window as any).handleAndroidLoginToken = handleAndroidLoginToken;
    (window as any).handleAndroidBackButton = handleAndroidBackButton;
    
    return () => {
      console.log("Cleaning up window functions for AndroidBridge.");
      delete (window as any).handleAndroidLoginToken;
      delete (window as any).handleAndroidBackButton;
    };
  }, [handleAndroidLoginToken, handleAndroidBackButton]);

  const handleJoinRoom = useCallback((room: Room) => {
    setCurrentRoom(room);
    updateNativeRoomState(room.id); 
    
    const notificationsEnabled = room.id ? (notificationSettings[room.id] !== false) : true;
    
    if (typeof (window as any).AndroidBridge?.subscribeToRoom === 'function' && notificationsEnabled && !DEFAULT_ROOM_IDS.includes(room.id)) {
      (window as any).AndroidBridge.subscribeToRoom(room.id);
      console.log(`[Bridge-FCM] Subscribed to topic: ${room.id} on join.`);
    } else {
         console.log(`[Bridge-FCM] Subscription skipped for room: ${room.id} (Disabled or Default).`);
    }

    const isFirstTimeJoin = !hasJoinedRoom[room.id];
    
    setJoinedRoomIds(prev => new Set(prev).add(room.id));
    setPageHistory(prev => [...prev, 'forum']);
    
    if (!room.isDefaultRoom) {
      if (isFirstTimeJoin) {
          updateRoomUserCount(room.id, true); 
          console.log(`[handleJoinRoom] First time join. Incremented user count for room: ${room.id}`);
          setHasJoinedRoom(prev => ({
            ...prev,
            [room.id]: true
          }));
      } else {
          console.log(`[handleJoinRoom] User is already a member. Not incrementing count for room: ${room.id}`);
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
    handleAndroidBackButton();
  }, [handleAndroidBackButton]);
  
  const handleLeaveJoinedRoom = useCallback((roomId: string) => {
    if (DEFAULT_ROOM_IDS.includes(roomId)) return;
    
    if (typeof (window as any).AndroidBridge?.unsubscribeFromRoom === 'function') {
      (window as any).AndroidBridge.unsubscribeFromRoom(roomId);
      console.log(`[Bridge] Unsubscribed from topic: ${roomId} on permanent leave.`);
    }
    
    if (hasJoinedRoom[roomId]) {
      updateRoomUserCount(roomId, false); 
      console.log(`[handleLeaveJoinedRoom] Decremented user count for room: ${roomId}`);
      setHasJoinedRoom(prev => ({
        ...prev,
        [roomId]: false
      }));
    }
    
    if (currentRoom?.id === roomId) { 
      leaveCurrentRoom();
      setPageHistory(prev => prev.slice(0, -1)); 
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
      userCount: 0, // Diubah ke 0, akan di-handle oleh handleJoinRoom
      createdBy: currentUser.username, 
      createdById: firebaseUser.uid, // Ditambahkan untuk cek kepemilikan
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
        // setHasJoinedRoom sudah diurus oleh handleJoinRoom
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
      const isCreator = roomToDelete.createdById === firebaseUser.uid; // Cek kepemilikan via UID

      if (!isAdmin && !isCreator) {
        alert('Hanya admin atau pembuat room yang dapat menghapus room ini.');
        return;
      }
        
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
            
          })
          .catch(error => {
            console.error(`Gagal menghapus room ${roomId}:`, error);
            alert('Gagal menghapus room. Periksa koneksi atau izin Anda.');
          });
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
      
      set(newMessageRef, messageToSend)
        .then(() => {
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
  
  useEffect(() => { 
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
  
  useEffect(() => { localStorage.setItem('roomNotificationSettings', JSON.stringify(notificationSettings)); }, [notificationSettings]);
  useEffect(() => { try { if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser)); else localStorage.removeItem('currentUser'); } catch (e) { console.error('Gagal simpan currentUser', e); } }, [currentUser]);
  useEffect(() => { try { localStorage.setItem('joinedRoomIds', JSON.stringify(Array.from(joinedRoomIds))); } catch (e) { console.error('Gagal simpan joined rooms', e); } }, [joinedRoomIds]);
  useEffect(() => { localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts)); }, [unreadCounts]);
  useEffect(() => { localStorage.setItem('userLastVisit', JSON.stringify(userLastVisit)); }, [userLastVisit]);
  useEffect(() => { try { localStorage.setItem('hasJoinedRoom', JSON.stringify(hasJoinedRoom)); } catch (e) { console.error('Gagal simpan hasJoinedRoom', e); } }, [hasJoinedRoom]);

  // --- MODIFIKASI useEffect onAuthStateChanged ---
  useEffect(() => {
    if (!database) {
      console.warn('Firebase Auth listener skipped: Database not initialized.');
      setIsAuthLoading(false);
      return;
    }
    const auth = getAuth();
    setIsAuthLoading(true);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        // User login ke Firebase
        console.log(`[Auth] Firebase user ${user.uid} logged in.`);
        
        // Cek apakah user ini sudah ada di database kita?
        const userRef = safeRef(`users/${user.uid}`);
        try {
          const snapshot = await get(userRef);
  
          if (snapshot.exists()) {
            // --- PENGGUNA LAMA / PENGGUNA KEMBALI ---
            const appUser = snapshot.val() as User;
            console.log(`[Auth] User profile found in RTDB:`, appUser.username);
            
            setCurrentUser(appUser);
            setPendingGoogleUser(null);
            
            updateNativeUserState(appUser.username);

            // --- TAMBAHAN: SUBSCRIBE KE TOPIK PELUANG ---
            if (typeof (window as any).AndroidBridge?.subscribeToRoom === 'function') {
              (window as any).AndroidBridge.subscribeToRoom('peluang_baru'); // <-- Diganti
              console.log('[Bridge-FCM] Subscribed to peluang_baru topic.');
            }
            // --- AKHIR TAMBAHAN ---
  
            if (database && currentRoom?.id) {
              try {
                const typingRef = safeRef(`typing/${currentRoom.id}/${user.uid}`);
                onDisconnect(typingRef).remove();
                console.log(`[AUTH] onDisconnect set for typing status in room ${currentRoom.id}`);
              } catch(e) { console.error("[AUTH] Error setting onDisconnect for typing status:", e); }
            }
          } else {
            // --- PENGGUNA GOOGLE BARU (BELUM BUAT USERNAME) ---
            console.log(`[Auth] No user profile found in RTDB for ${user.uid}.`);
            if (user.email && user.displayName && user.photoURL) {
              setPendingGoogleUser({
                email: user.email,
                name: user.displayName,
                picture: user.photoURL
              });
            } else {
              console.error("[Auth] Firebase user exists but has no profile data and no DB record.");
              handleLogout(); 
            }
            setCurrentUser(null);
          }
        } catch (dbError) {
          console.error("[Auth] Error fetching user from RTDB:", dbError);
          setAuthError("Gagal mengambil profil user.");
          handleLogout(); 
        }
      } else {
        // --- PENGGUNA LOGOUT ---
        console.log("[Auth] Firebase user logged out.");
        setCurrentUser(null); 
        setPendingGoogleUser(null);
        updateNativeRoomState(null);
        updateNativeUserState(null);
      }
      setIsAuthLoading(false);
    });
    
    return () => unsubscribe();
  }, [database, currentRoom, handleLogout]); // handleLogout ditambahkan sebagai dependency
  // --- AKHIR MODIFIKASI ---


  // --- MODIFIKASI useEffect fetch data ---
  useEffect(() => { 
    fetchTrendingData();
    fetchStaticHeroData(); // <-- PANGGIL FUNGSI BARU
  }, [fetchTrendingData, fetchStaticHeroData]); // <-- Tambahkan dependensi
  
  useEffect(() => {
    const getRate = async () => {
      setIsRateLoading(true);
      try { setIdrRate(await fetchIdrRate()); }
      catch (error) { console.error('Gagal ambil kurs IDR:', error); setIdrRate(16000); }
      finally { setIsRateLoading(false); }
    };
    getRate();
  }, []);
  // ... (useEffect lainnya: fetchList, fetchAndStoreNews)
  // ... (useEffect listeners: rooms, messages, unread, typing, currentRoom)
  // ... (useMemo: totalUnreadCount, useEffect notif suara, updatedRooms, totalUsers)

  // --- PERUBAHAN PADA MEMO INI ---
  // heroCoin (trending[0]) dan otherTrendingCoins (sisanya) sekarang HANYA untuk "Peluang Pasar Lainnya"
  const heroCoin = useMemo(() => searchedCoin || trendingCoins[0] || null, [searchedCoin, trendingCoins]);
  const otherTrendingCoins = useMemo(() => searchedCoin ? [] : trendingCoins.slice(1), [searchedCoin, trendingCoins]);
  // --- AKHIR PERUBAHAN MEMO ---

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
        return <HomePage 
                  idrRate={idrRate} 
                  isRateLoading={isRateLoading} 
                  currency={currency} 
                  onIncrementAnalysisCount={handleIncrementAnalysisCount} 
                  fullCoinList={fullCoinList} 
                  isCoinListLoading={isCoinListLoading} 
                  coinListError={coinListError} 
                  
                  // --- Props untuk "Peluang Pasar Lainnya" ---
                  heroCoin={heroCoin} 
                  otherTrendingCoins={otherTrendingCoins} 
                  isTrendingLoading={isTrendingLoading} 
                  trendingError={trendingError} 
                  
                  // --- Props BARU untuk Hero Carousel ---
                  staticHeroCoins={staticHeroCoins}
                  isStaticHeroLoading={isStaticHeroLoading}
                  staticHeroError={staticHeroError}
                  
                  onSelectCoin={handleSelectCoin} 
                  onReloadTrending={handleReloadPage} // Ganti ke handleReloadPage
                />;
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
      // Ini seharusnya tidak terjadi lagi dengan logika RTDB yang baru, tapi sebagai penjaga
      console.warn('User logged in but missing username, showing CreateIdPage again.');
      if (currentUser.googleProfilePicture && currentUser.email) {
        contentToRender = <CreateIdPage onProfileComplete={handleProfileComplete} googleProfile={{ email: currentUser.email, name: currentUser.email, picture: currentUser.googleProfilePicture }} />;
      } else {
        console.error('Cannot show CreateIdPage: missing Google profile data. Forcing logout.');
        handleLogout();
        contentToRender = <LoginPage onGoogleRegisterSuccess={handleGoogleRegisterSuccess} />;
      }
    } else {
      // Ini adalah state normal saat onAuthStateChanged sedang memeriksa RTDB
      console.log("[Render] Waiting for RTDB user profile lookup...");
      return <div className="min-h-screen bg-transparent text-white flex items-center justify-center">Mengambil profil Anda...</div>;
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