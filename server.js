const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth-routes');
const profileRoutes = require('./routes/user-routes');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', profileRoutes);

app.get('/', async (req, res) => {
  res.json({ status: 'Aku siap' });
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`DreamGuard server running on http://localhost:${port}`);
});
