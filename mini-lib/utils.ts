import type http from 'http';

export const debounce = <T extends Function, V extends unknown[]>(func: T, ms: number) => {
  let timeoutId: NodeJS.Timeout;
  return function (this: T, ...args: V) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), ms);
  };
};

export const isWebSocket = (request: http.IncomingMessage) => {
  const connection = request.headers.connection || '';
  const upgrade = request.headers.upgrade || '';

  return (
    request.method === 'GET' &&
    connection.toLowerCase().split(/ *, */).indexOf('upgrade') >= 0 &&
    upgrade.toLowerCase() === 'websocket'
  );
};
