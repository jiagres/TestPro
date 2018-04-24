'use strict';
let response = { "status": "success", "message": {} };

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


function addUser(appClientName, poolName, userName, secretsmanager, cognito, callback) {
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
                    ExcludePunctuation: true
                };
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

function deleteUser(poolName, userName, cognito, callback) {    
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
                    UserPoolId: poolId,  /* required */
                    Username: userName /* required */
                };
                cognito.adminDeleteUser(params, function (err, data) {
                    if (err) {
                        return callback(err, null); // an error occurred
                    }
                    else {
                        response.status='success';
                        response.message='user deleted successfully';
                        return callback(null, response);
                    }
                });
            }
        }
    });
};

exports.createUserPool = function (poolName, cognito, callback) {
    var params = {
        PoolName: poolName, /* required */
    };
    cognito.createUserPool(params, function (err, data) {
        if (err) {
            return callback(err, null); // an error occurred
        }
        else {
            response.status = "success";
            response.message = data;
            return callback(null, response); // successful response
        }
    });
};

exports.createPoolClient = function (appClientName, poolName, cognito, callback) {
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
                    ClientName: appClientName, /* required */
                    UserPoolId: poolId, /* required */
                    ExplicitAuthFlows: [
                        'ADMIN_NO_SRP_AUTH',
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

exports.createUser = function (appName, appClientName, poolName, secretsmanager, cognito, callback) {
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
                    UserPoolId: poolId, /* required */
                    Username: userName /* required */
                };
                cognito.adminGetUser(params, function (err, data) {
                    if (err) {
                        if (err.code == 'UserNotFoundException') {
                            addUser(appClientName, poolName, userName, secretsmanager, cognito, function (err, data) {
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
                        else {
                            console.log(err);
                            return callback(err, null);
                        }
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
                                userName = preUserName + (Math.max.apply(null, noList) + 1);
                                addUser(appClientName, poolName, userName, secretsmanager, cognito, function (err, data) {
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
                });
            }
        }
    })
};

exports.changePassword = function (appClientName, poolName, userName, cognito, secretsmanager, callback) {
    let result = { "username": "", "password": "" };
    deleteUser(poolName,userName,cognito,function(err,data){
        if(err){
            return callback(err,null);
        }
        else{
            addUser(appClientName, poolName, userName, secretsmanager, cognito, function (err, data) {
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

exports.disableUser = function (poolName, userName, cognito, callback) {
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
                    UserPoolId: poolId,  /* required */
                    Username: userName /* required */
                };
                cognito.adminDisableUser(params, function (err, data) {
                    if (err) {
                        return callback(err, null); // an error occurred
                    }
                    else {
                        console.log('User diable successfully.');
                        response.status='success';
                        response.message='user disable successfully';
                        return callback(null, response);
                    }
                });
            }
        }
    });
};

exports.enableUser = function (poolName, userName, cognito, callback) {
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
                    UserPoolId: poolId,  /* required */
                    Username: userName /* required */
                };
                cognito.adminEnableUser(params, function (err, data) {
                    if (err) {
                        return callback(err, null); // an error occurred
                    }
                    else {
                        return callback(null, data);
                    }
                });
            }
        };
    });
};

exports.deleteUser = function (poolName, userName, cognito, callback) {
    deleteUser(poolName, userName, cognito, callback);
};
