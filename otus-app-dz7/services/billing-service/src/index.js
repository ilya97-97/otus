const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

const kafka = new Kafka({
  clientId: 'billing-service',
  brokers: [process.env.KAFKA_BROKERS || 'kafka:9092']
});

const producer = kafka.producer();
const admin = kafka.admin();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

// Создание аккаунта
app.post('/api/accounts', async (req, res) => {
  const { userId, email } = req.body;
  console.log('Received userId:', userId, 'type:', typeof userId);
  
  const parsedUserId = parseInt(userId);
  if (isNaN(parsedUserId)) {
    console.error('Invalid userId format:', userId);
    return res.status(400).json({ error: 'Invalid userId format' });
  }
  
  try {
    await pool.query(
      'INSERT INTO accounts (user_id, email, balance) VALUES ($1, $2, $3)',
      [parsedUserId, email, 0]
    );
    
    res.status(201).json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение баланса
app.get('/api/accounts/:userId/balance', async (req, res) => {
  console.log('Received userId:', req.params.userId, 'type:', typeof req.params.userId);
  
  const parsedUserId = parseInt(req.params.userId);
  if (isNaN(parsedUserId)) {
    console.error('Invalid userId format:', req.params.userId);
    return res.status(400).json({ error: 'Invalid userId format' });
  }
  
  try {
    const result = await pool.query(
      'SELECT balance FROM accounts WHERE user_id = $1',
      [parsedUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ balance: result.rows[0].balance });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Пополнение баланса
app.post('/api/accounts/:userId/deposit', async (req, res) => {
  console.log('Received userId:', req.params.userId, 'type:', typeof req.params.userId);
  
  const parsedUserId = parseInt(req.params.userId);
  if (isNaN(parsedUserId)) {
    console.error('Invalid userId format:', req.params.userId);
    return res.status(400).json({ error: 'Invalid userId format' });
  }
  
  const { amount } = req.body;
  if (typeof amount !== 'number' || isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount format' });
  }
  
  try {
    const result = await pool.query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 RETURNING balance',
      [amount, parsedUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json({ balance: result.rows[0].balance });
  } catch (error) {
    console.error('Error depositing money:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание заказа
app.post('/api/accounts/:userId/order', async (req, res) => {
  console.log('Received userId:', req.params.userId, 'type:', typeof req.params.userId);
  
  const parsedUserId = parseInt(req.params.userId);
  if (isNaN(parsedUserId)) {
    console.error('Invalid userId format:', req.params.userId);
    return res.status(400).json({ error: 'Invalid userId format' });
  }
  
  const { amount } = req.body;
  if (typeof amount !== 'number' || isNaN(amount)) {
    return res.status(400).json({ error: 'Invalid amount format' });
  }
  
  try {
    // Проверяем баланс и списываем средства
    const result = await pool.query(
      'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2 AND balance >= $1 RETURNING balance, email',
      [amount, parsedUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Отправляем уведомление через Kafka
    await producer.send({
      topic: 'notifications',
      messages: [
        {
          value: JSON.stringify({
            userId: parsedUserId,
            email: result.rows[0].email,
            message: `Order processed successfully. Amount: ${amount}. New balance: ${result.rows[0].balance}`,
            type: 'order_processed'
          })
        }
      ]
    });
    
    res.json({ 
      message: 'Order processed successfully',
      balance: result.rows[0].balance 
    });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3001;

// Подключаемся к Kafka при старте сервиса
async function start() {
  try {
    // Запускаем сервер сразу
    app.listen(port, () => {
      console.log(`Billing service listening on port ${port}`);
    });

    // Пытаемся подключиться к Kafka
    console.log('Connecting to Kafka...');
    await producer.connect();
    console.log('Producer connected to Kafka');

    // Создаем админ-клиент и топик
    await admin.connect();
    console.log('Admin connected to Kafka');

    try {
      await admin.createTopics({
        topics: [{
          topic: 'notifications',
          numPartitions: 1,
          replicationFactor: 1
        }]
      });
      console.log('Topic created successfully');
    } catch (error) {
      if (error.type === 'TOPIC_ALREADY_EXISTS') {
        console.log('Topic already exists');
      } else {
        throw error;
      }
    }

    await admin.disconnect();
    console.log('Kafka setup completed');
  } catch (error) {
    console.error('Failed to connect to Kafka:', error);
    // Не завершаем процесс, просто логируем ошибку
    console.log('Will continue without Kafka connection');
  }
}

start(); 