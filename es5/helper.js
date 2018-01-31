'use strict';

var xml2js = require('xml2js');

exports.parseXML = function (input) {
  return new Promise(function (resolve, reject) {
    xml2js.parseString(input, function (err, obj) {
      if (err) {
        return reject(err);
      }
      resolve(obj);
    });
  });
};

exports.extract = function extract(arr) {
  if (arr && arr.length === 1 && typeof arr[0] === 'string') {
    return arr[0];
  }

  arr.forEach(function (item) {
    Object.keys(item).forEach(function (key) {
      item[key] = extract(item[key]);
    });
  });

  return arr;
};

function format(params) {
  var xml = '';
  Object.keys(params).forEach(function (key) {
    var value = params[key];
    if (typeof value === 'object') {
      xml += `<${key}>${format(value)}</${key}>`;
    } else {
      xml += `<${key}>${value}</${key}>`;
    }
  });
  return xml;
}

exports.toXMLBuffer = function (entityType, params, subType) {
  var xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += `<${entityType} xmlns="http://mns.aliyuncs.com/doc/v1/">`;
  if (Array.isArray(params)) {
    params.forEach(function (item) {
      xml += `<${subType}>`;
      xml += format(item);
      xml += `</${subType}>`;
    });
  } else {
    xml += format(params);
  }
  xml += `</${entityType}>`;
  return Buffer.from(xml, 'utf8');
};

// http(s)://{AccountId}.mns.cn-beijing.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal.aliyuncs.com
// http://{AccountId}.mns.cn-beijing-internal-vpc.aliyuncs.com

exports.getEndpoint = function (accountid, opts) {
  var protocol = opts.secure ? 'https' : 'http';
  var region = `${opts.region}`;
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
  return Object.keys(headers).filter(function (key) {
    return key.startsWith('x-mns-');
  }).sort().map(function (key) {
    return `${key}:${headers[key]}\n`;
  }).join('');
};

exports.getResponseHeaders = function (headers, attentions) {
  var result = {};
  attentions.forEach(function (key) {
    result[key] = headers[key];
  });
  return result;
};