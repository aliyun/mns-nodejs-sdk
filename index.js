'use strict';
function supportAsyncFunctions() {
  try {
    new Function('(async function () {})()');
    return true;
  } catch (ex) {
    return false;
  }
}
module.exports = supportAsyncFunctions() ? require('./src/client.js') : require('./lib/client.js');

