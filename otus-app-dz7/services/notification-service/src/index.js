const express = require('express');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB
});

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKERS]
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

// Получение всех уведомлений пользователя
app.get('/api/notifications/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Подключаемся к Kafka и слушаем события заказов
async function startKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'notifications', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const notification = JSON.parse(message.value.toString());
      
      try {
        await pool.query(
          'INSERT INTO notifications (user_id, email, message, type) VALUES ($1, $2, $3, $4)',
          [notification.userId, notification.email, notification.message, notification.type]
        );
      } catch (error) {
        console.error('Error saving notification:', error);
      }
    },
  });
}

startKafkaConsumer().catch(console.error);

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Notification service listening on port ${port}`);
}); 