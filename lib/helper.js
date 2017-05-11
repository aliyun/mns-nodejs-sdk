'use strict';

const xml2js = require('xml2js');

exports.parseXML = function (input) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(input, (err, obj) => {
      if (err) {
        return reject(err);
      }
      resolve(obj);
    });
  });
};

exports.extract = function extract (arr) {
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

function format (params) {
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
}

exports.toXMLBuffer = function (entityType, params, subType) {
  var xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml +=    `<${entityType} xmlns="http://mns.aliyuncs.com/doc/v1/">`;
  if (Array.isArray(params)) {
    params.forEach((item) => {
      xml +=  `<${subType}>`;
      xml += format(item);
      xml +=  `</${subType}>`;
    });
  } else {
    xml +=    format(params);
  }
  xml +=    `</${entityType}>`;
  return Buffer.from(xml, 'utf8');
};

// http(s)://{AccountId}.mns.cn-beijing.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal-vpc.aliyuncs.com

exports.getEndpoint = function (accountid, opts) {
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
};

exports.getCanonicalizedMNSHeaders = function (headers) {
  return Object.keys(headers)
    .filter((key) => key.startsWith('x-mns-'))
    .sort()
    .map((key) => `${key}:${headers[key]}\n`)
    .join('');
};

exports.getResponseHeaders = function (headers, attentions) {
  var result = {};
  attentions.forEach((key) => {
    result[key] = headers[key];
  });
  return result;
};
