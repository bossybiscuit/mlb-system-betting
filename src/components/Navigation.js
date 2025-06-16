import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    return (
        <nav className="main-nav">
            <div className="nav-header">
                <div className="nav-title">
                    <h1>MLB System Betting</h1>
                    <p>Tracking systems to the profitland.</p>
                </div>
                <div className="nav-profile">
                    <NavLink to="/settings">
                        <button className="profile-button">
                            <i className="fas fa-user"></i>
                        </button>
                    </NavLink>
                </div>
            </div>

            <div className="mobile-nav-container">
                <button className="hamburger-menu" onClick={toggleMenu} aria-label="Toggle navigation menu">
                    <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
                    <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
                    <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
                </button>
            </div>
            
            <div className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
                <NavLink to="/picks" onClick={closeMenu}>Picks of The Day</NavLink>
                <NavLink to="/trends" onClick={closeMenu}>Travel Trends</NavLink>
                <NavLink to="/fade" onClick={closeMenu}>Fade The Sweep</NavLink>
                <NavLink to="/krate" onClick={closeMenu}>K-Rate Unders</NavLink>
                <NavLink to="/outs" onClick={closeMenu}>Pitching Outs</NavLink>
                <NavLink to="/schedule" onClick={closeMenu}>Daily Schedule</NavLink>
                <NavLink to="/tracker" onClick={closeMenu}>Travel Tracker</NavLink>
            </div>
        </nav>
    );
};

export default Navigation; 