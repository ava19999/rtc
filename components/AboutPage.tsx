import React from 'react';

const FeatureCard = ({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) => (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-5 text-center">
        <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-electric/20 text-electric mx-auto mb-4">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-gray-100 mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
);

const AboutPage = () => {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-electric to-magenta text-transparent bg-clip-text">
                    Kenalan Yuk Sama Kita
                </h1>
                <p className="text-lg text-gray-400 mt-3 max-w-3xl mx-auto">
                    Selamat datang di RT Crypto — alias Ruang Tunggu Crypto. Ini bukan cuma soal cuan, tapi soal gimana kita bisa bareng-bareng naklukin pasar kripto. Anggap aja ini basecamp buat para pejuang cuan, tempat kita saling bantu biar nggak ada lagi yang namanya 'salah masuk'.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                 <FeatureCard
                    title="Bisikan Maut dari AI"
                    description="Gausah pusing mikirin chart sampe jereng. AI kita, bakal kasih saran kapan harus 'long' atau 'short', lengkap sama titik masuk, SL, dan TP. Tapi tetep lo harus belajar analis, karena ada Resiko dan Cuan."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                />
                 <FeatureCard
                    title="Info Up-to-Date, Gak Pake Telat"
                    description="Harga gerak sedetik aja kita langsung tau. Kita pantau semua bursa gede, jadi lo bisa liat koin mana yang lagi 'hot' dan siap buat diserok. Gak ada lagi ketinggalan kereta."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
                 <FeatureCard
                    title="Ramein Tongkrongan!"
                    description="Di forum, kita bisa ngobrol bebas, lempar-lemparan insight, atau sekadar pamer porto. Plus, ada news feed otomatis biar lo gak kudet soal gosip-gosip terbaru di dunia kripto."
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3h2m-4 3h2m-4 3h2" /></svg>}
                />
            </div>
            
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                 <h2 className="text-2xl font-bold text-center mb-4 text-gray-100">Misi Kita Bareng</h2>
                 <p className="text-gray-300 leading-loose max-w-4xl mx-auto text-center">
                    Jujur, kita capek liat banyak temen yang boncos gara-gara info sesat atau FOMO doang. Misi kita simpel: bikin tempat di mana semua orang bisa dapet info valid dan ngeracik strategi bareng.
                    <br/><br/>
                    <strong className="text-magenta font-bold">PENTING:</strong> Kita di sini <strong className="underline decoration-wavy">BUKAN</strong> buat ngajak atau ngasih sinyal beli koin apapun. Anggap analisis AI dan diskusi di sini sebagai alat bantu, bukan ramalan pasti. Pasar kripto itu brutal, cuan gede, risiko juga setara. Semua keputusan ada di tangan lo, dan <strong className="text-electric font-bold">semua risiko lo yang tanggung sendiri</strong>. Jangan pernah percaya siapapun sebelum lo <strong className="text-lime font-bold">analisa sendiri (DYOR!)</strong>.
                    <br/><br/>
                    Ini gerakan kita buat jadi trader cerdas, bukan cuma ikut-ikutan. Ayo menang bareng di market!
                 </p>
            </div>

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default AboutPage;