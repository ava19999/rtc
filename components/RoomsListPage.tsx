// components/RoomsListPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import UserTag, { ADMIN_USERNAMES, getTagInfo } from './UserTag';
import type { Room, User, RoomsListPageProps } from '../types';

const DEFAULT_ROOM_IDS = ['berita-kripto', 'pengumuman-aturan'];

const RoomListItem: React.FC<{
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
}> = ({ 
    room, 
    currentUser, 
    onJoinRoom, 
    onLeaveRoom, 
    onDeleteRoom, 
    onToggleNotification,
    isActive, 
    isJoined, 
    unreadCount,
    notificationEnabled 
}) => {
    const isDefaultRoom = DEFAULT_ROOM_IDS.includes(room.id) || room.isDefaultRoom;
    
    // Logika pengecekan Admin dan Pembuat (Creator)
    const isAdmin = currentUser?.username ? ADMIN_USERNAMES.map((name: string) => name.toLowerCase()).includes(currentUser.username.toLowerCase()) : false;
    const isCreator = room.createdBy === currentUser?.username && !!currentUser?.username;
    
    const canDelete = (isAdmin || isCreator) && !isDefaultRoom;
    const canLeave = isJoined && !isDefaultRoom;

    // Dapatkan informasi tag untuk creator room
    const creatorTagInfo = room.createdBy ? getTagInfo(room.createdBy, null) : null;

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    const handleToggleNotification = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleNotification(room.id, !notificationEnabled);
    };

    return (
        <div
            onClick={() => onJoinRoom(room)}
            className={`flex items-center justify-between gap-2 p-2.5 rounded-lg cursor-pointer transition-all duration-200 group relative ${isActive ? 'bg-electric/20 border-electric/50' : 'bg-gray-900/70 hover:bg-gray-800/50 border-transparent'} border`}
        >
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold text-gray-100 truncate text-xs">{room.name}</h3>
                    {room.createdBy && !isDefaultRoom && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <p className="text-xs text-gray-500 truncate">Dibuat oleh:</p>
                            {creatorTagInfo && (
                                <span className={`text-xs font-semibold ${creatorTagInfo.tagColor} bg-gray-800/50 px-1.5 py-0.5 rounded-full flex items-center`}>
                                    #{creatorTagInfo.tagName}
                                    {creatorTagInfo.icon}
                                </span>
                            )}
                            {isCreator && ( // <-- Tampilkan jika isCreator
                                <span className="text-xs bg-electric/20 text-electric px-1.5 py-0.5 rounded-full">
                                    Anda
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Unread Count - selalu tampil jika ada pesan belum dibaca */}
                {unreadCount > 0 && (
                    <div className="bg-magenta text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                )}
                
                {/* User Count - Selalu render tapi sembunyikan untuk room default */}
                <div className={`text-right text-xs text-gray-400 flex items-center gap-1.5 flex-shrink-0 ${isDefaultRoom ? 'invisible' : ''}`}>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-lime"></span>
                    </span>
                    {/* Tampilkan user count dari room data */}
                    <span>{room.userCount.toLocaleString('id-ID')}</span>
                </div>
                
                {/* Action Buttons - SELALU TAMPIL */}
                <div className="flex items-center gap-1 opacity-100">
                    {/* Notification Toggle Button */}
                    {isJoined && (
                        <button 
                            onClick={handleToggleNotification} 
                            title={notificationEnabled ? "Matikan Notifikasi Suara" : "Aktifkan Notifikasi Suara"}
                            className={`p-1 rounded-full transition-colors ${
                                notificationEnabled 
                                    ? 'text-electric hover:bg-electric/20' 
                                    : 'text-gray-400 hover:bg-gray-600/50 hover:text-white'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {notificationEnabled ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.346 5.353A6 6 0 0118 11v3.159c0 .538-.214 1.055-.595 1.436L16 17H8l-1.405-1.405A2.032 2.032 0 016 14.159V11a6 6 0 01.346-5.647M9.346 5.353L15 5l-5.654.353zM15 17v1a3 3 0 01-6 0v-1m6 0H9" />
                                )}
                            </svg>
                        </button>
                    )}
                    
                    {/* Leave Room Button */}
                    {canLeave && (
                        <button 
                            onClick={(e) => handleActionClick(e, () => onLeaveRoom(room.id))} 
                            title="Keluar Room" 
                            className="p-1 rounded-full text-gray-400 hover:bg-gray-600/50 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> 
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /> 
                            </svg>
                        </button>
                    )}
                    
                    {/* --- PERBAIKAN DI SINI --- */}
                    {/* Delete Room Button */}
                    {canDelete && (
                        <button 
                            onClick={(e) => handleActionClick(e, () => { 
                                // Hapus window.confirm
                                onDeleteRoom(room.id); 
                            })} 
                            title={`Hapus tongkrongan "${room.name}"`} // Ubah title
                            className="p-1 rounded-full text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> 
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> 
                            </svg>
                        </button>
                    )}
                    {/* --- AKHIR PERBAIKAN --- */}
                </div>
            </div>
        </div>
    );
};

// Extend the RoomsListPageProps to include new props
interface ExtendedRoomsListPageProps extends RoomsListPageProps {
    onToggleNotification: (roomId: string, enabled: boolean) => void;
    notificationSettings: { [roomId: string]: boolean };
}

const RoomsListPage: React.FC<ExtendedRoomsListPageProps> = ({
    rooms, onJoinRoom, onCreateRoom, totalUsers, hotCoin, userProfile,
    currentRoomId, joinedRoomIds, onLeaveJoinedRoom, unreadCounts, onDeleteRoom,
    onToggleNotification, notificationSettings
}) => {
    const [newRoomName, setNewRoomName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    
    const username = userProfile?.username || '';

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (newRoomName.trim()) {
            onCreateRoom(newRoomName.trim());
            setNewRoomName('');
        }
    };

    const { myRooms, publicRooms } = useMemo(() => {
        const lowercasedQuery = searchQuery.toLowerCase();
        const filtered = searchQuery
            ? rooms.filter((room) => room.name.toLowerCase().includes(lowercasedQuery))
            : rooms;

        // --- PERBAIKAN LOGIKA SORTIR DIMULAI ---
        const myRoomsList = filtered
            .filter((r) => joinedRoomIds.has(r.id))
            .sort((a, b) => {
                const unreadA = unreadCounts[a.id] || 0;
                const unreadB = unreadCounts[b.id] || 0;

                // 1. Urutkan berdasarkan pesan belum dibaca (terbanyak di atas)
                if (unreadB !== unreadA) {
                    return unreadB - unreadA;
                }

                // 2. Jika sama (misal 0), urutkan berdasarkan jumlah user (terbanyak di atas)
                const userCountA = a.userCount || 0;
                const userCountB = b.userCount || 0;
                if (userCountB !== userCountA) {
                    return userCountB - userCountA;
                }

                // 3. Fallback: Urutkan berdasarkan room default
                const isADefault = DEFAULT_ROOM_IDS.includes(a.id) || a.isDefaultRoom;
                const isBDefault = DEFAULT_ROOM_IDS.includes(b.id) || b.isDefaultRoom;
                if (isADefault && !isBDefault) return -1;
                if (!isADefault && isBDefault) return 1;

                // 4. Fallback: Urutkan berdasarkan nama
                return a.name.localeCompare(b.name);
            });
            
        // Urutkan juga room publik berdasarkan jumlah user
        const publicRoomsList = filtered
            .filter((r) => !joinedRoomIds.has(r.id))
            .sort((a, b) => (b.userCount || 0) - (a.userCount || 0)); // Sort by user count descending
        // --- PERBAIKAN LOGIKA SORTIR SELESAI ---

        return { myRooms: myRoomsList, publicRooms: publicRoomsList };
    }, [rooms, searchQuery, joinedRoomIds, unreadCounts]);

    return (
        <div className="container mx-auto px-2 sm:px-4 py-3 animate-fade-in flex flex-col h-[calc(100vh-56px)]">

            {/* Top Stats */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-2 mb-2">
                 <div className="bg-gray-900 border border-white/10 rounded-lg p-2 flex items-center gap-2">
                    <div className="bg-electric/20 text-electric p-2 rounded-md flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">User Aktif</p>
                        <p className="text-base font-bold text-white">{totalUsers.toLocaleString('id-ID')}</p>
                    </div>
                </div>
                 <div className="bg-gray-900 border border-white/10 rounded-lg p-2 flex items-center gap-2 overflow-hidden">
                    {hotCoin ? (
                        <>
                            <img src={hotCoin.logo} alt={hotCoin.name} className="h-7 w-7 rounded-full flex-shrink-0" />
                            <div className="overflow-hidden">
                                <p className="text-xs text-gray-400">Hot Coin</p>
                                <p className="text-base font-bold text-white truncate" title={hotCoin.name}>{hotCoin.name}</p>
                            </div>
                        </>
                    ) : (
                         <div className="flex items-center gap-2 animate-pulse w-full">
                            <div className="h-7 w-7 rounded-full bg-gray-700"></div>
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-12 bg-gray-700 rounded"></div>
                                <div className="h-4 w-20 bg-gray-700 rounded"></div>
                            </div>
                         </div>
                    )}
                </div>
            </div>

            {/* Profile & Actions */}
             <div className="flex-shrink-0 flex items-center gap-2 mb-2 bg-gray-900 border border-white/10 rounded-lg p-2.5">
                <span className="font-bold text-white text-sm">{username}</span>
                <UserTag sender={username} userCreationDate={userProfile?.createdAt ?? null} />
            </div>

            {/* Search */}
            <div className="flex-shrink-0 relative mb-2 w-full">
                <input type="text" placeholder="Cari room..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-electric transition-all" />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            {/* Create Room Form */}
             <form onSubmit={handleCreate} className="flex-shrink-0 bg-gray-900/50 border border-dashed border-white/10 rounded-lg p-2 mb-3 flex items-center gap-2">
                <input 
                    type="text" 
                    value={newRoomName} 
                    onChange={(e) => setNewRoomName(e.target.value)} 
                    placeholder={userProfile ? "Buat room baru..." : "Login untuk buat room"}
                    className="flex-1 bg-transparent py-1 px-2 text-sm text-white placeholder-gray-500 focus:outline-none" 
                    disabled={!userProfile}
                    maxLength={25}
                />
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                        {newRoomName.length}/25
                    </span>
                    <button 
                        type="submit" 
                        className="bg-magenta hover:bg-magenta/80 text-white font-semibold py-1 px-4 rounded-md transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm" 
                        disabled={!newRoomName.trim() || !userProfile || newRoomName.length > 25}
                    >
                        Buat
                    </button>
                </div>
            </form>

            {/* Room List */}
            <div className="flex-grow overflow-y-auto space-y-1.5 pb-4 custom-scrollbar pr-1">
                 {myRooms.length > 0 && (
                    <div>
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Tongkrongan Saya</h2>
                        <div className="space-y-1.5">
                            {myRooms.map((room) => (
                                <RoomListItem
                                    key={room.id}
                                    room={room}
                                    currentUser={userProfile}
                                    onJoinRoom={onJoinRoom}
                                    onLeaveRoom={onLeaveJoinedRoom}
                                    onDeleteRoom={onDeleteRoom}
                                    onToggleNotification={onToggleNotification}
                                    isActive={room.id === currentRoomId}
                                    isJoined={true}
                                    unreadCount={unreadCounts[room.id] || 0}
                                    notificationEnabled={notificationSettings[room.id] !== false}
                                />
                            ))}
                        </div>
                    </div>
                 )}
                  {publicRooms.length > 0 && (
                    <div className={myRooms.length > 0 ? 'mt-4' : ''}>
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 px-1">Tongkrongan Publik</h2>
                        <div className="space-y-1.5">
                             {publicRooms.map((room) => (
                                <RoomListItem
                                    key={room.id}
                                    room={room}
                                    currentUser={userProfile}
                                    onJoinRoom={onJoinRoom}
                                    onLeaveRoom={onLeaveJoinedRoom}
                                    onDeleteRoom={onDeleteRoom}
                                    onToggleNotification={onToggleNotification}
                                    isActive={false}
                                    isJoined={false}
                                    unreadCount={0}
                                    notificationEnabled={notificationSettings[room.id] !== false}
                                />
                            ))}
                        </div>
                    </div>
                 )}
                 {myRooms.length === 0 && publicRooms.length === 0 && !searchQuery && (
                    <p className="text-center text-gray-500 py-6">Belum ada room publik. Buat room baru!</p>
                 )}
                 {myRooms.length === 0 && publicRooms.length === 0 && searchQuery && (
                     <p className="text-center text-gray-500 py-6">Room tidak ditemukan.</p>
                 )}
            </div>
             <style>{`
                 @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                 @keyframes fade-in-scale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 191, 255, 0.5); }
            `}</style>
        </div>
    );
};

export default RoomsListPage;