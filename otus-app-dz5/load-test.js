import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Увеличили до 100 пользователей
    { duration: '10m', target: 100 }, // Держим 100 пользователей
    { duration: '2m', target: 0 }     // Спад до 0
  ],
};

export default function () {
  const baseUrl = 'http://arch.homework';
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Создание пользователя (70% запросов)
  if (Math.random() < 0.7) {
    let payload;
    const shouldGenerateError = Math.random() < 0.3;
    
    if (shouldGenerateError) {
      const errorType = Math.random();
      if (errorType < 0.2) {
        // Неверный JSON (400)
        payload = '{invalid_json';
      } else if (errorType < 0.4) {
        // Пропущенные обязательные поля (400)
        payload = JSON.stringify({ name: 'Test User' }); // Нет email
      } else if (errorType < 0.6) {
        // Некорректные типы данных (500)
        payload = JSON.stringify({
          name: { complex: 'object', with: ['array', 'inside'] },
          email: new Array(1000).fill('very.long.email@test.com').join(',') // Слишком длинное значение
        });
      } else if (errorType < 0.8) {
        // Попытка SQL-инъекции (500)
        payload = JSON.stringify({
          name: "Robert'); DROP TABLE users; --",
          email: "sql@injection.com"
        });
      } else {
        // Специальные символы и Unicode (500)
        payload = JSON.stringify({
          name: '\u0000\u0001\u0002\u0003', // Невалидные символы
          email: '测试@测试.com'.repeat(100)  // Длинный Unicode email
        });
      }
    } else {
      // Увеличили размер данных в 5 раз
      const largeData = new Array(5000).fill({
        additionalField1: 'some long text '.repeat(100),
        additionalField2: 'more text '.repeat(100),
        additionalField3: Array(200).fill('array item').join(','),
        additionalField4: {
          nested: {
            data: {
              array: new Array(100).fill('nested data').join(',')
            }
          }
        }
      });
      
      payload = JSON.stringify({
        name: `User ${Math.random()}`,
        email: `user${Math.random()}@example.com`,
        additionalData: largeData
      });
    }

    // Убрали sleep между запросами для увеличения нагрузки
    const createRes = http.post(`${baseUrl}/users`, payload, params);
    check(createRes, {
      'create status is ok': (r) => [200, 400, 500].includes(r.status)
    });

    if (createRes.status === 200) {
      const userId = JSON.parse(createRes.body).id;
      http.get(`${baseUrl}/users/${userId}`);
      http.del(`${baseUrl}/users/${userId}`);
    }
  }

  // GET /users (увеличили до 95% запросов)
  if (Math.random() < 0.95) {
    let url = `${baseUrl}/users`;
    if (Math.random() < 0.4) {
      url += '?page=invalid&limit=invalid';
    }
    http.get(url);
  }
}
