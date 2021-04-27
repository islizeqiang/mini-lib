import type http from 'http';
import type { Readable, PassThrough } from 'stream';

export const debounce = <T extends Function, V extends unknown[]>(func: T, ms: number) => {
  let timeoutId: NodeJS.Timeout;
  return function (this: T, ...args: V) {
    if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), ms);
  };
};

export const isWebSocket = (request: http.IncomingMessage) => {
  const { headers } = request;
  const connection = typeof headers.connection !== 'undefined' ? headers.connection : '';
  const upgrade = typeof headers.upgrade !== 'undefined' ? headers.upgrade : '';

  return (
    request.method === 'GET' &&
    connection.toLowerCase().split(/ *, */).indexOf('upgrade') >= 0 &&
    upgrade.toLowerCase() === 'websocket'
  );
};

export const concatStreams = (
  streamArray: Readable[],
  streamCounter = streamArray.length,
): PassThrough => {
  const { PassThrough: Through } = require('stream');

  return streamArray.reduce((mergedStream, stream: Readable) => {
    mergedStream = stream.pipe(mergedStream, { end: false });
    stream.once('end', () => {
      streamCounter -= 1;
      if (streamCounter === 0) {
        mergedStream.emit('end');
      }
    });
    return mergedStream;
  }, new Through());
};
