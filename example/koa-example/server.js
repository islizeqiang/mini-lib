import Koa from '../../mini-lib/Koa';
import Router from '../../mini-lib/KoaRouter';
import serve from '../../mini-lib/KoaStatic';
import { PORT } from './config';

const path = require('path');
const fs = require('fs');
const app = new Koa();
const router = new Router();

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

router.get('/', async (ctx) => {
  ctx.status = 200;
  ctx.body = 'Hello World';
});

// router.get('/test.jpg', async (ctx) => {
//   await sleep(3000);
//   ctx.status = 200;
//   ctx.body = fs.createReadStream(
//     path.resolve(process.cwd(), 'example', 'koa-example', 'public', 'test.jpg'),
//   );
// });

router.get('/api/get', async (ctx) => {
  ctx.status = 200;
  ctx.body = {
    id: 1,
    name: '小明',
    age: 18,
  };
});

router.post('/api/users', async (ctx) => {
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    ctx.request.on('data', (chunk) => chunks.push(chunk));
    ctx.request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    ctx.request.on('error', (error) => reject(error));
  });
  ctx.status = 200;
  ctx.body = body;
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} - ${ms}ms`);
});

app.use(async (ctx, next) => {
  ctx.response.setHeader('Access-Control-Allow-Origin', '*');
  ctx.response.setHeader('Access-Control-Max-Age', '10');
  ctx.response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  await next();
});

app.use(router.routes()).use(router.allowedMethods());

app.use(serve(path.resolve(process.cwd(), 'example', 'koa-example', 'public')));

app.listen(PORT, () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}/`);
});
