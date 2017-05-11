# mns-nodejs-sdk

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage][cov-image]][cov-url]

[npm-image]: https://img.shields.io/npm/v/@alicloud/mns.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@alicloud/mns
[travis-image]: https://img.shields.io/travis/aliyun/mns-nodejs-sdk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/aliyun/mns-nodejs-sdk.svg?branch=master
[cov-image]: https://coveralls.io/repos/aliyun/mns-nodejs-sdk/badge.svg?branch=master&service=github
[cov-url]: https://coveralls.io/github/aliyun/mns-nodejs-sdk?branch=master

Documents: http://doxmate.cool/aliyun/mns-nodejs-sdk/api.html


> 该 SDK 并未完全实现所有文档所提及的功能，如果您想使用的功能并未实现，请提[issue](https://github.com/aliyun/mns-nodejs-sdk/issues/new)以增加优先级。

## Installation

```bash
npm install @alicloud/mns --save
```

## API Spec

See: https://help.aliyun.com/document_detail/27475.html

## Test

```sh
ACCOUNT_ID=<ACCOUNT_ID> ACCESS_KEY_ID=<ACCESS_KEY_ID> ACCESS_KEY_SECRET=<ACCESS_KEY_SECRET> make test
```

## Installation

You can install it via npm/cnpm/yarn.

```sh
$ npm install @alicloud/mns --save
```

## Usage

```js
const MNSClient = require('@alicloud/mns');

const accountid = '<account id>';
var client = new MNSClient(accountid, {
  region: '<region>',
  accessKeyId: '<access key id>',
  accessKeySecret: '<access key secret>',
  // optional & default
  secure: false, // use https or http
  internal: false, // use internal endpoint
  vpc: false // use vpc endpoint
});

(async function () {
  let res;
  // create queue
  res = await client.createQueue('test-queue2');
  console.log(res);
  // list queue
  res = await client.listQueue();
  console.log(JSON.stringify(res, null, 2));
  // create topic
  res = await client.createTopic('test-topic');
  console.log(res);
  // get topic attributes
  res = await client.getTopicAttributes('test-topic');
  console.log(res);
  // publish message
  res = await client.publishMessage('<topic name>', {
    MessageBody: 'content',
    MessageAttributes: {
      DirectSMS: JSON.stringify({
        FreeSignName: '',
        TemplateCode: '<template code>',
        Type: '<type>',
        Receiver: '<phone number>',
        SmsParams: JSON.stringify({
          code: '<code>',
          product: '<product>'
        })
      })
    }
  });
  console.log(res);
})().then((data) => {
  console.log(data);
}, (err) => {
  console.log(err.stack);
});
```

## License

The [MIT](LICENSE) License
