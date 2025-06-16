import React, { useState } from 'react';
import './PickScroller.css';
import { fetchOdds, formatOdds } from '../services/oddsApi';

// Helper function to get team logo URL
const getTeamLogoUrl = (teamId) => {
    // Using the hardcoded mapping approach for reliability
    const TEAM_LOGOS = {
        // American League East
        110: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/110.svg', // Baltimore Orioles
        111: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/111.svg', // Boston Red Sox
        147: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/147.svg', // New York Yankees
        139: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/139.svg', // Tampa Bay Rays
        141: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/141.svg', // Toronto Blue Jays

        // American League Central
        145: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/145.svg', // Chicago White Sox
        114: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/114.svg', // Cleveland Guardians
        116: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/116.svg', // Detroit Tigers
        118: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/118.svg', // Kansas City Royals
        142: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/142.svg', // Minnesota Twins

        // American League West
        117: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/117.svg', // Houston Astros
        108: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/108.svg', // Los Angeles Angels
        133: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/133.svg', // Oakland Athletics
        136: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/136.svg', // Seattle Mariners
        140: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/140.svg', // Texas Rangers

        // National League East
        144: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/144.svg', // Atlanta Braves
        146: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/146.svg', // Miami Marlins
        121: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/121.svg', // New York Mets
        143: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/143.svg', // Philadelphia Phillies
        120: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/120.svg', // Washington Nationals

        // National League Central
        112: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/112.svg', // Chicago Cubs
        113: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/113.svg', // Cincinnati Reds
        158: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/158.svg', // Milwaukee Brewers
        134: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/134.svg', // Pittsburgh Pirates
        138: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/138.svg', // St. Louis Cardinals

        // National League West
        109: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/109.svg', // Arizona Diamondbacks
        115: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/115.svg', // Colorado Rockies
        119: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/119.svg', // Los Angeles Dodgers
        135: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/135.svg', // San Diego Padres
        137: 'https://www.mlbstatic.com/team-logos/team-cap-on-light/137.svg'  // San Francisco Giants
    };

    return TEAM_LOGOS[teamId] || 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg'; // Fallback to MLB logo
};

// Helper function to get team color
const getTeamColor = (teamId) => {
    const TEAM_COLORS = {
        // American League East
        110: '#df4601', // Baltimore Orioles
        111: '#bd3039', // Boston Red Sox
        147: '#003087', // New York Yankees
        139: '#092c5c', // Tampa Bay Rays
        141: '#134a8e', // Toronto Blue Jays

        // American League Central
        145: '#27251f', // Chicago White Sox
        114: '#e31937', // Cleveland Guardians
        116: '#0c2340', // Detroit Tigers
        118: '#004687', // Kansas City Royals
        142: '#002b5c', // Minnesota Twins

        // American League West
        117: '#eb6e1f', // Houston Astros
        108: '#ba0021', // Los Angeles Angels
        133: '#003831', // Oakland Athletics
        136: '#0c2c56', // Seattle Mariners
        140: '#c0111f', // Texas Rangers

        // National League East
        144: '#ce1141', // Atlanta Braves
        146: '#00a3e0', // Miami Marlins
        121: '#ff5910', // New York Mets
        143: '#e81828', // Philadelphia Phillies
        120: '#ab0003', // Washington Nationals

        // National League Central
        112: '#0e3386', // Chicago Cubs
        113: '#c6011f', // Cincinnati Reds
        158: '#12284b', // Milwaukee Brewers
        134: '#27251f', // Pittsburgh Pirates
        138: '#c41e3a', // St. Louis Cardinals

        // National League West
        109: '#a71930', // Arizona Diamondbacks
        115: '#33006f', // Colorado Rockies
        119: '#005a9c', // Los Angeles Dodgers
        135: '#2f241d', // San Diego Padres
        137: '#fd5a1e'  // San Francisco Giants
    };

    return TEAM_COLORS[teamId] || '#ffffff'; // Fallback to white if team not found
};

function PickScroller({ picks, loading }) {
    const [oddsData, setOddsData] = useState({});

    const handleFetchOdds = async () => {
        if (!picks || picks.length === 0) return;
        const odds = await fetchOdds(picks);
        setOddsData(odds);
    };

    const getPickOdds = (pick) => {
        if (!pick || !pick.gamePk || !oddsData[pick.gamePk]) return '';
        const gameOdds = oddsData[pick.gamePk];
        const teamName = pick.recommendedBet;
        if (gameOdds.homeTeam.name === teamName) {
            return formatOdds(gameOdds.homeTeam.odds);
        } else if (gameOdds.awayTeam.name === teamName) {
            return formatOdds(gameOdds.awayTeam.odds);
        }
        return '';
    };

    if (loading) {
        return <div className="pick-scroller-loading">Loading picks...</div>;
    }

    // Filter picks to only show those where home team has Home to Home travel type
    const filteredPicks = picks?.filter(pick => 
        pick.homeTravelType === 'Home to Home (no Rest)' || 
        pick.homeTravelType === 'Home to Home (with Rest)'
    ) || [];

    if (!filteredPicks || filteredPicks.length === 0) {
        return <div className="pick-scroller-empty">No Home to Home picks available for today.</div>;
    }

    return (
        <div className="pick-scroller-container">
            <div className="pick-scroller-header-container">
                <div className="pick-scroller-header">
                    <h3>Today's Travel Picks</h3>

                    <button className="refresh-button" onClick={handleFetchOdds}>
                        Fetch Odds
                    </button>
                </div>
            </div>
            <div className="pick-scroller">
                <div className="pick-scroller-track">
                    {filteredPicks.map(pick => {
                        // Get team IDs
                        const awayTeamId = pick.awayTeam?.id || 0;
                        const homeTeamId = pick.homeTeam?.id || 0;

                        // Get team logos and colors
                        const awayTeamLogo = getTeamLogoUrl(awayTeamId);
                        const homeTeamLogo = getTeamLogoUrl(homeTeamId);
                        const awayTeamColor = getTeamColor(awayTeamId);
                        const homeTeamColor = getTeamColor(homeTeamId);

                        return (
                            <div key={pick.gamePk} className="pick-scroller-card">
                                <div className="pick-card-header">
                                <div className="recommended-bet-highlight-header">
                                    {pick.recommendedBet} ({getPickOdds(pick)})
                                </div>
                                    <div className="strategy-icon travel-advantage" title="Travel Advantage">
                                        ✈️
                                    </div>
                                </div>
                                <div className="pick-card-matchup">
                                    <div className="team away">
                                        <img
                                            src={awayTeamLogo}
                                            alt={`${pick.awayTeam?.name || "Away"} logo`}
                                            className="team-logo"
                                        />
                                        <div className="team-name" style={{ color: awayTeamColor }}>
                                            {pick.awayTeam?.name || "Away"}
                                        </div>
                                        <div className="travel-type">{pick.awayTravelType}</div>
                                    </div>
                                    <div className="vs">@</div>
                                    <div className="team home">
                                        <img
                                            src={homeTeamLogo}
                                            alt={`${pick.homeTeam?.name || "Home"} logo`}
                                            className="team-logo"
                                        />
                                        <div className="team-name" style={{ color: homeTeamColor }}>
                                            {pick.homeTeam?.name || "Home"}
                                        </div>
                                        <div className="travel-type">{pick.homeTravelType}</div>
                                    </div>
                                </div>
                                <div className="pick-card-footer">
                                    <span className="game-time">{pick.gameTime || 'Time TBD'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default PickScroller; 