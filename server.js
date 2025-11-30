const express = require('express');
const cors = require('cors');
const { fetchUnifiedSchedule } = require('./src/scheduleFetcher');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Unified schedule endpoint
app.get('/api/schedule', async (req, res) => {
  try {
    const schedule = await fetchUnifiedSchedule();
    res.json({
      success: true,
      count: schedule.length,
      data: schedule
    });
  } catch (error) {
    console.error('Error fetching unified schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule data',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Schedule API available at http://localhost:${PORT}/api/schedule`);
});

