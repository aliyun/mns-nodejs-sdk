'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var assert = require('assert');

var debug = require('debug')('mns:client');
var httpx = require('httpx');
var kitx = require('kitx');

var _require = require('./helper'),
    getEndpoint = _require.getEndpoint,
    toXMLBuffer = _require.toXMLBuffer,
    parseXML = _require.parseXML,
    extract = _require.extract,
    getResponseHeaders = _require.getResponseHeaders,
    getCanonicalizedMNSHeaders = _require.getCanonicalizedMNSHeaders;

var Client = function () {
  function Client(accountid, opts) {
    _classCallCheck(this, Client);

    assert(accountid, '"accountid" must be passed in');
    this.accountid = accountid;
    assert(opts, 'must pass in "opts"');
    // 兼容
    var accessKeyID = opts.accessKeyId || opts.accessKeyID;
    assert(accessKeyID, 'must pass in "opts.accessKeyID"');
    this.accessKeyID = accessKeyID;
    assert(opts.accessKeySecret, 'must pass in "opts.accessKeySecret"');
    this.accessKeySecret = opts.accessKeySecret;

    // Region is required only when no custom endpoint is provided
    if (!opts.endpoint) {
      assert(opts.region, 'must pass in "opts.region" when no custom endpoint is provided');
    }

    var _getEndpoint = getEndpoint(accountid, opts),
        domain = _getEndpoint.domain,
        endpoint = _getEndpoint.endpoint;

    this.endpointDomain = domain;
    this.endpoint = endpoint;

    // security token
    this.securityToken = opts.securityToken;

    // STS token refresh configuration
    this.refreshSTSToken = opts.refreshSTSToken;
    this.refreshSTSTokenInterval = opts.refreshSTSTokenInterval !== undefined ? opts.refreshSTSTokenInterval : 300000; // 默认 5 分钟
    this.stsTokenFreshTime = this.securityToken ? new Date() : null;
    this._refreshingPromise = null; // 并发刷新锁

    // 警告：提供了 securityToken 但没有刷新回调
    if (this.securityToken && !this.refreshSTSToken) {
      debug('Warning: securityToken provided without refreshSTSToken callback. ' + 'Token will not be automatically refreshed when it expires.');
    }

    // timeout configurations
    this.readTimeout = opts.readTimeout || 40 * 1000; // 40s (read timeout)
    this.connectTimeout = opts.connectTimeout || 30 * 1000; // 30s (connect timeout)
  }

  _createClass(Client, [{
    key: 'refreshSTS',
    value: function () {
      var _ref = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
        var now;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!(!this.refreshSTSToken || !this.stsTokenFreshTime)) {
                  _context.next = 2;
                  break;
                }

                return _context.abrupt('return');

              case 2:
                now = new Date();

                if (!(+now - +this.stsTokenFreshTime < this.refreshSTSTokenInterval)) {
                  _context.next = 5;
                  break;
                }

                return _context.abrupt('return');

              case 5:
                if (!this._refreshingPromise) {
                  _context.next = 8;
                  break;
                }

                debug('STS token refresh already in progress, waiting...');
                return _context.abrupt('return', this._refreshingPromise);

              case 8:

                debug('STS token refresh triggered');

                // 创建刷新任务并保存 Promise
                this._refreshingPromise = this._doRefreshSTS(now);

                _context.prev = 10;
                _context.next = 13;
                return this._refreshingPromise;

              case 13:
                _context.prev = 13;

                this._refreshingPromise = null;
                return _context.finish(13);

              case 16:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[10,, 13, 16]]);
      }));

      function refreshSTS() {
        return _ref.apply(this, arguments);
      }

      return refreshSTS;
    }()
  }, {
    key: '_doRefreshSTS',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee2(now) {
        var credentials, accessKeyId;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.prev = 0;
                _context2.next = 3;
                return this.refreshSTSToken();

              case 3:
                credentials = _context2.sent;

                if (credentials) {
                  _context2.next = 6;
                  break;
                }

                throw new Error('refreshSTSToken callback must return credentials object');

              case 6:
                accessKeyId = credentials.accessKeyId || credentials.accessKeyID;

                if (accessKeyId) {
                  _context2.next = 9;
                  break;
                }

                throw new Error('refreshSTSToken callback must return credentials with accessKeyId');

              case 9:
                if (credentials.accessKeySecret) {
                  _context2.next = 11;
                  break;
                }

                throw new Error('refreshSTSToken callback must return credentials with accessKeySecret');

              case 11:
                if (credentials.securityToken) {
                  _context2.next = 13;
                  break;
                }

                throw new Error('refreshSTSToken callback must return credentials with securityToken');

              case 13:

                // 更新凭证
                this.accessKeyID = accessKeyId;
                this.accessKeySecret = credentials.accessKeySecret;
                this.securityToken = credentials.securityToken;
                this.stsTokenFreshTime = now;

                debug('STS token refreshed successfully');
                _context2.next = 24;
                break;

              case 20:
                _context2.prev = 20;
                _context2.t0 = _context2['catch'](0);

                // 刷新失败时记录警告，继续使用旧凭证
                debug('STS token refresh failed: %s. Will continue with current credentials.', _context2.t0.message);
                // 更新刷新时间，避免频繁重试
                this.stsTokenFreshTime = now;
                // 不抛出错误，让请求继续使用当前凭证

              case 24:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[0, 20]]);
      }));

      function _doRefreshSTS(_x) {
        return _ref2.apply(this, arguments);
      }

      return _doRefreshSTS;
    }()
  }, {
    key: 'request',
    value: function () {
      var _ref3 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee3(method, resource, type, requestBody) {
        var attentions = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
        var opts = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
        var url, headers, requestOpts, response, code, contentType, responseBody, body, responseData, e, message, requestid, hostid, err;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.refreshSTS();

              case 2:
                // 请求前刷新 STS Token

                url = `${this.endpoint}${resource}`;

                debug('url: %s', url);
                debug('method: %s', method);
                headers = this.buildHeaders(method, requestBody, resource, opts.headers);

                debug('request headers: %j', headers);
                debug('request body: %s', requestBody.toString());

                // Apply default timeouts if not specified in opts
                // Use separate readTimeout and connectTimeout to match Java SDK behavior
                requestOpts = {
                  method: method,
                  headers: headers,
                  data: requestBody,
                  readTimeout: opts.readTimeout || this.readTimeout,
                  connectTimeout: opts.connectTimeout || this.connectTimeout
                };
                _context3.next = 11;
                return httpx.request(url, Object.assign(opts, requestOpts));

              case 11:
                response = _context3.sent;


                debug('statusCode %s', response.statusCode);
                debug('response headers: %j', response.headers);
                code = response.statusCode;
                contentType = response.headers['content-type'] || '';
                // const contentLength = response.headers['content-length'];

                _context3.next = 18;
                return httpx.read(response, 'utf8');

              case 18:
                responseBody = _context3.sent;

                debug('response body: %s', responseBody);

                if (!(responseBody && (contentType.startsWith('text/xml') || contentType.startsWith('application/xml')))) {
                  _context3.next = 34;
                  break;
                }

                _context3.next = 23;
                return parseXML(responseBody);

              case 23:
                responseData = _context3.sent;

                if (!responseData.Error) {
                  _context3.next = 32;
                  break;
                }

                e = responseData.Error;
                message = extract(e.Message);
                requestid = extract(e.RequestId);
                hostid = extract(e.HostId);
                err = new Error(`${method} ${url} failed with ${code}. ` + `requestid: ${requestid}, hostid: ${hostid}, message: ${message}`);

                err.name = 'MNS' + extract(e.Code) + err.name;
                throw err;

              case 32:

                body = {};
                Object.keys(responseData[type]).forEach(function (key) {
                  if (key !== '$') {
                    body[key] = extract(responseData[type][key]);
                  }
                });

              case 34:
                return _context3.abrupt('return', {
                  code,
                  headers: getResponseHeaders(response.headers, attentions),
                  body: body
                });

              case 35:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function request(_x4, _x5, _x6, _x7) {
        return _ref3.apply(this, arguments);
      }

      return request;
    }()
  }, {
    key: 'get',
    value: function get(resource, type, opts) {
      return this.request('GET', resource, type, '', [], opts);
    }
  }, {
    key: 'put',
    value: function put(resource, type, body) {
      var attentions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var opts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      return this.request('PUT', resource, type, body, attentions, opts);
    }
  }, {
    key: 'post',
    value: function post(resource, type, body) {
      var attentions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var opts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      return this.request('POST', resource, type, body, attentions, opts);
    }
  }, {
    key: 'delete',
    value: function _delete(resource, type, body) {
      var attentions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var opts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      return this.request('DELETE', resource, type, body, attentions, opts);
    }
  }, {
    key: 'sign',
    value: function sign(verb, headers, resource) {
      var canonicalizedMNSHeaders = getCanonicalizedMNSHeaders(headers);
      var md5 = headers['content-md5'] || '';
      var date = headers['date'];
      var type = headers['content-type'] || '';

      var toSignString = `${verb}\n${md5}\n${type}\n${date}\n${canonicalizedMNSHeaders}${resource}`;
      // Signature = base64(hmac-sha1(VERB + "\n"
      //             + CONTENT-MD5 + "\n"
      //             + CONTENT-TYPE + "\n"
      //             + DATE + "\n"
      //             + CanonicalizedMNSHeaders
      //             + CanonicalizedResource))
      var buff = Buffer.from(toSignString, 'utf8');
      var degist = kitx.sha1(buff, this.accessKeySecret, 'binary');
      return Buffer.from(degist, 'binary').toString('base64');
    }
  }, {
    key: 'buildHeaders',
    value: function buildHeaders(method, body, resource, customHeaders) {
      var date = new Date().toGMTString();

      var headers = {
        'date': date,
        'host': this.endpointDomain,
        'x-mns-date': date,
        'x-mns-version': '2015-06-06'
      };

      if (method !== 'GET' && method !== 'HEAD') {
        var contentType = 'text/xml';
        var digest = kitx.md5(body, 'hex');
        var md5 = Buffer.from(digest, 'utf8').toString('base64');
        Object.assign(headers, {
          'content-length': body.length,
          'content-type': contentType,
          'content-md5': md5
        });
      }

      Object.assign(headers, customHeaders);

      var signature = this.sign(method, headers, resource);

      headers['authorization'] = `MNS ${this.accessKeyID}:${signature}`;

      if (this.securityToken) {
        headers['security-token'] = this.securityToken;
      }

      return headers;
    }

    // Queue

  }, {
    key: 'createQueue',
    value: function createQueue(name) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var body = toXMLBuffer('Queue', params);
      var url = `/queues/${name}`;
      return this.put(url, 'Queue', body, ['location']);
    }
  }, {
    key: 'deleteQueue',
    value: function deleteQueue(name) {
      return this.delete(`/queues/${name}`, 'Queue', '');
    }
  }, {
    key: 'listQueue',
    value: function () {
      var _ref4 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee4(start, limit, prefix) {
        var customHeaders, subType, response;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                customHeaders = {};

                if (typeof start !== 'undefined') {
                  customHeaders['x-mns-marker'] = start;
                }

                if (typeof limit !== 'undefined') {
                  customHeaders['x-mns-ret-number'] = limit;
                }

                if (typeof limit !== 'undefined') {
                  customHeaders['x-mns-prefix'] = prefix;
                }

                subType = 'Queue';
                _context4.next = 7;
                return this.get('/queues', 'Queues', {
                  headers: customHeaders
                });

              case 7:
                response = _context4.sent;

                response.body = response.body[subType];
                return _context4.abrupt('return', response);

              case 10:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function listQueue(_x15, _x16, _x17) {
        return _ref4.apply(this, arguments);
      }

      return listQueue;
    }()
  }, {
    key: 'getQueueAttributes',
    value: function getQueueAttributes(queueName) {
      return this.get(`/queues/${queueName}`, 'Queue');
    }
  }, {
    key: 'setQueueAttributes',
    value: function setQueueAttributes(queueName) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var body = toXMLBuffer('Queue', params);
      var url = `/queues/${queueName}?metaoverride=true`;
      return this.put(url, 'Queue', body);
    }

    // Message

  }, {
    key: 'sendMessage',
    value: function sendMessage(queueName, params) {
      var url = `/queues/${queueName}/messages`;
      var body = toXMLBuffer('Message', params);
      return this.post(url, 'Message', body);
    }
  }, {
    key: 'batchSendMessage',
    value: function () {
      var _ref5 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee5(queueName, params) {
        var url, subType, body, response;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                url = `/queues/${queueName}/messages`;
                subType = 'Message';
                body = toXMLBuffer('Messages', params, subType);
                _context5.next = 5;
                return this.post(url, 'Messages', body);

              case 5:
                response = _context5.sent;

                response.body = response.body[subType];
                return _context5.abrupt('return', response);

              case 8:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function batchSendMessage(_x19, _x20) {
        return _ref5.apply(this, arguments);
      }

      return batchSendMessage;
    }()
  }, {
    key: 'receiveMessage',
    value: function receiveMessage(queueName, waitSeconds) {
      var url = `/queues/${queueName}/messages`;
      if (waitSeconds) {
        url += `?waitseconds=${waitSeconds}`;
      }

      // 31000 31s +1s max waitSeconds is 30s
      return this.get(url, 'Message', { timeout: 31000 });
    }
  }, {
    key: 'batchReceiveMessage',
    value: function () {
      var _ref6 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee6(queueName, numOfMessages, waitSeconds) {
        var url, subType, response;
        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                url = `/queues/${queueName}/messages?numOfMessages=${numOfMessages}`;

                if (waitSeconds) {
                  url += `&waitseconds=${waitSeconds}`;
                }

                subType = 'Message';
                // 31000 31s +1s max waitSeconds is 30s

                _context6.next = 5;
                return this.get(url, 'Messages', { timeout: 31000 });

              case 5:
                response = _context6.sent;

                response.body = response.body[subType];
                return _context6.abrupt('return', response);

              case 8:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function batchReceiveMessage(_x21, _x22, _x23) {
        return _ref6.apply(this, arguments);
      }

      return batchReceiveMessage;
    }()
  }, {
    key: 'peekMessage',
    value: function peekMessage(queueName) {
      return this.get(`/queues/${queueName}/messages?peekonly=true`, 'Message');
    }
  }, {
    key: 'batchPeekMessage',
    value: function () {
      var _ref7 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee7(queueName, numOfMessages) {
        var url, subType, response;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                url = `/queues/${queueName}/messages?` + `peekonly=true&numOfMessages=${numOfMessages}`;
                subType = 'Message';
                // 31000 31s +1s max waitSeconds is 30s

                _context7.next = 4;
                return this.get(url, 'Messages');

              case 4:
                response = _context7.sent;

                response.body = response.body[subType];
                return _context7.abrupt('return', response);

              case 7:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function batchPeekMessage(_x24, _x25) {
        return _ref7.apply(this, arguments);
      }

      return batchPeekMessage;
    }()
  }, {
    key: 'deleteMessage',
    value: function deleteMessage(queueName, receiptHandle) {
      var url = `/queues/${queueName}/messages?ReceiptHandle=${receiptHandle}`;
      return this.delete(url, 'Message', '');
    }
  }, {
    key: 'batchDeleteMessage',
    value: function () {
      var _ref8 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee8(queueName, receiptHandles) {
        var body, url, response, subType;
        return _regenerator2.default.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                body = toXMLBuffer('ReceiptHandles', receiptHandles, 'ReceiptHandle');
                url = `/queues/${queueName}/messages`;
                _context8.next = 4;
                return this.delete(url, 'Errors', body);

              case 4:
                response = _context8.sent;

                // 3种情况，普通失败，部分失败，全部成功
                if (response.body) {
                  subType = 'Error';
                  // 部分失败

                  response.body = response.body[subType];
                }
                return _context8.abrupt('return', response);

              case 7:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function batchDeleteMessage(_x26, _x27) {
        return _ref8.apply(this, arguments);
      }

      return batchDeleteMessage;
    }()
  }, {
    key: 'changeMessageVisibility',
    value: function changeMessageVisibility(queueName, receiptHandle, visibilityTimeout) {
      var url = `/queues/${queueName}/messages?` + `receiptHandle=${receiptHandle}&visibilityTimeout=${visibilityTimeout}`;
      return this.put(url, 'ChangeVisibility', '');
    }

    // Topic

  }, {
    key: 'createTopic',
    value: function createTopic(name) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var body = toXMLBuffer('Topic', params);
      return this.put(`/topics/${name}`, 'Topic', body, ['location']);
    }
  }, {
    key: 'deleteTopic',
    value: function deleteTopic() {}
  }, {
    key: 'listTopic',
    value: function () {
      var _ref9 = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee9(start, limit, prefix) {
        var customHeaders, subType, response;
        return _regenerator2.default.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                customHeaders = {};

                if (typeof start !== 'undefined') {
                  customHeaders['x-mns-marker'] = start;
                }

                if (typeof limit !== 'undefined') {
                  customHeaders['x-mns-ret-number'] = limit;
                }

                if (typeof limit !== 'undefined') {
                  customHeaders['x-mns-prefix'] = prefix;
                }

                subType = 'Topic';
                _context9.next = 7;
                return this.get('/topics', 'Topics', {
                  headers: customHeaders
                });

              case 7:
                response = _context9.sent;

                response.body = response.body[subType];
                return _context9.abrupt('return', response);

              case 10:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function listTopic(_x29, _x30, _x31) {
        return _ref9.apply(this, arguments);
      }

      return listTopic;
    }()
  }, {
    key: 'getTopicAttributes',
    value: function getTopicAttributes(name) {
      return this.get(`/topics/${name}`, 'Topic');
    }
  }, {
    key: 'setTopicAttributes',
    value: function setTopicAttributes(name) {
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var body = toXMLBuffer('Topic', params);
      var url = `/topics/${name}?metaoverride=true`;
      return this.put(url, 'Topic', body);
    }

    // Subscription

  }, {
    key: 'subscribe',
    value: function subscribe() {}
  }, {
    key: 'unsubscribe',
    value: function unsubscribe() {}
  }, {
    key: 'listSubscriptionByTopic',
    value: function listSubscriptionByTopic() {}
  }, {
    key: 'getSubscriptionAttributes',
    value: function getSubscriptionAttributes() {}
  }, {
    key: 'setSubscriptionAttributes',
    value: function setSubscriptionAttributes() {}

    // Message

  }, {
    key: 'publishMessage',
    value: function publishMessage(topic, params) {
      var url = `/topics/${topic}/messages`;
      var body = toXMLBuffer('Message', params);
      return this.post(url, 'Message', body);
    }

    // Notifications

  }, {
    key: 'httpEndpoint',
    value: function httpEndpoint() {}
  }]);

  return Client;
}();

module.exports = Client;