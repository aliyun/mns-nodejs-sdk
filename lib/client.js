'use strict';

const assert = require('assert');

const debug = require('debug')('mns:client');
const httpx = require('httpx');
const xml2js = require('xml2js');
const kitx = require('kitx');

const parseXML = function (input) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(input, (err, obj) => {
      if (err) {
        return reject(err);
      }
      resolve(obj);
    });
  });
};

const extract = function (arr) {
  if (arr && arr.length === 1 && typeof arr[0] === 'string') {
    return arr[0];
  }

  arr.forEach((item) => {
    Object.keys(item).forEach((key) => {
      item[key] = extract(item[key]);
    });
  });

  return arr;
};

const format = function (params) {
  var xml = '';
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (typeof value === 'object') {
      xml +=    `<${key}>${format(value)}</${key}>`;
    } else {
      xml +=    `<${key}>${value}</${key}>`;
    }
  });
  return xml;
};

const toXMLBuffer = function (entityType, params) {
  var xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml +=    `<${entityType} xmlns="http://mns.aliyuncs.com/doc/v1/">`;
  xml +=    format(params);
  xml +=    `</${entityType}>`;
  return Buffer.from(xml, 'utf8');
};

// http(s)://{AccountId}.mns.cn-beijing.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal-vpc.aliyuncs.com

function getEndpoint(accountid, opts) {
  const protocol = opts.secure ? 'https' : 'http';
  let region = `${opts.region}`;
  if (opts.internal) {
    region += '-internal';
  }

  if (opts.vpc) {
    region += '-vpc';
  }

  return {
    endpoint: `${protocol}://${accountid}.mns.${region}.aliyuncs.com`,
    domain: `${accountid}.mns.${region}.aliyuncs.com`
  };
}

function getCanonicalizedMNSHeaders(headers) {
  return Object.keys(headers)
    .filter((key) => key.startsWith('x-mns-'))
    .sort()
    .map((key) => `${key}:${headers[key]}\n`)
    .join('');
}

function getResponseHeaders(headers, attentions) {
  var result = {};
  attentions.forEach((key) => {
    result[key] = headers[key];
  });
  return result;
}

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
    return this.request('GET', resource, type, {}, customHeaders);
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
    return this.request('PUT', `/queues/${name}`, 'Queue', params, ['location']);
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
    return this.request('PUT', `/topics/${name}`, 'Topic', params, ['location']);
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
    return this.request('PUT', `/topics/${name}?metaoverride=true`, 'Topic', params);
  }

  // Subscription
  subscribe() {}
  unsubscribe() {}
  listSubscriptionByTopic() {}
  getSubscriptionAttributes() {}
  setSubscriptionAttributes() {}

  // Message
  publishMessage(topic, params) {
    return this.request('POST', `/topics/${topic}/messages`, 'Message', params);
  }

  // Notifications
  httpEndpoint() {}
}

module.exports = Client;
