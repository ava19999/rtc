// types.ts
import type { CredentialResponse } from '@react-oauth/google';

// --- Basic Types ---
export type Page = 'home' | 'rooms' | 'forum' | 'about';
export type Currency = 'usd' | 'idr';

// --- Authentication Types ---
export interface GoogleProfile {
  email: string;
  name: string;
  picture: string;
}

export interface User {
  email: string;
  username: string;
  password?: string;
  googleProfilePicture?: string;
  createdAt: number;
}

// --- Crypto Data Types ---
export interface CryptoData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  image: string;
  sparkline_in_7d: {
    price: number[];
  };
  high_24h: number;
  low_24h: number;
  market_cap: number;
}

export interface AnalysisResult {
  position: 'Long' | 'Short';
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  confidence: string;
  reasoning: string;
}

export interface ExchangeTicker {
  name: string;
  logo: string;
  price: number;
  tradeUrl: string;
}

export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
}

export interface MarketDominance {
  btc: number;
  usdt: number;
  alts: number;
}

// --- Forum Types ---
export interface Room {
  id: string;
  name: string;
  userCount: number;
  createdBy?: string;
  isDefaultRoom?: boolean; // Ditambahkan untuk identifikasi room default
}

export interface NewsArticle {
  id: string;
  type: 'news';
  title: string;
  url: string;
  imageurl: string;
  published_on: number;
  source: string;
  body: string;
  reactions?: { [key: string]: string[] };
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  uid?: string;
  text?: string;
  sender: string;
  timestamp: number;
  fileURL?: string;
  fileName?: string;
  reactions?: { [key: string]: string[] };
  userCreationDate?: number;
}

export type ForumMessageItem = NewsArticle | ChatMessage;

// --- Typing Indicator Types ---
export interface TypingStatus {
  username: string;
  userCreationDate: number | null; // Tambahkan ini
  timestamp: number;
}

export interface TypingUsersMap {
  [roomId: string]: {
    [userId: string]: TypingStatus;
  };
}


// --- Notification Types ---
export interface NotificationSettings {
  [roomId: string]: boolean;
}

// --- User Count Types ---
export interface RoomUserCounts {
  [roomId: string]: number;
}

// --- User Activity Types ---
export interface UserActivityData {
  [roomId: string]: {
    users: string[];
    lastUpdated: number;
  };
}

// --- Type Guards ---
export const isNewsArticle = (item: ForumMessageItem | null | undefined): item is NewsArticle => {
    return !!item && item.type === 'news' && typeof (item as NewsArticle).published_on === 'number';
};

export const isChatMessage = (item: ForumMessageItem | null | undefined): item is ChatMessage => {
     return !!item && (item.type === 'user' || item.type === 'system') && typeof (item as ChatMessage).timestamp === 'number';
};

// --- Component Props Interfaces ---
export interface HeaderProps {
  userProfile: User | null;
  onLogout: () => void;
  activePage: Page;
  onNavigate: (page: Page) => void;
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  hotCoin: { name: string; logo: string; price: number; change: number; } | null;
  idrRate: number | null;
}

export interface HomePageProps {
  idrRate: number | null;
  isRateLoading: boolean;
  currency: Currency;
  onIncrementAnalysisCount: (coinId: string) => void;
  fullCoinList: CoinListItem[];
  isCoinListLoading: boolean;
  coinListError: string | null;
  heroCoin: CryptoData | null;
  otherTrendingCoins: CryptoData[];
  isTrendingLoading: boolean;
  trendingError: string | null;
  onSelectCoin: (coinId: string) => void;
  onReloadTrending: () => void;
}

export interface ForumPageProps {
  room: Room | null;
  messages: ForumMessageItem[];
  userProfile: User | null;
  onSendMessage: (message: Partial<ChatMessage>) => void;
  onLeaveRoom: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteMessage: (roomId: string, messageId: string) => void;
  // forumActiveUsers?: number; // <-- DIHAPUS
  // Tambahkan props untuk typing indicator
  typingUsers: TypingStatus[];
  onStartTyping: () => void;
  onStopTyping: () => void;
}


export interface RoomsListPageProps {
  rooms: Room[];
  onJoinRoom: (room: Room) => void;
  onCreateRoom: (roomName: string) => void;
  totalUsers: number;
  hotCoin: { name: string; logo: string; price: number; change: number; } | null;
  userProfile: User | null;
  currentRoomId: string | null;
  joinedRoomIds: Set<string>;
  onLeaveJoinedRoom: (roomId: string) => void;
  unreadCounts: { [key: string]: number };
  onDeleteRoom: (roomId: string) => void;
  onToggleNotification: (roomId: string, enabled: boolean) => void;
  notificationSettings: NotificationSettings;
}

export interface RoomListItemProps {
  room: Room;
  currentUser: User | null;
  onJoinRoom: (room: Room) => void;
  onLeaveRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onToggleNotification: (roomId: string, enabled: boolean) => void;
  isActive: boolean;
  isJoined: boolean;
  unreadCount: number;
  notificationEnabled: boolean;
}

export interface HeroCoinProps {
  crypto: CryptoData;
  onAnalyze: (crypto: CryptoData) => void;
  idrRate: number | null;
  currency: Currency;
}

export interface CryptoCardProps {
  crypto: CryptoData;
  onAnalyze: (crypto: CryptoData) => void;
  idrRate: number | null;
  currency: Currency;
}

export interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  crypto: CryptoData;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  exchangeTickers: ExchangeTicker[];
  isTickersLoading: boolean;
  tickersError: string | null;
  idrRate: number | null;
  currency: Currency;
}

export interface LoginPageProps {
  onGoogleRegisterSuccess: (credentialResponse: CredentialResponse) => void;
}

export interface CreateIdPageProps {
  onProfileComplete: (username: string, password: string) => Promise<string | void>;
  googleProfile: GoogleProfile;
}

// --- Reaction Types ---
export interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export interface ReactionsProps {
  message: NewsArticle | ChatMessage | undefined | null;
  username: string;
  onReact: (emoji: string) => void;
}

export interface DeleteButtonProps {
  onClick: (e: React.MouseEvent) => void;
}

export interface ReactButtonProps {
  onClick: (e: React.MouseEvent) => void;
}

// --- Message Component Types ---
export interface NewsMessageProps {
  article: NewsArticle;
  username: string;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteClick: () => void;
  canDelete: boolean;
  isActive: boolean;
  showActions: boolean;
  onMessageClick: () => void;
  onReactButtonClick: (e: React.MouseEvent) => void;
  onImageClick: (url: string) => void;
}

export interface UserMessageProps {
  message: ChatMessage;
  userProfile: User | null;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteClick: () => void;
  canDelete: boolean;
  isActive: boolean;
  showActions: boolean;
  onMessageClick: () => void;
  onReactButtonClick: (e: React.MouseEvent) => void;
  onImageClick: (url: string) => void;
}

export interface SystemMessageProps {
  message: ChatMessage;
}

export interface AnnouncementMessageProps {
  message: ChatMessage;
}

// --- User Tag Types ---
export interface UserTagProps {
  sender: string;
  userCreationDate: number | null;
}

// --- User Tag Info Type ---
export interface UserTagInfo {
  tagName: string;
  tagColor: string;
  icon?: React.ReactNode;
}

// --- App State Types ---
export interface AppState {
  activePage: Page;
  currency: Currency;
  idrRate: number | null;
  isRateLoading: boolean;
  users: { [email: string]: User };
  currentUser: User | null;
  pendingGoogleUser: GoogleProfile | null;
  firebaseUser: any | null;
  authError: string | null;
  isAuthLoading: boolean;
  analysisCounts: { [key: string]: number };
  fullCoinList: CoinListItem[];
  isCoinListLoading: boolean;
  coinListError: string | null;
  trendingCoins: CryptoData[];
  isTrendingLoading: boolean;
  trendingError: string | null;
  searchedCoin: CryptoData | null;
  rooms: Room[];
  currentRoom: Room | null;
  joinedRoomIds: Set<string>;
  unreadCounts: { [key: string]: number };
  firebaseMessages: { [roomId: string]: ForumMessageItem[] };
  lastMessageTimestamps: { [roomId: string]: number };
  userLastVisit: { [roomId: string]: number };
  newsArticles: NewsArticle[];
  notificationSettings: NotificationSettings;
  roomUserCounts: RoomUserCounts;
  // forumActiveUsers: number; // <-- DIHAPUS
  userActivities: UserActivityData; // Ditambahkan untuk tracking user aktif per room
  typingUsers: TypingUsersMap; // Tambahkan state untuk typing users
}


// --- Firebase Types ---
export interface FirebaseMessageData {
  [key: string]: {
    type: 'user' | 'system' | 'news';
    uid?: string;
    sender?: string;
    text?: string;
    timestamp?: number;
    published_on?: number;
    fileURL?: string;
    fileName?: string;
    reactions?: { [key: string]: string[] };
    userCreationDate?: number;
    title?: string;
    url?: string;
    imageurl?: string;
    source?: string;
    body?: string;
  };
}

export interface FirebaseRoomData {
  [key: string]: {
    name: string;
    userCount: number;
    createdBy?: string;
    createdAt?: number;
    isDefaultRoom?: boolean;
  };
}

export interface FirebaseUserActivityData {
  [roomId: string]: {
    [userId: string]: {
      username: string;
      joinedAt: number;
      lastActive: number;
    };
  };
}

export interface FirebaseTypingStatusData {
  [roomId: string]: {
    [userId: string]: TypingStatus | null; // Null indicates stopped typing
  };
}


// --- API Service Types ---
export interface CacheItem {
  data: any;
  expiry: number;
}

// --- Environment Configuration Types ---
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// --- Event Handler Types ---
export interface NavigationHandlers {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onJoinRoom: (room: Room) => void;
  onLeaveRoom: () => void;
  onLeaveJoinedRoom: (roomId: string) => void;
  onCreateRoom: (roomName: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onSendMessage: (message: Partial<ChatMessage>) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDeleteMessage: (roomId: string, messageId: string) => void;
  onSelectCoin: (coinId: string) => void;
  onReloadTrending: () => void;
  onIncrementAnalysisCount: (coinId: string) => void;
  onToggleNotification: (roomId: string, enabled: boolean) => void;
  onCurrencyChange: (currency: Currency) => void;
  onGoogleRegisterSuccess: (credentialResponse: CredentialResponse) => void;
  onProfileComplete: (username: string, password: string) => Promise<string | void>;
  onUpdateUserActivity?: (roomId: string, userId: string, username: string) => void; // Ditambahkan
  onStartTyping: () => void; // Tambahkan handler
  onStopTyping: () => void; // Tambahkan handler
}


// --- Local Storage Types ---
export interface LocalStorageData {
  cryptoUsers: string;
  currentUser: string;
  joinedRoomIds: string;
  unreadCounts: string;
  userLastVisit: string;
  analysisCounts: string;
  lastAnalysisResetDate: string;
  cryptoNews: string;
  lastNewsFetch: string;
  roomNotificationSettings: string;
  userActivities: string;
}

// --- Extended Props for RoomsListPage ---
export interface ExtendedRoomsListPageProps extends RoomsListPageProps {
  onToggleNotification: (roomId: string, enabled: boolean) => void;
  notificationSettings: NotificationSettings;
}

// --- Room Management Types ---
export interface RoomCreationData {
  name: string;
  userCount: number;
  createdBy: string;
  createdAt: number;
  isDefaultRoom?: boolean;
}

export interface RoomDeletionData {
  roomId: string;
  roomName: string;
  deletedBy: string;
  timestamp: number;
}

// --- User Activity Management ---
export interface UserJoinData {
  roomId: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface UserLeaveData {
  roomId: string;
  userId: string;
  timestamp: number;
}

// --- Validation Types ---
export interface RoomValidationResult {
  isValid: boolean;
  error?: string;
}

export interface UserCountValidationResult {
  isValid: boolean;
  actualCount: number;
  expectedCount: number;
}

// --- Firebase Operation Results ---
export interface FirebaseOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface UserCountOperationResult {
  success: boolean;
  roomId: string;
  newCount: number;
  previousCount: number;
  error?: string;
}

// --- Room Filtering and Sorting ---
export interface RoomFilterOptions {
  searchQuery: string;
  showJoined: boolean;
  showPublic: boolean;
  sortBy: 'name' | 'userCount' | 'recent';
}

// --- Room List Display ---
export interface RoomListDisplay {
  myRooms: Room[];
  publicRooms: Room[];
  filteredRooms: Room[];
}

// --- Extended ForumPageProps untuk menerima forumActiveUsers ---
export interface ExtendedForumPageProps extends ForumPageProps {
  // forumActiveUsers?: number; // <-- DIHAPUS
}

// --- User Count Display Configuration ---
export interface UserCountDisplayConfig {
  showForDefaultRooms: boolean;
  showForCustomRooms: boolean;
  updateInterval: number;
  minUsers: number;
  maxUsers: number;
}

// Default configuration
export const DEFAULT_USER_COUNT_CONFIG: UserCountDisplayConfig = {
  showForDefaultRooms: false, // Room default tidak menampilkan user count
  showForCustomRooms: true,   // Room custom menampilkan user count
  updateInterval: 30000,      // 30 detik
  minUsers: 1,                // Minimum 1 user
  maxUsers: 1000              // Maximum 1000 user
};