'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.concatStreams = exports.isWebSocket = exports.debounce = void 0;
const debounce = (func, ms) => {
  let timeoutId;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), ms);
  };
};
exports.debounce = debounce;
const isWebSocket = (request) => {
  const connection = request.headers.connection || '';
  const upgrade = request.headers.upgrade || '';
  return (
    request.method === 'GET' &&
    connection.toLowerCase().split(/ *, */).indexOf('upgrade') >= 0 &&
    upgrade.toLowerCase() === 'websocket'
  );
};
exports.isWebSocket = isWebSocket;
const concatStreams = (streamArray, streamCounter = streamArray.length) => {
  const { PassThrough: Through } = require('stream');
  return streamArray.reduce((mergedStream, stream) => {
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
exports.concatStreams = concatStreams;
