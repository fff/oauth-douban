var url = require("url")
  , http = require("http")
  , Step = require("step")
  , OAuth = require("./oauth").OAuth;

var oauthDouban = module.exports = {};


var keyInfo = {}
  , tokenPair = {}
  , baseOptions = {
  		getRequestTokenURL: "http://www.douban.com/service/auth/request_token"
  	  , getUserAuthorizationURL: "http://www.douban.com/service/auth/authorize" 
  	  , getAccessTokenURL: "http://www.douban.com/service/auth/access_token"	
  	}
  , customizedOptions = {
  		loginUrl: "/login_douban"
  	  , callbackUrl: "/login_douban_callback"
    }
  
  , _helper = {}
  , _util = {};
    


/*public api*/
    
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
			_helper._login(req,res,next);
		}else if(customizedOptions.callbackUrl === parsedUrl.pathname){
			_helper._getAccessToken(req,res,next);
		}else{
			console.log("enter 2");
			next();
		}
	};
};

oauthDouban.getUserInfo = function(){
	_helper._getAccessToken();
};

/*private*/
_helper._getAccessToken = function(req,res,next){
	var message = _util._constructMessage("GET", baseOptions.getAccessTokenURL, keyInfo.consumerKey, tokenPair.token);
	Step(
		function getToken(){
			_helper._getToken(message,this);
		}
	  , function handleToken(err){
	  		console.log("got access token: tokenPair: ", tokenPair);
	  		next();
	    }
	);
};


_helper._login = function(req,res,next){
	var message = _util._constructMessage("GET" , baseOptions.getRequestTokenURL , keyInfo.consumerKey);
	
	Step(
		function getToken(){
			_helper._getToken(message,this);
		}
	  , function handleToken(err){
	  		//redirect to the user authorization page
	  		res.redirect(
	  					  [
	  					  	, baseOptions.getUserAuthorizationURL
 	  					    , "?oauth_callback=http://"
 	  					    , req.headers.host
	  					    , customizedOptions.callbackUrl
	  					    , "&oauth_token="
	  					    , tokenPair.token
	  					    
	  					  ].join("")
	  					);
	  	}
		
	);
};

_helper._getToken = function(message,cb){
	var params = Array.prototype.slice.call(arguments,0)
	  , signSecret;
	if( params.length < 2){
		throw Error("More parameters are required to get token!");
	}
	
	//Sign
	OAuth.setTimestampAndNonce(message);
	signSecret = {
		consumerSecret: keyInfo.consumerSecret
	};
	tokenPair.tokenSecret && (signSecret.tokenSecret = tokenPair.tokenSecret);
	OAuth.SignatureMethod.sign(message,signSecret);
	
	var parsedUrl = url.parse(OAuth.addToURL(message.action, message.parameters));
	Step(
		function requestToken(){
			_util._request("GET",  parsedUrl.hostname, parsedUrl.pathname + parsedUrl.search, this);
		}
	  , function handleToken(err,tokenInfo){
	  		var parsedTokenPair;
	  		if(-1 === tokenInfo.indexOf("oauth_token_secret")){
	  			throw Error("Getting token failed! Reason is: " + tokenInfo);
	  		}
	  		console.log("[handleRequestToken] ", "get token successfully");
	  		parsedTokenPair = _util._parseTokenInfo(tokenInfo);
	  		tokenPair.token = parsedTokenPair.oauth_token;
	  		tokenPair.tokenSecret = parsedTokenPair.oauth_token_secret;
	  		console.log("[handleRequestToken] tokenPair: ", tokenPair);
	  		
	  		cb();
	    }
	);
	 
};




_util._constructMessage = function(method, action, consumerKey, oauthToken){
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
	
	params[3] && (message.parameters.oauth_token = params[3]);
	
	return message;
};
	
_util._request = function(method, host, path, callback){
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
		var result = ""; 
		res.on("data", function(chunk){
			result += chunk;
		});
		
		res.on("end", function(){
			params[paramsLength-1](null,result);
		});
	}).end();
};
  
_util._parseTokenInfo = function(/*String*/tokenInfo){
	var gotTokenPair = tokenInfo.split("&")
	  , parsedTokenPair = {}
	  , kv;
	gotTokenPair.forEach(function(p){
		kv = p.split("=");
		parsedTokenPair[kv[0]] = kv[1];
	});
	return parsedTokenPair;
};
