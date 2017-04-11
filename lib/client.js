'use strict';

const assert = require('assert');

const debug = require('debug')('mns:client');
const httpx = require('httpx');
const kitx = require('kitx');

const {
  getEndpoint,
  toXMLBuffer,
  parseXML,
  extract,
  getResponseHeaders,
  getCanonicalizedMNSHeaders
} = require('./helper');

class Client {
  constructor(accountid, opts) {
    this.accountid = accountid;
    assert(opts, 'must pass in "opts"');
    assert(opts.region, 'must pass in "opts.region"');
    const {domain, endpoint} = getEndpoint(accountid, opts);
    this.endpointDomain = domain;
    this.endpoint = endpoint;
    assert(opts.accessKeyId, 'must pass in "opts.accessKeyId"');
    this.accessKeyId = opts.accessKeyId;
    assert(opts.accessKeySecret, 'must pass in "opts.accessKeySecret"');
    this.accessKeySecret = opts.accessKeySecret;
  }

  async request(method, resource, type, params, customHeaders, attentions = []) {
    const url = `${this.endpoint}${resource}`;
    const requestBody = method === 'GET' ? '': toXMLBuffer(type, params);
    debug('url: %s', url);
    debug('method: %s', method);
    const headers = this.buildHeaders(method, requestBody, resource);
    debug('request headers: %j', headers);
    debug('request body: %s', requestBody.toString());
    const response = await httpx.request(url, {
      method: method,
      headers: headers,
      data: requestBody
    });

    debug('statusCode %s', response.statusCode);
    debug('response headers: %j', response.headers);
    const code = response.statusCode;

    const contentType = response.headers['content-type'] || '';
    // const contentLength = response.headers['content-length'];
    const responseBody = await httpx.read(response, 'utf8');
    debug('response body: %s', responseBody);

    var body;
    if (responseBody && contentType.startsWith('text/xml')) {
      var responseData = await parseXML(responseBody);

      if (responseData.Error) {
        var e = responseData.Error;
        var err = new Error(extract(e.Message));
        err.name = 'MNS' + extract(e.Code) + err.name;
        err.data = {
          requestid: extract(e.RequestId),
          hostid: extract(e.HostId)
        };

        throw err;
      }

      body = {};
      Object.keys(responseData[type])
        .forEach((key) => {
          if (key !== '$') {
            body[key] = extract(responseData[type][key]);
          }
        });
    }

    return {
      code,
      headers: getResponseHeaders(response.headers, attentions),
      body: body
    };
  }

  get(resource, type, customHeaders) {
    return this.request('GET', resource, type, {}, [], customHeaders);
  }

  put(resource, type, params, attentions = []) {
    return this.request('PUT', resource, type, params, attentions);
  }

  post(resource, type, params) {
    return this.request('POST', resource, type, params);
  }

  sign(verb, headers, resource) {
    const canonicalizedMNSHeaders = getCanonicalizedMNSHeaders(headers);
    const md5 = headers['content-md5'];
    const date = headers['date'];
    const type = headers['content-type'];

    var toSignString = `${verb}\n${md5}\n${type}\n${date}\n${canonicalizedMNSHeaders}${resource}`;
    // Signature = base64(hmac-sha1(VERB + "\n"
    //             + CONTENT-MD5 + "\n"
    //             + CONTENT-TYPE + "\n"
    //             + DATE + "\n"
    //             + CanonicalizedMNSHeaders
    //             + CanonicalizedResource))
    var buff = Buffer.from(toSignString, 'utf8');
    const degist = kitx.sha1(buff, this.accessKeySecret, 'binary');
    return Buffer.from(degist, 'binary').toString('base64');
  }

  buildHeaders(method, body, resource) {
    const date = new Date().toGMTString();
    const contentType = 'text/xml';
    const degist = kitx.md5(body, 'hex');
    const md5 = Buffer.from(degist, 'utf8').toString('base64');

    var headers = {
      'content-length': body.length,
      'content-md5': md5,
      'content-type': contentType,
      'date': date,
      'host': this.endpointDomain,
      'x-mns-date': date,
      'x-mns-version': '2015-06-06'
    };

    const signature = this.sign(method, headers, resource);

    headers['authorization'] = `MNS ${this.accessKeyId}:${signature}`;

    return headers;
  }

  // Queue
  createQueue(name, params = {}) {
    return this.put(`/queues/${name}`, 'Queue', params, ['location']);
  }

  deleteQueue() {}

  listQueue(start, limit, prefix) {
    var customHeaders = {
      'x-mns-marker': start,
      'x-mns-ret-number': limit,
      'x-mns-prefix': prefix
    };

    return this.get('/queues', 'Queues', customHeaders);
  }

  getQueueAttributes() {}
  setQueueAttributes() {}

  // Message
  sendMessage() {}
  batchSendMessage() {}
  receiveMessage() {}
  batchReceiveMessage() {}
  peekMessage() {}
  batchPeekMessage() {}
  deleteMessage() {}
  batchDeleteMessage() {}
  changeMessageVisibility() {}

  // Topic
  createTopic(name, params = {}) {
    return this.put(`/topics/${name}`, 'Topic', params, ['location']);
  }

  deleteTopic() {}
  listTopic(start, limit, prefix) {
    var customHeaders = {
      'x-mns-marker': start,
      'x-mns-ret-number': limit,
      'x-mns-prefix': prefix
    };

    return this.get('/topics', 'Topics', customHeaders);
  }

  getTopicAttributes(name) {
    return this.get(`/topics/${name}`, 'Topic');
  }

  setTopicAttributes(name, params = {}) {
    return this.put(`/topics/${name}?metaoverride=true`, 'Topic', params);
  }

  // Subscription
  subscribe() {}
  unsubscribe() {}
  listSubscriptionByTopic() {}
  getSubscriptionAttributes() {}
  setSubscriptionAttributes() {}

  // Message
  publishMessage(topic, params) {
    return this.post(`/topics/${topic}/messages`, 'Message', params);
  }

  // Notifications
  httpEndpoint() {}
}

module.exports = Client;
