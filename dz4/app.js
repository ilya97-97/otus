const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// CRUD routes
app.get('/users', async (req, res) => {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
});

app.get('/users/:id', async (req, res) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
});

app.post('/users', async (req, res) => {
    const { name, email } = req.body;
    const result = await pool.query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *', [name, email]);
    res.status(201).json(result.rows[0]);
});

app.put('/users/:id', async (req, res) => {
    const { name, email } = req.body;
    const result = await pool.query('UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *', [name, email, req.params.id]);
    res.json(result.rows[0]);
});

app.delete('/users/:id', async (req, res) => {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.status(204).send();
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
