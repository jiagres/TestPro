'use strict'
var AWS = require('aws-sdk');
let proxy = require('proxy-agent')
AWS.config.httpOptions = {
    agent: proxy("http://proxy.houston.hp.com:8080")
  }
// Set the region 
let region = 'us-east-2'
console.log(region);
AWS.config.update({ region: region });
let ssm = new AWS.SSM();
let lambda = new AWS.Lambda();

let userList = ['anaApiUser', 'autApiUser', 'cfgApiUser', 'corApiUser', 'evtApiUser', 'infApiUser', 'ochApiUser', 'onbApiUser', 'xcdApiUser'];
let appList =['Intelligence Analytics','Automation','Configuration','Core Infrastructure','Event','Integration Framework','Orchestration','Onboarding','eXtensible Configuration Deployment Engine']

userList.forEach(function(name){
    resetSSMParamToEmpty(ssm, name, function(err,data){
        if(err){
            console.log('throw error during reset ssm parameter to empty, name as '+name);
            console.error(err);
        }
        else{
            console.log('reset ssm parameter empty successfully.'+name);
            console.log(data);
        }
    })
});

appList.forEach(function(name){
    cleanupUser(region,name,function(err,data){
        if(err){
            console.log('throw error during cleanup user for application'+ name);
            console.error(err);
        }
        else{
            console.log('remove user successfully.'+name);
            console.log(data);
        }
    })
});

function resetSSMParamToEmpty(ssm, paramName, callback) {
    var params = {
        Name: paramName, /* required */
        Type: 'SecureString', /* required */
        Value: 'empty', /* required */
        Overwrite: true
    };
    ssm.putParameter(params, function (err, data) {
        if (err) {
            return callback(err, null);
        }
        else {
            return callback(null, data);
        }
    });
}

function cleanupUser(region, appName, callback) {
    let payload = {
        "body": {
            "application": appName
        }
    };
    lambda.invoke({
        FunctionName: 'infUserDelete',
        Payload: JSON.stringify(payload)
    }, function (error, data) {
        if (error) {
            return callback(error);
        }
        else{
            return callback(null,data);
        }
    });

}

