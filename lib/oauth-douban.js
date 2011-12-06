var url = require("url")
  , http = require("http")
  , OAuth = require("./oauth").OAuth;

var oauthDouban = module.exports = {};


var keyInfo = {}
  , baseOptions = {
  		getRequestTokenURL: "http://www.douban.com/service/auth/request_token"
  	  , getAccessTokenURL: "http://www.douban.com/service/auth/access_token"	
  	}
  , customizedOptions = {
  		loginUrl: "/login_douban"
  	  , callbackUrl: "/login_douban_callback"
    };
    
/**
 * Initialization with given key information of douban
 * 
 * @param {Object} userKeyInfo 
 * 
 * Example:  
 * 	{
 *		consumerKey: 'You douban api key'
 *	  , consumerSecret: 'Your douban private key'
 *	}
 * 
 * @return {Object} return the oauthDouban self
 * 
 *
 */
oauthDouban.init = function(userKeyInfo){
	if(!keyInfo){
		throw Error("No key information of douban!");
	}
	
	[
		"consumerKey"
	  , "consumerSecret"
	].forEach(function(keyEntry){
		keyInfo[keyEntry] = userKeyInfo[keyEntry];
	});
};

oauthDouban.middleware = function(opts){
	if(opts){
		customizedOptions.loginUrl = opts.loginUrl;
		customizedOptions.callbackUrl = opts.callbackUrl;
	}
	
	var self = this;
	
	return function(req,res,next){
		var parsedUrl = url.parse(req.url);
		console.log("loginURL: ", customizedOptions.loginUrl);
		console.log("pathname: ", parsedUrl.pathname);
		if(customizedOptions.loginUrl === parsedUrl.pathname){
			console.log("enter");
			self._login(req,res,next);
		}else if(customizedOptions.callbackUrl === parsedUrl.pathname){
			
		}else{
			console.log("enter 2");
			next();
		}
	};
};

oauthDouban._login = function(req,res,next){
	var _util = this._util
	  , message = _util._constructMessage("GET" , baseOptions.getRequestTokenURL , keyInfo.consumerKey);
	
	OAuth.setTimestampAndNonce(message);
	OAuth.SignatureMethod.sign(message,{
		consumerSecret: keyInfo.consumerSecret
	});
	
	var parsedURL = url.parse(OAuth.addToURL(message.action, message.parameters));
	_util._request("GET",  parsedURL.hostname, parsedURL.pathname + parsedURL.search, function(result){
		//TODO: do something after getting the request token
		console.log("[login] callback: ", result);
	});
	
};

oauthDouban._util = {
	_constructMessage: function(method, action, consumerKey, oauthToken){
		var params = Array.prototype.slice.call(arguments,0);
		if(params.length < 3){ throw Error("More parameters are required to construct the message!")}
		var message = {
			method: params[0]
		  , action: params[1]
		  , parameters: {
		  		oauth_consumer_key: params[2]
		  	  , oauth_signature_method: "HMAC-SHA1"
		  	  , oauth_signature: ""
		  	  , oauth_timestamp: ""
		  	  , oauth_nonce: ""
		  }
		};
		
		params[3] && (message.oauth_token = params[3]);
		
		return message;
	}
	
  , _request: function(method, host, path, callback){
  		var params = Array.prototype.slice.call(arguments,0)
  		  , paramsLength = params.length;
  		  
  		if(paramsLength < 4){ throw Error("More parameters are required to send a http request!"); }
  		console.log(params);
  		http.request({
  		    method: params[0]
  		  , host: params[1]
  		  , path: params[2]
  		  , port: 80
  		}, function(res){
  			res.setEncoding("utf8");
  			console.log(22);
  			var result = ""; 
  			res.on("data", function(chunk){
  				result += chunk;
  			});
  			
  			res.on("end", function(){
  				params[paramsLength-1](result);
  			});
  		}).end();
  	}
};
