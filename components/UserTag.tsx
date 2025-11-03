// components/UserTag.tsx
import React from 'react';

export const ADMIN_USERNAMES = [
    'Admin_RTC',
    'ava',
];

interface UserTagProps {
    sender: string;
    userCreationDate: number | null;
}

// Fungsi untuk mendapatkan informasi tag berdasarkan user
export const getTagInfo = (sender: string, userCreationDate: number | null) => {
    let tagName = '';
    let tagColor = 'text-gray-400';
    let icon = null;

    // Prioritaskan pemeriksaan admin (case-insensitive)
    if (sender && ADMIN_USERNAMES.map((name: string) => name.toLowerCase()).includes(sender.toLowerCase())) {
        tagName = 'atmin';
        tagColor = 'text-yellow-400';
    } 
    // Pengecualian khusus untuk username "Maz" - selalu menjadi #Goat
    else if (sender && sender.toLowerCase() === 'maz') {
        tagName = 'Goat';
        tagColor = 'text-lime';
        icon = (
            <svg className="h-3 w-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21h6v-3H9v3zM12 3c-1.1 0-2 .9-2 2v3h4V5c0-1.1-.9-2-2-2zM7 9v2h2v8h6v-8h2V9H7z"/>
            </svg>
        );
    }
    else if (userCreationDate) {
        // Logika tag berbasis usia akun
        const now = Date.now();
        const ageInMillis = now - userCreationDate;
        const ageInDays = ageInMillis / (1000 * 60 * 60 * 24);

        if (ageInDays < 30) {
            tagName = 'pejuang';
            tagColor = 'text-gray-400';
        } else if (ageInDays < 60) {
            tagName = 'cuaners';
            tagColor = 'text-electric';
        } else if (ageInDays < 120) {
            tagName = 'suhu';
            tagColor = 'text-magenta';
        } else {
            // Ubah dari #buyut menjadi #Goat dengan ikon candle naik
            tagName = 'Goat';
            tagColor = 'text-lime';
            icon = (
                <svg className="h-3 w-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21h6v-3H9v3zM12 3c-1.1 0-2 .9-2 2v3h4V5c0-1.1-.9-2-2-2zM7 9v2h2v8h6v-8h2V9H7z"/>
                </svg>
            );
        }
    } else {
        // Jika userCreationDate tidak ada, beri tag default
        tagName = 'pejuang';
        tagColor = 'text-gray-400';
    }

    return { tagName, tagColor, icon };
};

const UserTag: React.FC<UserTagProps> = ({ sender, userCreationDate }) => {
    const { tagName, tagColor, icon } = getTagInfo(sender, userCreationDate);

    return (
        <span className={`text-xs font-semibold ${tagColor} flex items-center`}>
            #{tagName}
            {icon}
        </span>
    );
};

export default UserTag;