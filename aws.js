'use strict';

const AWS = require('aws-sdk');
AWS.config = {
    "region": process.env.REGION
};
AWS.config.region = 'ca-central-1';
var apigateway = new AWS.APIGateway();

// var params = {
//     customerId: 'STRING_VALUE',
//     includeValues: true || false,
//     limit: 0,
//     nameQuery: 'STRING_VALUE',
//     position: 'STRING_VALUE'
//   };
//   apigateway.getApiKeys(params, function(err, data) {
//     if (err) console.log(err, err.stack); // an error occurred
//     else     console.log(data);           // successful response
//   });

var params = {
    includeValues: true,
    nameQuery: 'Integration Swagger'
  };
  apigateway.getApiKeys(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else{
        console.log(data.items[0].value);
        console.log(data);           // successful response
    }    
  });
