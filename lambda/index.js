const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Import transformers (we'll bundle these)
const { transformNHLData } = require('./transformers/nhlTransformer');
const { transformHockeyTechData } = require('./transformers/hockeyTechTransformer');
const { transformNLLData } = require('./transformers/nllTransformer');
const { fetchNLLSchedule } = require('./utils/nllApi');

const NHL_API_URL = 'https://api-web.nhle.com/v1/club-schedule-season/CGY/20252026';
const WHL_API_URL = 'https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=whl&key=41b145a848f4bd67&fmt=json&season_id=289&team_id=202';
const AHL_API_URL = 'https://lscluster.hockeytech.com/feed/?feed=modulekit&view=schedule&client_code=ahl&key=ccb91f29d6744675&fmt=json&season_id=90&team_id=444';

// S3 bucket and key from environment variables
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'csec-schedule-api';
const S3_KEY = process.env.S3_KEY || 'schedule.json';

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

exports.handler = async (event) => {
  try {
    console.log('Starting schedule fetch...');
    
    // Fetch unified schedule
    const schedule = await fetchUnifiedSchedule();
    
    // Prepare response object
    const responseData = {
      success: true,
      count: schedule.length,
      lastUpdated: new Date().toISOString(),
      data: schedule
    };
    
    // Upload to S3
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ca-central-1' });
    const params = {
      Bucket: BUCKET_NAME,
      Key: S3_KEY,
      Body: JSON.stringify(responseData, null, 2),
      ContentType: 'application/json',
      CacheControl: 'max-age=3600' // Cache for 1 hour
      // Public access is handled by bucket policy
    };
    
    await s3Client.send(new PutObjectCommand(params));
    
    console.log(`Successfully uploaded ${schedule.length} games to S3`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Successfully updated schedule with ${schedule.length} games`,
        lastUpdated: responseData.lastUpdated
      })
    };
  } catch (error) {
    console.error('Error in Lambda function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to update schedule',
        message: error.message
      })
    };
  }
};

