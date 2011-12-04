var oauthDouban = module.exports = {};


var keyInfo = {}
  , baseOptions = {
  		getRequestTokenURL: "http://www.douban.com/service/auth/request_token"
  	  , getAccessTokenURL: "http://www.douban.com/service/auth/access_token"	
  	}
  , customizedOptions = {
  		loginPath: "/login_douban"
    };

/**
 * Initialization with given key information of douban
 * 
 * @param {Object} keyInfo 
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
oauthDouban.init = function(keyInfo){
	if(!keyInfo){
		throw Error("No key information of douban!");
	}
	
	[
		"consumerKey"
	  , "consumerSecret"
	].forEach(function(keyEntry){
		keyInfo[keyEntry] = keyInfo[keyEntry];
	});
};

oauthDouban.middleware = function(opts){
	if(opts){
		customizedOptions.loginPath = opts.loginPath;
	}
	
	return function(req,res,next){
		
		console.log("goddyzhao");
		next();
	};
};

