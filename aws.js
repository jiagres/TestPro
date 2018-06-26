'use strict';

const AWS = require('aws-sdk');
require('dotenv').config();
AWS.config = {
  "region": process.env.REGION
};
var apigateway = new AWS.APIGateway();
var cognito = new AWS.CognitoIdentityServiceProvider();
var secretsmanager = new AWS.SecretsManager();
var sqs = new AWS.SQS();
var sns = new AWS.SNS();
var ssm = new AWS.SSM();
var appClientName = process.env.APP_CLIENT_NAME;
var poolName = process.env.USER_POOL;
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
    PoolName: 'apiauthorization', /* required */
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireLowercase: true,
        RequireNumbers: true,
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

function getUserandAppClientId(appClientName, poolName, cognito, callback) {
  let result = { "poolId": "", "clientId": "" };
  getUserPoolId(poolName, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      result.poolId = poolId;
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + poolName);
        return callback(null, result);
      }
      else {
        var params = {
          UserPoolId: poolId, /* required */
          MaxResults: 10
        };
        cognito.listUserPoolClients(params, function (err, data) {
          if (err) {
            return callback(err, null);
          }
          else {
            if (data.UserPoolClients.length > 0) {
              for (var index in data.UserPoolClients) {
                if (data.UserPoolClients[index].ClientName == appClientName) {
                  result.clientId = data.UserPoolClients[index].ClientId;
                  break;
                }
              }
            }
            else {
              result.clientId = null;
            }
            return callback(null, result);
          }
        });
      }
    }
  })
}

function getRandomPassword(secretsmanager, callback) {
  var params = {
    ExcludePunctuation: true
  };
  secretsmanager.getRandomPassword(params, function (err, data) {
    if (err) {
      console.log('generate random password failed.' + err);
      return callback(err, null); // an error occurred
    }
    else {
      return callback(null, data.RandomPassword);
    }
  });
}

function adminInitiateAuth(appClientName, poolName, userName, tmpPassword, cognito, secretsmanager, callback) {
  getUserandAppClientId(appClientName, poolName, cognito, function (err, data) {
    if (err) {
      console.log(err);
      return callback(err, null);
    }
    else {
      var params = {
        AuthFlow: 'ADMIN_NO_SRP_AUTH', /* required */
        ClientId: data.clientId, /* required */
        UserPoolId: data.poolId, /* required */
        AuthParameters: {
          USERNAME: userName,
          PASSWORD: tmpPassword
        }
      };
      cognito.adminInitiateAuth(params, function (err, authenticationResult) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          return callback(err, null);
        }
        else {
          authenticationResult.clientId = data.clientId;
          authenticationResult.poolId = data.poolId;
          //console.log(authenticationResult);           // successful response
          return callback(null, authenticationResult);
        }
      });
    }
  });
}

function resetUsertoReady(appClientName, poolName, userName, tmpPassword, cognito, secretsmanager, callback) {
  adminInitiateAuth(appClientName, poolName, userName, tmpPassword, cognito, secretsmanager, function (err, authenticationResult) {
    if (err) {
      console.log(err);
      return callback(err, null);
    }
    else {
      getRandomPassword(secretsmanager, function (err, password) {
        if (err) {
          console.log(err);
          return callback(err, null);
        }
        else {
          var params = {
            ChallengeName: 'NEW_PASSWORD_REQUIRED', /* required */
            ClientId: authenticationResult.clientId, /* required */
            UserPoolId: authenticationResult.poolId, /* required */
            ChallengeResponses: {
              USERNAME: userName,
              NEW_PASSWORD: password
              /* anotherKey: ... */
            },
            Session: authenticationResult.Session
          };
          cognito.adminRespondToAuthChallenge(params, function (err, data) {
            if (err) {
              console.log(err);
              return callback(err, null); // an error occurred
            }
            else {
              data.password = password;
              return callback(null, data);
            }
          });
        }
      });
    }
  });
}


function createAppClient(cognito, callback) {
  getUserPoolId(process.env.USER_POOL, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + process.env.USER_POOL);
        return callback();
      }
      else {
        var params = {
          ClientName: process.env.APP_CLIENT_NAME, /* required */
          UserPoolId: poolId, /* required */
          ExplicitAuthFlows: [
            'ADMIN_NO_SRP_AUTH'
            /* more items */
          ],
          GenerateSecret: false
        };
        cognito.createUserPoolClient(params, function (err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            return callback(err, null);
          }
          else {
            console.log(data);           // successful response
            return callback(null, data);
          }
        });
      }
    }
  })
};

function isNumber(value) {
  var patrn = /^(-)?\d+(\.\d+)?$/;
  if (patrn.exec(value) == null || value == "") {
    return false
  } else {
    return true
  }
}

function generateUserName(appName, poolName, cognito, callback) {
  var i = 1;
  let preUserName = 'user' + appName.split(" ")[0];
  let userName = preUserName + i;
  let result = { "username": "", "password": "" };
  getUserPoolId(poolName, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + poolName);
        return callback();
      }
      else {
        var params = {
          UserPoolId: poolId,
          Filter: 'username^="' + preUserName + '"',
          Limit: 60
        };
        cognito.listUsers(params, function (err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else {
            var noList = [];
            for (var index in data.Users) {
              var num = data.Users[index].Username.substring(preUserName.length);
              if (isNumber(num)) {
                noList.push(num);
              }
            }
            if (noList.length > 0) {
              userName = preUserName + (Math.max.apply(null, noList) + 1);
            }
            createUser(appClientName, poolName, userName, secretsmanager, cognito, function (err, data) {
              if (err) {
                return callback(err, null);
              }
              else {
                result.username = data.User.Username;
                result.password = data.User.password;
                return callback(null, result);
              }
            });
          }
        });
      }
    }
  })
}

// getUserPoolId('JillTestUserPool', cognito, function (err, data) {
//   if (err) console.log(err);
//   else console.log(data);
// });

function createUser(userName, password, cognito, callback) {
  getUserPoolId(process.env.USER_POOL, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + process.env.USER_POOL);
        return callback();
      }
      else {
        var params = {
          UserPoolId: poolId, /* required */
          Username: userName, /* required */
          TemporaryPassword: password
        };
        cognito.adminCreateUser(params, function (err, data) {
          if (err) {
            return callback(err, null); // an error occurred
          }
          else {
            return callback(null, data); // successful response
          }
        });
      }
    }
  });

};

function createUser(appClientName, poolName, userName, secretsmanager, cognito, callback) {
  getUserPoolId(poolName, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + poolName);
        return callback();
      }
      else {
        getRandomPassword(secretsmanager, function (err, tmpPassword) {
          if (err) {
            console.log('generate random password failed.' + err);
            return callback(err, null);
          } // an error occurred
          else {
            var params = {
              UserPoolId: poolId, /* required */
              Username: userName, /* required */
              TemporaryPassword: tmpPassword
            };
            cognito.adminCreateUser(params, function (err, data) {
              if (err) {
                return callback(err, null); // an error occurred
              }
              else {
                //return callback(null, data); // successful response
                resetUsertoReady(appClientName, poolName, userName, tmpPassword, cognito, secretsmanager, function (err, result) {
                  if (err) {
                    return callback(err, null);
                  }
                  else {
                    data.User.password = result.password;
                    return callback(null, data);
                  }
                })
              }
            });
          }
        });
      }
    }
  });

};

function changePassword(userName, prePassword, proPassword, cognito, callback) {
  var params = {
    PreviousPassword: prePassword, /* required */
    ProposedPassword: proPassword /* required */
  };
  cognito.changePassword(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
};

function deleteUser(userName, cognito, callback) {
  getUserPoolId(process.env.USER_POOL, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + process.env.USER_POOL);
        return callback();
      }
      else {
        var params = {
          UserPoolId: poolId,  /* required */
          Username: userName /* required */
        };
        cognito.adminDeleteUser(params, function (err, data) {
          if (err) {
            return callback(err, null); // an error occurred
          }
          else {
            return callback(null, data);
          }
        });
      }
    }
  });
};

function disableUser(userName, cognito, callback) {
  getUserPoolId(process.env.USER_POOL, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + process.env.USER_POOL);
        return callback();
      }
      else {
        var params = {
          UserPoolId: poolId,  /* required */
          Username: userName /* required */
        };
        cognito.adminDisableUser(params, function (err, data) {
          if (err) {
            return callback(err, null); // an error occurred
          }
          else {
            return callback(null, data);
          }
        });
      }
    }
  });
}

function resetPassword(userName, cognito, callback) {
  getUserPoolId(process.env.USER_POOL, cognito, function (err, poolId) {
    if (err) {
      return callback(err, null);
    }
    else {
      if (poolId == null) {
        console.log('not found UserPoolId for UserPool' + process.env.USER_POOL);
        return callback();
      }
      else {
        var params = {
          UserPoolId: poolId, /* required */
          Username: userName, /* required */
        };
        cognito.adminResetUserPassword(params, function (err, data) {
          if (err) {
            return callback(err, null); // an error occurred
          }
          else {
            return callback(null, data);
          }       // successful response
        });
      }
    }
  });
}

function updatePassword(appClientName, poolName, userName, cognito, secretsmanager, callback) {
  let result = { "username": "", "password": "" };
  deleteUser(userName, cognito, function (err, data) {
    if (err) {
      return callback(err, null);
    }
    else {
      createUser(appClientName, poolName, userName, secretsmanager, cognito, function (err, data) {
        if (err) {
          return callback(err, null);
        }
        else {
          result.username = data.User.Username;
          result.password = data.User.password;
          return callback(null, result);
        }
      });
    }
  })
};

function createSQS(sqs) {
  var params = {
    QueueName: 'Queue_JerryTest' /* required */
    // Attributes: {
    //   '<QueueAttributeName>': 'STRING_VALUE',
    //   /* '<QueueAttributeName>': ... */
    // }
  };
  sqs.createQueue(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function getParameter(paramName, isDecode) {
  var params = {
    Name: paramName, /* required */
    WithDecryption: true
  };
  ssm.getParameter(params, function (err, data) {
    if (err) console.log(err.code); // an error occurred
    else {
      if (data) {
        console.log('data existed');
      }
      if (isDecode) {
        data.Parameter.Value = new Buffer(data.Parameter.Value, 'base64').toString();
      }
      console.log(data);
    }
  });
}

function createParameter(paramName, paramValue) {
  var params = {
    Name: paramName, /* required */
    Type: 'SecureString', /* required */
    Value: paramValue, /* required */
    Overwrite: true
  };
  ssm.putParameter(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}


function addPermission(sqs) {
  var params = {
    AWSAccountIds: ['*'],
    Actions: [ /* required */
      'SendMessage'
      /* more items */
    ],
    Label: 'jerrylabel_1', /* required */
    QueueUrl: 'https://sqs.us-east-2.amazonaws.com/890403726045/Queue_JerryTest' /* required */
  };
  sqs.addPermission(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function addPerm(sqs) {
  var policy = {
    "Version": "2012-10-17",
    "Id": "Queue_Policy",
    "Statement":
    {
      "Sid": "Queue_AnonymousAccess_ReceiveMessage",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-2:890403726045:Queue_JerryTest"
    }
  }

  sqs.setQueueAttributes({
    QueueUrl: 'https://sqs.us-east-2.amazonaws.com/890403726045/Queue_JerryTest',
    Attributes: {
      Policy: JSON.stringify(policy)
    }
  }, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function setSubScriptionAttribute(sns) {
  var params = {
    AttributeName: 'RawMessageDelivery', /* required */
    SubscriptionArn: 'arn:aws:sns:us-east-2:890403726045:JerryTest:943014fb-fc49-4c14-b38f-2c7b4da27098', /* required */
    AttributeValue: 'true'
  };
  sns.setSubscriptionAttributes(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function subScribe(sns, topicArn, queueArn, apiName) {
  var params = {
    Protocol: 'sqs', /* required */
    TopicArn: topicArn, /* required */
    Attributes: {
      'RawMessageDelivery': 'true',
      'FilterPolicy': '{"apiName": ["' + apiName + '"]}'
    },
    Endpoint: queueArn,
    ReturnSubscriptionArn: true
  };
  sns.subscribe(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}

function getQueueUrl(sql) {
  var params = {
    QueueName: 'Queue_JerryTest', /* required */
  };
  sqs.getQueueUrl(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}


function getSubScribeArnByQueueArn(topicArn, queueArn, sns, callback) {
  var result = null;
  var nextBatch = function (nextToken) {
    var params = {
      TopicArn: topicArn
    };
    if (nextToken) {
      params.NextToken = nextToken;
    }
    sns.listSubscriptionsByTopic(params, function (err, data) {
      if (err) {
        return callback(err, null);
      }
      else {
        if (data.Subscriptions.length > 0) {
          for (var index in data.Subscriptions) {
            if (data.Subscriptions[index].Endpoint === queueArn) {
              result = data.Subscriptions[index].SubscriptionArn;
              break;
            }
          }
        }
        if (data.NextToken) {
          nextBatch(data.NextToken);
        }
        else {
          return callback(null, result);
        }
      }
    });
  };
  nextBatch();
}

function removeSubScribe(topicArn, queueArn, sns, callback) {
  var subScriptionArn = null;
  getSubScribeArnByQueueArn(topicArn, queueArn, sns, function (err, data) {
    if (err) {
      return callback(err, null);
    }
    else {
      subScriptionArn = data;
      var params = {
        SubscriptionArn: subScriptionArn /* required */
      };
      sns.unsubscribe(params, function (err, data) {
        if (err) {
          return callback(err, null);
        }
        else {
          return callback(null, data);
        }
      });
    }
  })
}

function publishMsgToTopic(topicArn, sns, subject, message, callback) {
  var params = {
    Message: message, /* required */
    MessageAttributes: {
      'apiName': {
        DataType: 'String', /* required */
        StringValue: 'test'
      }
    },
    Subject: subject,
    TopicArn: topicArn
  };
  sns.publish(params, function (err, data) {
    if (err) {
      return callback(err);
    }
    else {
      return callback(null, data);
    }          // successful response
  });
}


// var a="aaa", b="aaa"
// var c="uuu", d="uuu"
// if(a==b & c==d){
//   console.log('1 and 2 match codition')
// }else{

// }

//createParameter('jerrytest1',new Buffer('jerrytest1:test').toString('base64'));

//getParameter('infApiUser', false);

// adminInitiateAuth('apiauthorization-app-client','apiauthorization','infApiUser','hc9VSV5pXR5zaP2o4AvnibO7c62vnWDY',cognito,secretsmanager,function(err,data){
//   if(err){
//     console.log(err);
//   }
//   else
//   {
//     console.log(data);
//   }
// })

//createSQS(sqs);

//createUserPool();

// createAppClient(cognito, function (err, data) {
//   if (err) {
//     console.log(err);
//   }
//   else {
//     console.log(data);
//   }
// })

// getAppClientId(cognito,function(err,data){
//     if (err) {
//     console.log(err);
//   }
//   else {
//     console.log(data);
//   }
// })

// createUser(appClientName,poolName,'infApiUser',secretsmanager,cognito, function(err,data){
//   if(err){
// //console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// });

// resetPassword('jerry',cognito,function(err,data){
//   if(err){
//     console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// })

// changePassword('jerry','Test@123456','Test@654321',cognito,function(err,data){
//   if(err){
//     console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// });

// disableUser('jerry',cognito,function(err,data){
//   if(err){
//     console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// });

// deleteUser('jerry',cognito,function(err,data){
//   if(err){
//     console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// });

// updatePassword(appClientName,poolName,'userjerry7',cognito,secretsmanager,function(err,data){
//     if(err){
//       console.log(err);
//   }
//   else{
//     console.log(data);
//   }
// })

// generateUserName('jerry', poolName, cognito, function (err, data) {
//   if (err) {

//   }
//   else {
//     console.log(data);
//   }
// })

// var paramValue = new Buffer('infApiUser:xxxxx').toString('base64');
// console.log(paramValue);

//addPermission(sqs);
//addPerm(sqs);
//getQueueUrl(sqs);

var apiName = 'test';
var topicArn = 'arn:aws:sns:us-east-2:890403726045:JerryTest';
var queueArn = 'arn:aws:sqs:us-east-2:890403726045:Queue_JerryTest';
var message = 'HelloWorld';
var subject = 'jerrytesthello_01'

//subScribe(sns, topicArn, queueArn, apiName)

// getSubScribeArnByQueueArn(topicArn, queueArn, sns, function (err, data) {
//   if (err) {
//     console.log(err);
//   }
//   else {
//     console.log(data);
//   }
// })

// removeSubScribe(topicArn, queueArn, sns, function (err, data) {
//   if (err) {
//     console.log(err);
//   }
//   else {
//     console.log(data);
//   }
// })

var request={
  "Customer": "intgTest",
  "APIName": "apiName",
  "SourceSystem": "",
  "RouteKey": "intgTestK",
  "RouteType": "lambda",
  "RouteRegion": "region",
  "RouteAccount": "accountid",
  "RouteRole": "",
  "RouteInfo": "infRouteTest1",
  "RouteAuth": "",
  "AuthParameter":{
  "authType":"oauth",
  "authParams":{
          "tokenUrl":"",
          "headers": {
              "Content-Type": "application/x-www-form-urlencoded"
          },
          "body": "grant_type=client_credentials&redirect_uri=https://localhost/"
  }}
};

publishMsgToTopic(topicArn, sns, subject, message, function (err, data) {
  if (err) {
    console.log(err);
  }
  else {
    console.log(data);
  }
})