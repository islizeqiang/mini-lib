import Koa from '../../mini-lib/Koa';
import Router from '../../mini-lib/KoaRouter';
import { PORT } from './config';

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  ctx.response.setHeader('Access-Control-Allow-Origin', '*');
  ctx.response.setHeader('Access-Control-Max-Age', '10');
  ctx.response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  await next();
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} - ${ms}ms`);
});

router.get('/', (ctx, next) => {
  ctx.response.statusCode = 200;
  ctx.body = JSON.stringify('Hello World');
});

router.get('/api/get', async (ctx) => {
  ctx.response.statusCode = 200;
  ctx.body = {
    id: 1,
    name: '小明',
    age: 18,
  };
});

router.post('/api/users', async (ctx, next) => {
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    ctx.request.on('data', (chunk) => chunks.push(chunk));
    ctx.request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    ctx.request.on('error', (error) => reject(error));
  });
  ctx.response.statusCode = 200;
  ctx.body = body;
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(PORT, () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}/`);
});
