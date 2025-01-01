const express = require('express');
const { Pool } = require('pg');
const promClient = require('prom-client');

const app = express();
app.use(express.json());

// Создаем registry для метрик
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Метрики для HTTP запросов
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestTotal);

// Middleware для сбора метрик
app.use((req, res, next) => {
  const start = process.hrtime();
  
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;
    
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(durationSeconds);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
});

// Создаем отдельное приложение для метрик
const metricsApp = express();

// Endpoint для метрик
metricsApp.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Запускаем основное приложение на порту 8000
app.listen(8000, () => {
  console.log('API Server is running on port 8000');
});

// Запускаем сервер метрик на порту 9090
metricsApp.listen(9090, () => {
  console.log('Metrics server is running on port 9090');
});

// Конфигурация подключения к БД
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Создание пользователя
app.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    // Различаем типы ошибок
    if (err instanceof SyntaxError) { // JSON syntax error
      res.status(400).json({ error: 'Invalid JSON format' });
    } else if (err.code === '23505') { // duplicate key
      res.status(400).json({ error: 'User with this email already exists' });
    } else if (err.code === '23502') { // not null violation
      res.status(400).json({ error: 'Missing required fields' });
    } else if (err.code === '42P01') { // undefined table
      res.status(503).json({ error: 'Database table not available' });
    } else if (err.code === '08006' || err.code === '08001' || err.code === '08004') { // connection errors
      res.status(503).json({ error: 'Database connection error' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Получение всех пользователей
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting users:', err);
    if (err.code === '42P01') { // undefined table
      res.status(503).json({ error: 'Database table not available' });
    } else if (err.code === '08006' || err.code === '08001' || err.code === '08004') {
      res.status(503).json({ error: 'Database connection error' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Получение пользователя по ID
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting user:', err);
    if (err.code === '42P01') {
      res.status(503).json({ error: 'Database table not available' });
    } else if (err.code === '08006' || err.code === '08001' || err.code === '08004') {
      res.status(503).json({ error: 'Database connection error' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Удаление пользователя
app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    if (err.code === '42P01') {
      res.status(503).json({ error: 'Database table not available' });
    } else if (err.code === '08006' || err.code === '08001' || err.code === '08004') {
      res.status(503).json({ error: 'Database connection error' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}); 