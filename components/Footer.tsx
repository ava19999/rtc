import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-black/30 border-t border-white/10 mt-8">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <p className="text-sm text-gray-400 text-center sm:text-left">
                        &copy; {new Date().getFullYear()} Ruang Tunggu Crypto. Semua Hak Dilindungi Undang-Undang.
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;