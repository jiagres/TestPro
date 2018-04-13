let config=require("./config.json");
for(var item in config.CustomerAttribute){
    console.log (item+":"+config.CustomerAttribute[item]);
    console.log()
}
//console.log(config.CustomerAttribute);
var num=parseInt(123);
console.log(typeof(num) && !isNaN(num));