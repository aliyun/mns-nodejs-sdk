# aliyun-mns-nodejs-sdk

> 该 SDK 并未完全实现所有文档所提及的功能，如果您想使用的功能并未实现，请提[issue](https://github.com/aliyun/aliyun-mns-nodejs-sdk/issues/new)以增加优先级。

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
The MIT License
