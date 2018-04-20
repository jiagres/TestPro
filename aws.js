'use strict';

const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config = {
  "region": process.env.REGION
};
var apigateway = new AWS.APIGateway();
var cognito = new AWS.CognitoIdentityServiceProvider();
function getApiKeys() {
  var params = {
    includeValues: true,
    nameQuery: 'Integration Swagger'
  };
  apigateway.getApiKeys(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      console.log(data.items[0].value);
      console.log(data);           // successful response
    }
  });
}

function createUserPool() {
  var params = {
    PoolName: 'jerrytest', /* required */
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
        RequireUppercase: true
      }
    }
  };
  cognito.createUserPool(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}


function getUserPoolId(poolName, cognito, callback) {
  var result = null;
  var params = {
    MaxResults: 10
  };
  cognito.listUserPools(params, function (err, data) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (data.UserPools.length > 0) {
        for (var index in data.UserPools) {
          if (data.UserPools[index].Name == poolName) {
            result = data.UserPools[index].Id;
            break;
          }
        }
      }
      else {
        result = null;
      }
      return callback(null, result);
    }
  });
};

getUserPoolId('JillTestUserPool', cognito, function (err, data) {
  if (err) console.log(err);
  else console.log(data);
});

function createUser() {
  var params = {
    UserPoolId: process.env.USER_POOL, /* required */
    Username: userName, /* required */
    TemporaryPassword: password
  };
  cognito.adminCreateUser(params, function (err, data) {
    if (err) {
      return callback(err, null); // an error occurred
    }
    else {
      return callback(null, data);
    }       // successful response
  });
}
