var apiResponse={};
//apiResponse.APIKey ='test_APIKey';
if(apiResponse.APIKey){
    console.log(apiResponse.APIKey);
}
else{
    console.log('not found APIKey');
}
var str = {"name":"菜鸟教程", "site":"http://www.runoob.com"}
console.log(str.name);
str_pretty1 = JSON.stringify(str)
//console.log(str_pretty1.name);
console.log(typeof(str_pretty1))
filestr='sandbox-ohio_automations_1.0.0.md';
filestr='';
var env = (filestr.split("_"))[0];
console.log(env);
