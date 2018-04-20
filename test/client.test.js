'use strict';

const expect = require('expect.js');

const Client = require('../');

const ACCOUNT_ID = process.env.ACCOUNT_ID || 'accountid';
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || 'accessKeyID';
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET || 'accessKeySecret';

describe('client test', function () {
  it('constructor', function () {
    expect(() => {
      new Client();
    }).to.throwException(/"accountid" must be passed in/);

    expect(() => {
      new Client('accountid');
    }).to.throwException(/must pass in "opts"/);

    expect(() => {
      new Client('accountid', {});
    }).to.throwException(/must pass in "opts.accessKeyID"/);

    expect(() => {
      new Client('accountid', {
        accessKeyID: 'accessKeyID'
      });
    }).to.throwException(/must pass in "opts.accessKeySecret"/);

    expect(() => {
      new Client('accountid', {
        accessKeyID: 'accessKeyID',
        accessKeySecret: 'accessKeySecret'
      });
    }).to.throwException(/must pass in "opts.region"/);

    var client;
    client = new Client('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai'
    });
    expect(client.endpoint).to.be('http://accountid.mns.cn-shanghai.aliyuncs.com');

    client = new Client('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      secure: true
    });
    expect(client.endpoint).to.be('https://accountid.mns.cn-shanghai.aliyuncs.com');

    client = new Client('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      secure: true,
      internal: true
    });
    expect(client.endpoint).to.be('https://accountid.mns.cn-shanghai-internal.aliyuncs.com');
  });

  it('listQueue with invalid accessKeyID', async function() {
    var client = new Client('accountid', {
      accessKeyID: 'invalidAccessKeyID',
      accessKeySecret: 'invalidAccessKeySecret',
      region: 'cn-shanghai'
    });
    try {
      await client.listQueue();
    } catch (ex) {
      expect(ex.name).to.be('MNSInvalidAccessKeyIdError');
      expect(ex.message).to.match(/GET http:\/\/accountid\.mns\.cn-shanghai\.aliyuncs\.com\/queues failed with 403\. requestid: .{24}, hostid: http:\/\/accountid.mns.cn-shanghai.aliyuncs.com, message: The access Id you provided is not exist\./);
    }
  });

  it('listQueue with invalid accessKeySecret', function () {
    return (async function() {
      var client = new Client('accountid', {
        accessKeyID: ACCESS_KEY_ID,
        accessKeySecret: 'invalidAccessKeySecret',
        region: 'cn-shanghai'
      });
      try {
        await client.listQueue();
      } catch (ex) {
        expect(ex.name).to.be('MNSAccessDeniedError');
        expect(ex.message).to.match(/GET http:\/\/accountid.mns.cn-shanghai.aliyuncs.com\/queues failed with 403. requestid: .{24}, hostid: http:\/\/accountid.mns.cn-shanghai.aliyuncs.com, message: The OwnerId that your Access Key Id associated to is forbidden for this operation./);
      }
    })();
  });

  it('sign', function() {
    const client = new Client('ACCOUNT_ID', {
      accessKeyID: 'ACCESS_KEY_ID',
      accessKeySecret: 'ACCESS_KEY_SECRET',
      region: 'cn-shanghai'
    });
    var sign = client.sign('PUT', {
      'content-md5': '574683b3684e3cff610afa155cc2506d',
      'date': 'Tue, 11 Apr 2017 10:09:19 GMT',
      'content-type': 'text/xml',
      'x-mns-version': '2015-06-06'
    }, '/');
    expect(sign).to.be('A9zehggaYHHujmuRMxGIDrhWwx8=');
  });

  describe('API should ok', function () {
    const queueName = 'test-queue';
    const topicName = 'test-topic';

    const client = new Client(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: 'cn-shanghai'
    });

    it('createQueue should ok', async function() {
      const response = await client.createQueue(queueName);
      expect(response).to.be.ok();
      expect(response.code >= 200 && response.code < 300).to.be.ok();
      expect(response.headers).to.have.property('location', `http://${ACCOUNT_ID}.mns.cn-shanghai.aliyuncs.com/queues/test-queue`);
    });

    it('getQueueAttributes should ok', async function() {
      const response = await client.getQueueAttributes(queueName);
      expect(response).to.be.ok();
      expect(response.code >= 200 && response.code < 300).to.be.ok();
      expect(response.body).to.have.property('QueueName', 'test-queue');
    });

    it('setQueueAttributes should ok', async function() {
      const response = await client.setQueueAttributes(queueName);
      expect(response).to.be.ok();
      expect(response.code).to.be(204);
    });

    it('listQueue should ok', async function() {
      const response = await client.listQueue();
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body.length).to.above(0);
      const [queue] = body;
      expect(queue).to.have.property('QueueURL', `http://${ACCOUNT_ID}.mns.cn-shanghai.aliyuncs.com/queues/test-queue`);
    });

    it('sendMessage should ok', async function() {
      const response = await client.sendMessage(queueName, {
        MessageBody: 'just test it'
      });
      expect(response).to.be.ok();
      expect(response.code).to.be(201);
      const body = response.body;
      expect(body).to.have.property('MessageId');
      expect(body).to.have.property('MessageBodyMD5');
    });

    it('peekMessage should ok', async function() {
      const response = await client.peekMessage(queueName);
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body).to.have.property('MessageId');
      expect(body).to.have.property('MessageBodyMD5');
      expect(body).to.have.property('MessageBody');
      expect(body).to.have.property('EnqueueTime');
      expect(body).to.have.property('FirstDequeueTime');
      expect(body).to.have.property('DequeueCount');
      expect(body).to.have.property('Priority');
    });

    it('receiveMessage should ok', async function() {
      const response = await client.receiveMessage(queueName);
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body).to.have.property('MessageId');
      expect(body).to.have.property('MessageBodyMD5');
      expect(body).to.have.property('MessageBody');
      expect(body).to.have.property('ReceiptHandle');
      expect(body).to.have.property('EnqueueTime');
      expect(body).to.have.property('FirstDequeueTime');
      expect(body).to.have.property('NextVisibleTime');
      expect(body).to.have.property('DequeueCount');
      expect(body).to.have.property('Priority');
    });

    it('receiveMessage with waitSecond should ok', async function() {
      // send message first
      await client.sendMessage(queueName, {
        MessageBody: 'just test it'
      });
      const response = await client.receiveMessage(queueName, 10);
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body).to.have.property('MessageId');
      expect(body).to.have.property('MessageBodyMD5');
      expect(body).to.have.property('MessageBody');
      expect(body).to.have.property('ReceiptHandle');
      expect(body).to.have.property('EnqueueTime');
      expect(body).to.have.property('FirstDequeueTime');
      expect(body).to.have.property('NextVisibleTime');
      expect(body).to.have.property('DequeueCount');
      expect(body).to.have.property('Priority');
    });

    it('deleteMessage with waitSecond should ok', async function() {
      // send message first
      await client.sendMessage(queueName, {
        MessageBody: 'just test it'
      });
      const response = await client.receiveMessage(queueName, 10);
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body).to.have.property('MessageId');
      expect(body).to.have.property('MessageBodyMD5');
      expect(body).to.have.property('MessageBody');
      expect(body).to.have.property('ReceiptHandle');
      expect(body).to.have.property('EnqueueTime');
      expect(body).to.have.property('FirstDequeueTime');
      expect(body).to.have.property('NextVisibleTime');
      expect(body).to.have.property('DequeueCount');
      expect(body).to.have.property('Priority');
      const res = await client.deleteMessage(queueName, body.ReceiptHandle);
      expect(res).to.be.ok();
      expect(res.code).to.be(204);
    });

    it('batchSendMessage should ok', async function() {
      var messages = [
        {
          MessageBody: 'just test it'
        },
        {
          MessageBody: 'just test it 2'
        }
      ];
      const response = await client.batchSendMessage(queueName, messages);
      expect(response).to.be.ok();
      expect(response.code).to.be(201);
      const body = response.body;
      expect(body.length).to.above(0);
      const [message] = body;
      expect(message).to.have.property('MessageId');
      expect(message).to.have.property('MessageBodyMD5');
    });

    it('batchDeleteMessage shoule ok', async function() {
      const recived = await client.batchReceiveMessage(queueName, 2);
      expect(recived).to.be.ok();
      expect(recived.code).to.be(200);
      const messageIds = recived.body.map((item) => {
        return item.ReceiptHandle;
      });
      const res = await client.batchDeleteMessage(queueName, messageIds);
      expect(res).to.be.ok();
      expect(res.code).to.be(204);
    });

    it('deleteQueue shoule ok', async function() {
      const res = await client.deleteQueue(queueName);
      expect(res).to.be.ok();
      expect(res.code).to.be(204);
    });

    it('createTopic should ok', async function() {
      const response = await client.createTopic(topicName);
      expect(response).to.be.ok();
      expect(response.code >= 200 && response.code < 300).to.be.ok();
      expect(response.headers).to.have.property('location', `http://${ACCOUNT_ID}.mns.cn-shanghai.aliyuncs.com/topics/test-topic`);
    });

    it('listTopic should ok', async function() {
      const response = await client.listTopic();
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const body = response.body;
      expect(body.length).to.above(0);
      const [topic] = body;
      expect(topic).to.have.property('TopicURL', `http://${ACCOUNT_ID}.mns.cn-shanghai.aliyuncs.com/topics/test-topic`);
    });

    it('getTopicAttributes should ok', async function() {
      const response = await client.getTopicAttributes(topicName);
      expect(response).to.be.ok();
      expect(response.code).to.be(200);
      const topic = response.body;
      expect(topic).to.have.property('TopicName', topicName);
    });

    it('setTopicAttributes should ok', async function() {
      const response = await client.setTopicAttributes(topicName);
      expect(response).to.be.ok();
      expect(response.code).to.be(204);
    });

    it('publishMessage should ok', async function() {
      const response = await client.publishMessage(topicName, {
        MessageBody: 'test message'
      });
      expect(response).to.be.ok();
      expect(response.code).to.be(201);
      const message = response.body;
      expect(message).to.have.property('MessageId');
      expect(message).to.have.property('MessageBodyMD5');
    });
  });
});
