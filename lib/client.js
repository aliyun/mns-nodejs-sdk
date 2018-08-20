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
    assert(accountid, '"accountid" must be passed in');
    this.accountid = accountid;
    assert(opts, 'must pass in "opts"');
    // 兼容
    const accessKeyID = opts.accessKeyId || opts.accessKeyID;
    assert(accessKeyID, 'must pass in "opts.accessKeyID"');
    this.accessKeyID = accessKeyID;
    assert(opts.accessKeySecret, 'must pass in "opts.accessKeySecret"');
    this.accessKeySecret = opts.accessKeySecret;
    assert(opts.region, 'must pass in "opts.region"');
    const {domain, endpoint} = getEndpoint(accountid, opts);
    this.endpointDomain = domain;
    this.endpoint = endpoint;

    // security token
    this.securityToken = opts.securityToken;
  }

  async request(method, resource, type, requestBody, attentions = [], opts = {}) {
    const url = `${this.endpoint}${resource}`;
    debug('url: %s', url);
    debug('method: %s', method);
    const headers = this.buildHeaders(method, requestBody, resource, opts.headers);
    debug('request headers: %j', headers);
    debug('request body: %s', requestBody.toString());
    const response = await httpx.request(url, Object.assign(opts, {
      method: method,
      headers: headers,
      data: requestBody
    }));

    debug('statusCode %s', response.statusCode);
    debug('response headers: %j', response.headers);
    const code = response.statusCode;

    const contentType = response.headers['content-type'] || '';
    // const contentLength = response.headers['content-length'];
    const responseBody = await httpx.read(response, 'utf8');
    debug('response body: %s', responseBody);

    var body;
    if (responseBody && (contentType.startsWith('text/xml') || contentType.startsWith('application/xml'))) {
      const responseData = await parseXML(responseBody);

      if (responseData.Error) {
        const e = responseData.Error;
        const message = extract(e.Message);
        const requestid = extract(e.RequestId);
        const hostid = extract(e.HostId);
        const err = new Error(`${method} ${url} failed with ${code}. ` +
          `requestid: ${requestid}, hostid: ${hostid}, message: ${message}`);
        err.name = 'MNS' + extract(e.Code) + err.name;
        throw err;
      }

      body = {};
      Object.keys(responseData[type]).forEach((key) => {
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

  get(resource, type, opts) {
    return this.request('GET', resource, type, '', [], opts);
  }

  put(resource, type, body, attentions = [], opts = {}) {
    return this.request('PUT', resource, type, body, attentions, opts);
  }

  post(resource, type, body) {
    return this.request('POST', resource, type, body);
  }

  delete(resource, type, body) {
    return this.request('DELETE', resource, type, body);
  }

  sign(verb, headers, resource) {
    const canonicalizedMNSHeaders = getCanonicalizedMNSHeaders(headers);
    const md5 = headers['content-md5'] || '';
    const date = headers['date'];
    const type = headers['content-type'] || '';

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

  buildHeaders(method, body, resource, customHeaders) {
    const date = new Date().toGMTString();

    const headers = {
      'date': date,
      'host': this.endpointDomain,
      'x-mns-date': date,
      'x-mns-version': '2015-06-06'
    };

    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = 'text/xml';
      const digest = kitx.md5(body, 'hex');
      const md5 = Buffer.from(digest, 'utf8').toString('base64');
      Object.assign(headers, {
        'content-length': body.length,
        'content-type': contentType,
        'content-md5': md5
      });
    }

    Object.assign(headers, customHeaders);

    const signature = this.sign(method, headers, resource);

    headers['authorization'] = `MNS ${this.accessKeyID}:${signature}`;

    if (this.securityToken) {
      headers['security-token'] = this.securityToken;
    }

    return headers;
  }

  // Queue
  createQueue(name, params = {}) {
    const body = toXMLBuffer('Queue', params);
    const url = `/queues/${name}`;
    return this.put(url, 'Queue', body, ['location']);
  }

  deleteQueue(name) {
    return this.delete(`/queues/${name}`, 'Queue', '');
  }

  async listQueue(start, limit, prefix) {
    var customHeaders = {};
    if (typeof start !== 'undefined') {
      customHeaders['x-mns-marker'] = start;
    }

    if (typeof limit !== 'undefined') {
      customHeaders['x-mns-ret-number'] = limit;
    }

    if (typeof limit !== 'undefined') {
      customHeaders['x-mns-prefix'] = prefix;
    }

    const subType = 'Queue';
    const response = await this.get('/queues', 'Queues', {
      headers: customHeaders
    });
    response.body = response.body[subType];
    return response;
  }

  getQueueAttributes(queueName) {
    return this.get(`/queues/${queueName}`, 'Queue');
  }

  setQueueAttributes(queueName, params = {}) {
    const body = toXMLBuffer('Queue', params);
    const url = `/queues/${queueName}?metaoverride=true`;
    return this.put(url, 'Queue', body);
  }

  // Message
  sendMessage(queueName, params) {
    const url = `/queues/${queueName}/messages`;
    const body = toXMLBuffer('Message', params);
    return this.post(url, 'Message', body);
  }

  async batchSendMessage(queueName, params) {
    const url = `/queues/${queueName}/messages`;
    const subType = 'Message';
    const body = toXMLBuffer('Messages', params, subType);
    var response = await this.post(url, 'Messages', body);
    response.body = response.body[subType];
    return response;
  }

  receiveMessage(queueName, waitSeconds) {
    var url = `/queues/${queueName}/messages`;
    if (waitSeconds) {
      url += `?waitseconds=${waitSeconds}`;
    }

    // 31000 31s +1s max waitSeconds is 30s
    return this.get(url, 'Message', {timeout: 31000});
  }

  async batchReceiveMessage(queueName, numOfMessages, waitSeconds) {
    var url = `/queues/${queueName}/messages?numOfMessages=${numOfMessages}`;
    if (waitSeconds) {
      url += `&waitseconds=${waitSeconds}`;
    }

    const subType = 'Message';
    // 31000 31s +1s max waitSeconds is 30s
    var response = await this.get(url, 'Messages', {timeout: 31000});
    response.body = response.body[subType];
    return response;
  }

  peekMessage(queueName) {
    return this.get(`/queues/${queueName}/messages?peekonly=true`, 'Message');
  }

  async batchPeekMessage(queueName, numOfMessages) {
    const url = `/queues/${queueName}/messages?` +
      `peekonly=true&numOfMessages=${numOfMessages}`;

    const subType = 'Message';
    // 31000 31s +1s max waitSeconds is 30s
    var response = await this.get(url, 'Messages');
    response.body = response.body[subType];
    return response;
  }

  deleteMessage(queueName, receiptHandle) {
    const url = `/queues/${queueName}/messages?ReceiptHandle=${receiptHandle}`;
    return this.delete(url, 'Message', '');
  }

  async batchDeleteMessage(queueName, receiptHandles) {
    const body = toXMLBuffer('ReceiptHandles', receiptHandles, 'ReceiptHandle');
    const url = `/queues/${queueName}/messages`;
    const response = await this.delete(url, 'Errors', body);
    // 3种情况，普通失败，部分失败，全部成功
    if (response.body) {
      const subType = 'Error';
      // 部分失败
      response.body = response.body[subType];
    }
    return response;
  }

  changeMessageVisibility(queueName, receiptHandle, visibilityTimeout) {
    const url = `/queues/${queueName}/messages?` +
      `receiptHandle=${receiptHandle}&visibilityTimeout=${visibilityTimeout}`;
    return this.put(url, 'ChangeVisibility', '');
  }

  // Topic
  createTopic(name, params = {}) {
    const body = toXMLBuffer('Topic', params);
    return this.put(`/topics/${name}`, 'Topic', body, ['location']);
  }

  deleteTopic() {}
  async listTopic(start, limit, prefix) {
    var customHeaders = {};
    if (typeof start !== 'undefined') {
      customHeaders['x-mns-marker'] = start;
    }

    if (typeof limit !== 'undefined') {
      customHeaders['x-mns-ret-number'] = limit;
    }

    if (typeof limit !== 'undefined') {
      customHeaders['x-mns-prefix'] = prefix;
    }

    const subType = 'Topic';
    const response = await this.get('/topics', 'Topics', {
      headers: customHeaders
    });
    response.body = response.body[subType];
    return response;
  }

  getTopicAttributes(name) {
    return this.get(`/topics/${name}`, 'Topic');
  }

  setTopicAttributes(name, params = {}) {
    const body = toXMLBuffer('Topic', params);
    const url = `/topics/${name}?metaoverride=true`;
    return this.put(url, 'Topic', body);
  }

  // Subscription
  subscribe() {}
  unsubscribe() {}
  listSubscriptionByTopic() {}
  getSubscriptionAttributes() {}
  setSubscriptionAttributes() {}

  // Message
  publishMessage(topic, params) {
    const url = `/topics/${topic}/messages`;
    const body = toXMLBuffer('Message', params);
    return this.post(url, 'Message', body);
  }

  // Notifications
  httpEndpoint() {}
}

module.exports = Client;
