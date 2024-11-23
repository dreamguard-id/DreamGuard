const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.get('/', async (req, res) => {
  res.json({ status: 'Aku siap' });
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`DreamGuard server running on http://localhost:${port}`);
});
