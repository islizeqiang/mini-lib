import { PORT } from './config';

fetch(`http://127.0.0.1:${PORT}`)
  .then((response) => response.json())
  .then((data) => console.log(data));
