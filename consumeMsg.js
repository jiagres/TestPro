'use strict';

const AWS = require('aws-sdk');
AWS.config = {
    "region": 'us-east-2'
  };
  var sqs = new AWS.SQS();
  var sns = new AWS.SNS();

  function getQueueUrl(sqs, queue, callback) {
    var params = {
      QueueName: queue /* required */
    };
    sqs.getQueueUrl(params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        return callback(err);
      }
      else {
        console.log(data);           // successful response
        return callback(null,data);
      }
    });
  }


  function receiveMessage(queueName, sqs, callback){
    getQueueUrl(sqs, queueName, function(err,data){
      if(err){
        return callback(err);
      }
      else{
        var params = {
          QueueUrl: data.QueueUrl
        };
        sqs.receiveMessage(params, function(err, result) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            return callback(err);
          }
          else{
                 console.log(result);           // successful response
                 return callback(null,result);
          }
        });
      }
    })
  }

var queueName ='Queue_JerryTest';
receiveMessage(queueName,sqs, function(err,data){
  if(err){
    console.log(err);
  }
  else{
    console.log(data);
  }
});