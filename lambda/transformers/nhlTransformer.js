const { convertToMountainTime } = require('../utils/timezone');

function transformNHLData(data, league) {
  if (!data) {
    return [];
  }

  // Handle different possible response structures
  let games = [];
  if (Array.isArray(data.games)) {
    games = data.games;
  } else if (data.games && Array.isArray(data.games.gameWeek)) {
    // Flatten gameWeek structure
    games = data.games.gameWeek.flatMap(week => week.games || []);
  } else if (Array.isArray(data)) {
    games = data;
  }

  if (games.length === 0) {
    return [];
  }

  return games.map(game => {
    if (!game) return null;

    const isHome = game.homeTeam?.abbrev === 'CGY' || game.homeTeam?.triCode === 'CGY';
    const homeTeam = isHome ? game.homeTeam : game.awayTeam;
    const awayTeam = isHome ? game.awayTeam : game.homeTeam;

    if (!homeTeam || !awayTeam) {
      return null;
    }

    // Convert date/time to Mountain Time
    let gameDate;
    if (game.startTimeUTC) {
      gameDate = new Date(game.startTimeUTC);
    } else if (game.gameDate) {
      gameDate = new Date(game.gameDate);
    } else if (game.startTime) {
      gameDate = new Date(game.startTime);
    } else {
      return null; // Skip if no date
    }

    if (isNaN(gameDate.getTime())) {
      return null; // Skip invalid dates
    }

    const { date, time } = convertToMountainTime(gameDate);

    // Determine game status
    const gameState = game.gameState || game.gameScheduleState || 'PREVIEW';
    const isCompleted = gameState === 'OFF' || gameState === 'FINAL' || gameState === 'OFFICIAL';
    
    // Extract scores
    let homeScore = null;
    let awayScore = null;
    let overtime = false;
    let shootout = false;

    if (isCompleted && game.homeTeam && game.awayTeam) {
      homeScore = game.homeTeam.score || null;
      awayScore = game.awayTeam.score || null;
      
      // Check for overtime/shootout
      if (game.periodDescriptor) {
        overtime = game.periodDescriptor.periodType === 'OVERTIME' || 
                   (game.periodDescriptor.periodNumber > 3 && game.periodDescriptor.periodType !== 'SHOOTOUT');
        shootout = game.periodDescriptor.periodType === 'SHOOTOUT';
      }
    }

    const gameId = game.id || null;
    
    // Construct linkToSummary URL using gameId
    let linkToSummary = null;
    if (gameId) {
      linkToSummary = `https://nhl.com/gamecenter/${gameId}`;
    }

    return {
      gameId: gameId,
      date,
      time,
      location: game.venue?.default || game.venueName || 'TBD',
      homeTeam: homeTeam.name?.default || homeTeam.placeName?.default || 'TBD',
      awayTeam: awayTeam.name?.default || awayTeam.placeName?.default || 'TBD',
      homeTeamId: homeTeam.id || null,
      awayTeamId: awayTeam.id || null,
      homeTricode: homeTeam.abbrev || homeTeam.triCode || null,
      awayTricode: awayTeam.abbrev || awayTeam.triCode || null,
      homeLogo: homeTeam.logo || null,
      awayLogo: awayTeam.logo || null,
      league,
      ticketLink: game.ticketsLink || null,
      homeScore,
      awayScore,
      linkToSummary,
      overtime,
      shootout
    };
  }).filter(game => game !== null); // Remove any null entries
}

module.exports = {
  transformNHLData
};

