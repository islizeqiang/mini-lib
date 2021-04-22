import { PORT } from './config';

const callback = (response) => response.json().then((data) => console.log(data));

const base = `http://127.0.0.1:${PORT}`;
console.log(1);
Promise.all([
  fetch(`${base}`).then(callback),

  fetch(`${base}/api/get`).then(callback),

  fetch(`${base}/api/users`, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: {
        name: 'John',
        email: 'john@example.com',
      },
    }),
  }).then(callback),
]);
