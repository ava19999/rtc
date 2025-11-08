import React from 'react';
import type { Page, HeaderProps, Currency, User } from '../types';
import UserTag from './UserTag';

const NavLink: React.FC<{ page: Page; activePage: Page; onNavigate: (page: Page) => void; children: React.ReactNode; }> = ({ page, activePage, onNavigate, children }) => {
    const isActive = activePage === page || (page === 'rooms' && activePage === 'forum');
    return (
        <button
            onClick={() => onNavigate(page)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 ${
                isActive
                    ? 'text-electric'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
        >
            {children}
        </button>
    );
};

const CurrencySwitcher = ({ currency, onCurrencyChange }: { currency: Currency; onCurrencyChange: (currency: Currency) => void; }) => {
    return (
        <div className="flex items-center bg-gray-900/50 border border-white/10 rounded-full p-0.5">
            <button
                onClick={() => onCurrencyChange('usd')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors duration-300 ${currency === 'usd' ? 'bg-electric text-white' : 'text-gray-400 hover:text-white'}`}
            >
                USD
            </button>
            <button
                onClick={() => onCurrencyChange('idr')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors duration-300 ${currency === 'idr' ? 'bg-electric text-white' : 'text-gray-400 hover:text-white'}`}
            >
                IDR
            </button>
        </div>
    );
};

const formatUsdPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 18 }).format(price);
};

const HotCoinTicker = ({ hotCoin, currency, idrRate }: { hotCoin: HeaderProps['hotCoin'], currency: Currency, idrRate: number | null }) => {
    if (!hotCoin) return <span className="text-gray-500">Memuat...</span>;

    const isPositive = hotCoin.change >= 0;
    const displayPrice = currency === 'idr' && idrRate ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(hotCoin.price * idrRate) : formatUsdPrice(hotCoin.price);

    return (
        <div className="flex items-center gap-2">
            <img src={hotCoin.logo} alt={hotCoin.name} className="w-4 h-4 rounded-full" />
            <span className="font-semibold text-gray-200">{hotCoin.name}</span>
            <span className="font-mono text-gray-300">{displayPrice}</span>
            <span className={`font-bold ${isPositive ? 'text-lime' : 'text-magenta'}`}>
                {isPositive ? '▲' : '▼'} {hotCoin.change.toFixed(2)}%
            </span>
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ userProfile, onLogout, activePage, onNavigate, currency, onCurrencyChange, hotCoin, idrRate }) => {
    return (
        <header className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20 shadow-lg shadow-black/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => onNavigate('home')}>
                        <svg className="h-7 w-7 text-electric" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 6L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M16 6L19 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="3" y="8" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
                            <path d="M7 12H10L12 16L14 12H17" stroke="magenta" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <h1 className="text-lg md:text-xl font-black tracking-tight bg-gradient-to-r from-electric to-magenta text-transparent bg-clip-text font-heading">
                            RT Crypto
                        </h1>
                    </div>
                    <div className="flex items-center space-x-3">
                        <nav className="hidden sm:flex items-center space-x-1">
                            <NavLink page="home" activePage={activePage} onNavigate={onNavigate}>Beranda</NavLink>
                            <NavLink page="rooms" activePage={activePage} onNavigate={onNavigate}>Forum</NavLink>
                            <NavLink page="about" activePage={activePage} onNavigate={onNavigate}>Tentang</NavLink>
                        </nav>
                        
                        <div className="hidden lg:flex items-center gap-2 text-xs font-heading">
                          <span className='text-gray-400'>Lagi Rame 🔥:</span>
                          <HotCoinTicker hotCoin={hotCoin} currency={currency} idrRate={idrRate} />
                        </div>
                        
                        <CurrencySwitcher currency={currency} onCurrencyChange={onCurrencyChange} />
                        
                        {userProfile?.username && (
                            <>
                                <div className="hidden md:flex items-center gap-2">
                                  {userProfile.googleProfilePicture && (
                                    <img src={userProfile.googleProfilePicture} alt="Avatar" className="h-8 w-8 rounded-full" />
                                  )}
                                  <div className="text-right">
                                      <p className="text-sm font-bold text-white truncate max-w-[100px]">{userProfile.username}</p>
                                      <div className="-mt-1">
                                          <UserTag sender={userProfile.username} userCreationDate={userProfile.createdAt} />
                                      </div>
                                  </div>
                                </div>
                                <button
                                    onClick={onLogout}
                                    title="Logout"
                                    className="flex items-center justify-center h-8 w-8 rounded-full bg-white/5 hover:bg-magenta/80 hover:text-white text-gray-400 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <nav className="sm:hidden flex items-center justify-around pb-2">
                    <NavLink page="home" activePage={activePage} onNavigate={onNavigate}>Beranda</NavLink>
                    <NavLink page="rooms" activePage={activePage} onNavigate={onNavigate}>Forum</NavLink>
                    <NavLink page="about" activePage={activePage} onNavigate={onNavigate}>Tentang</NavLink>
                    {userProfile?.username && (
                         <button
                            onClick={onLogout}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/10`}
                        >
                            Logout
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;