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
    
  , doubanApiUrls = {
  		getUserInfo: "http://api.douban.com/people/%40me?alt=json"
    }
  
  , _helper = {}
  , _util = {}
  
  , isDebugMode = true;
    


/*public api*/
    
/**
 * Initialization with given key information of douban
 * 
 * Example:  
 * 	{
 *		consumerKey: 'You douban api key'
 *	  , consumerSecret: 'Your douban private key'
 *	}
 *
 * @param {Object} userKeyInfo 
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


/**
 * Douban oauth module middleware api
 * Mention: Should call oauthDouban.init() to register the key information first
 * 
 * Example:
 * 	
 *	app.use(oauthDouban.middleware());
 *  
 * @param {Object} opts specified options including login url and callback url.
 * @api public
 */
oauthDouban.middleware = function(opts){
	if(opts){
		customizedOptions.loginUrl = opts.loginUrl;
		customizedOptions.callbackUrl = opts.callbackUrl;
	}
	
	var self = this;
	
	return function(req,res,next){
		var parsedUrl = url.parse(req.url);
		if(customizedOptions.loginUrl === parsedUrl.pathname){
			_helper._login(req,res,next);
		}else if(customizedOptions.callbackUrl === parsedUrl.pathname){
			_helper._getAccessToken(req,res,next);
		}else{
			next();
		}
	};
};

/**
 * Get the login user information from douban
 * 
 * @param {Function} cb callback to handle the received user information
 * @api public
 */
oauthDouban.getUserInfo = function(cb){
	if(!tokenPair.token || !tokenPair.tokenSecret){
		throw Error("Get the user authrization first!");
	}
	var message = _util._constructMessage("GET", doubanApiUrls.getUserInfo, keyInfo.consumerKey, tokenPair.token);
	Step(
		function getDoubanUserInfo(){
			_helper._requestDouban(message,this);
		}
	  , function handleDoubanUserInfo(err, userInfo){
	  		_util.log("[getUserInfo] userInfo", userInfo);
	  		cb(err,JSON.parse(userInfo));
	    }
	);
};





/**
 * Request the access token used for requesting user's private data from douban
 * 
 * @param {Object} req req from connect 
 * @param {Object} res res from connect
 * @param {Object} next next from connect
 * @api private
 */
_helper._getAccessToken = function(req,res,next){
	var message = _util._constructMessage("GET", baseOptions.getAccessTokenURL, keyInfo.consumerKey, tokenPair.token);
	Step(
		function getToken(){
			_helper._requestDouban(message,this);
		}
	  , function handleToken(err, tokenInfo){
	  		_util.log("[handleRequestToken] tokenInfo: ", tokenInfo)
	  		var parsedTokenPair;
	  		if(-1 === tokenInfo.indexOf("oauth_token_secret")){
	  			throw Error("Getting token failed! Reason is: " + tokenInfo);
	  		}
	  		_util.log("[handleRequestToken] ", "get token successfully");
	  		
	  		parsedTokenPair = _util._parseTokenInfo(tokenInfo);
	  		tokenPair.token = parsedTokenPair.oauth_token;
	  		tokenPair.tokenSecret = parsedTokenPair.oauth_token_secret;
	  		
	  		_util.log("[handleRequestToken] tokenPair: ", tokenPair);
	  		
	  		//store the douban user id into session
	  		!!req.session && (req.session.doubanUser = {id: parsedTokenPair.douban_user_id}) 
	  		
	  		_util.log("got access token: tokenPair: ", tokenPair);
	  		next();
	    }
	);
};



/**
 * Request token then direct to the user authorization page
 * 
 * @param {Object} req req from connect
 * @param {Object} res res from connect
 * @param {Object} next next from connect
 * @api private
 */
_helper._login = function(req,res,next){
	var message = _util._constructMessage("GET" , baseOptions.getRequestTokenURL , keyInfo.consumerKey);
	
	Step(
		function getToken(){
			_helper._requestDouban(message,this);
		}
	  , function handleToken(err,tokenInfo){
	  		var parsedTokenPair;
	  		if(-1 === tokenInfo.indexOf("oauth_token_secret")){
	  			throw Error("Getting token failed! Reason is: " + tokenInfo);
	  		}
	  		_util.log("[handleRequestToken] ", "get token successfully");
	  		parsedTokenPair = _util._parseTokenInfo(tokenInfo);
	  		tokenPair.token = parsedTokenPair.oauth_token;
	  		tokenPair.tokenSecret = parsedTokenPair.oauth_token_secret;
	  		_util.log("[handleRequestToken] tokenPair: ", tokenPair);
	  		
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


/**
 * Request douban api
 *
 * @param {Object} message oauth needed message, usually constructed by \_helper.\_constructMessage
 * @param {Function} cb callback to handle received data
 * @api private
 */
_helper._requestDouban = function(message,cb){
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
		function requestInfo(){
			_util._request("GET",  parsedUrl.hostname, parsedUrl.pathname + parsedUrl.search, this);
		}
	  , function handleInfo(err,info){
	  		cb(err,info);
	    }
	);
	 
};



/**
 * Construct the message for the oauth lib to sign
 *
 * @param {String}  method the method of the request
 * @param {String} action the url of request
 * @param {String} consumerKey douban api key
 * @param {String} oauthToken oauth token got from douban
 * @return {Object}
 * @api private
 */
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


/**
 * A simple wrap for the basic http api in node.js
 *
 * @param {String} method  the method of the request
 * @param {String} host host of the request 
 * @param {String} path path of the request
 * @param {Function} callback callback to receive and handle the data
 * @api private
 */	
_util._request = function(method, host, path, callback){
	var params = Array.prototype.slice.call(arguments,0)
	  , paramsLength = params.length;
	  
	if(paramsLength < 4){ throw Error("More parameters are required to send a http request!"); }
	_util.log(params);
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
  


/**
 * Parse the tokenInfo from string to object
 * 
 * Example:
 * from _oauth_token=1111&oauth_token_secret=2222_ to _{token: 1111, tokenSecret: 2222}_
 * 
 * @param {String} tokenInfo the token information in the form of String
 * @return {Object}
 * @api private
 */  
_util._parseTokenInfo = function(tokenInfo){
	var gotTokenPair = tokenInfo.split("&")
	  , parsedTokenPair = {}
	  , kv;
	gotTokenPair.forEach(function(p){
		kv = p.split("=");
		parsedTokenPair[kv[0]] = kv[1];
	});
	return parsedTokenPair;
};

/**
 * A wrapper of console.log used to print logs in debug mode
 * 
 * @api private
 */
_util.log = function(){
	if(!isDebugMode){ return; }
	console.log(arguments);
};
