const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

// Создание пользователя
app.post('/api/users', async (req, res) => {
  const { email, name } = req.body;
  
  try {
    // Создаем пользователя
    const userResult = await pool.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [email, name]
    );
    
    const userId = userResult.rows[0].id;
    
    // Создаем аккаунт в биллинге
    await axios.post(`${process.env.BILLING_SERVICE_URL}/api/accounts`, {
      userId,
      email
    });
    
    res.status(201).json({ id: userId, email, name });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`User service listening on port ${port}`);
}); 