import Koa from '../../mini-lib/Koa';
import { PORT } from './config';

const app = new Koa();

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.req.method} ${ctx.req.url} - ${ms}ms`);
});

app.use((ctx, next) => {
  ctx.res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use((ctx, next) => {
  ctx.body = JSON.stringify('Hello World');
  // next();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://127.0.0.1:${PORT}/`);
});
