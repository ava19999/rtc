// components/CreateIdPage.tsx
import React, { useState } from 'react';
import type { CreateIdPageProps } from '../types';

const CreateIdPage: React.FC<CreateIdPageProps> = ({ onProfileComplete, googleProfile }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmedUsername = username.trim();

        if (!trimmedUsername || !password) {
            setError('Username dan kata sandi tidak boleh kosong.');
            return;
        }
        
        // --- PERUBAHAN DI SINI ---
        if (trimmedUsername.length < 4) { 
            setError('Username minimal harus 4 karakter.'); // <-- Diubah ke 4
            return;
        }
        // --- AKHIR PERUBAHAN ---

        if (trimmedUsername.length > 15) {
            setError('Username maksimal 15 karakter.');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
            setError('Username hanya boleh berisi huruf, angka, dan garis bawah (_).');
            return;
        }
        if (password.length < 6) {
            setError('Kata sandi minimal harus 6 karakter.');
            return;
        }
        
        setError('');
        setIsLoading(true);

        try {
            const result = await onProfileComplete(trimmedUsername, password);
            
            if (result) {
                setError(result);
            }
            
        } catch (err: any) {
            console.error("Kesalahan tak terduga saat pendaftaran:", err);
            setError(err.message || 'Terjadi kesalahan tak terduga.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white font-sans flex flex-col items-center justify-center p-4">
             <div className="w-full max-w-sm text-center animate-fade-in-up">
                <img src={googleProfile.picture} alt="Google Profile" className="h-20 w-20 rounded-full mx-auto mb-4 border-2 border-electric" />
                <h1 className="text-2xl font-bold text-white">
                    Selamat Datang, <span className="text-electric">{googleProfile.name}</span>!
                </h1>

                <p className="text-md text-gray-400 mt-2 mb-6">
                    Satu langkah terakhir. Buat username dan kata sandi untuk akun forum Anda.
                </p>
                
                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Buat Username Anda"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-electric transition-all text-center"
                            aria-label="Buat Username"
                            disabled={isLoading}
                        />
                    </div>
                     <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Buat Kata Sandi"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-electric transition-all text-center"
                            aria-label="Buat Kata Sandi"
                            disabled={isLoading}
                        />
                    </div>
                    {error && <p className="text-magenta text-sm mt-2">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-electric hover:bg-electric/80 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-electric disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                        disabled={!username.trim() || !password.trim() || isLoading}
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                           'Selesaikan Pendaftaran & Masuk'
                        )}
                    </button>
                </form>
            </div>
             <style>{`
                @keyframes fade-in-up { 
                    from { opacity: 0; transform: translateY(20px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default CreateIdPage;