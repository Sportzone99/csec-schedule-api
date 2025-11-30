const axios = require('axios');
const { transformNHLData } = require('./transformers/nhlTransformer');
const { transformHockeyTechData } = require('./transformers/hockeyTechTransformer');
const { transformNLLData } = require('./transformers/nllTransformer');
const { fetchNLLSchedule } = require('./utils/nllApi');

const NHL_API_URL = 'https://api-web.nhle.com/v1/club-schedule-season/CGY/20252026';
const WHL_API_URL = 'https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=whl&key=41b145a848f4bd67&fmt=json&season_id=289&team_id=202';
const AHL_API_URL = 'https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=ahl&key=ccb91f29d6744675&fmt=json&season_id=90&team_id=444';

async function fetchNHLSchedule() {
  try {
    const response = await axios.get(NHL_API_URL);
    return transformNHLData(response.data, 'NHL');
  } catch (error) {
    console.error('Error fetching NHL schedule:', error.message);
    return [];
  }
}

async function fetchWHLSchedule() {
  try {
    const response = await axios.get(WHL_API_URL);
    return transformHockeyTechData(response.data, 'WHL');
  } catch (error) {
    console.error('Error fetching WHL schedule:', error.message);
    return [];
  }
}

async function fetchAHLSchedule() {
  try {
    const response = await axios.get(AHL_API_URL);
    return transformHockeyTechData(response.data, 'AHL');
  } catch (error) {
    console.error('Error fetching AHL schedule:', error.message);
    return [];
  }
}

async function fetchNLLScheduleData() {
  try {
    const data = await fetchNLLSchedule();
    return transformNLLData(data, 'NLL');
  } catch (error) {
    console.error('Error fetching NLL schedule:', error.message);
    return [];
  }
}

async function fetchUnifiedSchedule() {
  const [nhlGames, whlGames, ahlGames, nllGames] = await Promise.all([
    fetchNHLSchedule(),
    fetchWHLSchedule(),
    fetchAHLSchedule(),
    fetchNLLScheduleData()
  ]);

  // Combine all games and sort by date
  const allGames = [...nhlGames, ...whlGames, ...ahlGames, ...nllGames];
  
  // Sort by date and time
  allGames.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA - dateB;
  });

  return allGames;
}

module.exports = {
  fetchUnifiedSchedule,
  fetchNHLSchedule,
  fetchWHLSchedule,
  fetchAHLSchedule,
  fetchNLLScheduleData
};


