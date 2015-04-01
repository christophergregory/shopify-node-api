/**
 * Shopify OAuth2 node.js API
 *
 *
 *
 */

var md5 = require('MD5');

function ShopifyAPI(config) {

    if (!(this instanceof ShopifyAPI)) return new ShopifyAPI(config);

    if (config == null) { // == checks for null and undefined
        var msg = "ShopifyAPI module expects a config object\nPlease see documentation at: https://github.com/sinechris/shopify-node-api\n";
        throw new Error(msg);
    }

    this.config = config;

    if (this.config.verbose !== false){
        this.config.verbose = true;
    }

}

ShopifyAPI.prototype.buildAuthURL = function(){
    var auth_url = 'https://' + this.config.shop.split(".")[0];
    auth_url += ".myshopify.com/admin/oauth/authorize?";
    auth_url += "client_id=" + this.config.shopify_api_key;
    auth_url += "&scope=" + this.config.shopify_scope;
    auth_url += "&redirect_uri=" + this.config.redirect_uri;
    return auth_url;
};

ShopifyAPI.prototype.set_access_token = function(token) {
    this.config.access_token = token;
};

ShopifyAPI.prototype.conditional_console_log = function(msg) {
    if (this.config.verbose) {
        console.log( msg );
    }
};

ShopifyAPI.prototype.is_valid_signature = function(params) {
    var signature = params['signature'],
        calculated_signature = [];

    for (var key in params){
        if (key != "signature"){ // signature must not be included in hash
            calculated_signature.push(key + '=' + params[key]);
        }
    }

    var hash = md5(this.config.shopify_shared_secret + calculated_signature.sort().join(""));

    return (hash === signature);
};

ShopifyAPI.prototype.exchange_temporary_token = function(query_params, callback) {
    var data = {
            client_id: this.config.shopify_api_key,
            client_secret: this.config.shopify_shared_secret,
            code: query_params['code']
        },
        self = this;

    if (!self.is_valid_signature(query_params)) {
        return callback(new Error("Signature is not authentic!"));
    }

    this.makeRequest('/admin/oauth/access_token', 'POST', data, function(err, body){

        if (err) return callback(new Error(err));

        self.set_access_token(body['access_token']);
        callback(null, body);

    });
};

ShopifyAPI.prototype.hostname = function () {
  return this.config.shop.split(".")[0] + '.myshopify.com';
};

ShopifyAPI.prototype.port = function () {
  return 443;
};

ShopifyAPI.prototype.makeRequest = function(endpoint, method, data, callback, retry) {

    var https = require('https'),
        dataString = JSON.stringify(data),
        options = {
            hostname: this.hostname(),
            path: endpoint,
            method: method.toLowerCase() || 'get',
            port: this.port(),
            headers: {
                'Content-Type': 'application/json'
            }
        },
        self = this;

    if (this.config.access_token) {
      options.headers['X-Shopify-Access-Token'] = this.config.access_token;
    }

    if (options.method === 'post' || options.method === 'put' || options.method === 'delete') {
        options.headers['Content-Length'] = new Buffer(dataString).length;
    }

    var request = https.request(options, function(response){
        self.conditional_console_log( 'STATUS: ' + response.statusCode );
        self.conditional_console_log( 'HEADERS: ' + JSON.stringify(response.headers) );

        if (response.headers && response.headers.http_x_shopify_shop_api_call_limit) {
            self.conditional_console_log( 'API_LIMIT: ' + response.headers.http_x_shopify_shop_api_call_limit);
        }

        response.setEncoding('utf8');

        var body = '';

        response.on('data', function(chunk){
            self.conditional_console_log( 'BODY: ' + chunk );
            body += chunk;
        });

        response.on('end', function(){

            var delay = 0;

            // If the request is being rate limited by Shopify, try again after a delay
            if (response.statusCode === 429) {
                return setTimeout(function() {
                    self.makeRequest(endpoint, method, data, callback);
                }, self.config.rate_limit_delay || 10000 );
            }

            // If the backoff limit is reached, add a delay before executing callback function
            if (response.statusCode === 200 && self.has_header(response, 'http_x_shopify_shop_api_call_limit')) {
                var api_limit = parseInt(response.headers['http_x_shopify_shop_api_call_limit'].split('/')[0], 10);
                if (api_limit >= (self.config.backoff || 35)) delay = self.config.backoff_delay || 1000; // in ms
            }

            setTimeout(function(){

                var   json = {}
                    , error;

                try {
                    if (body.trim() != '') { //on some requests, Shopify retuns an empty body (several spaces)
                        json = JSON.parse(body);
                        if (json.hasOwnProperty('error') || json.hasOwnProperty('errors')) {
                            error = {
                                  error : (json.error || json.errors)
                                , code  : response.statusCode
                            };
                        }
                    }
                } catch(e) {
                    error = e;
                }

                callback(error, json, response.headers);
            }, delay); // Delay the callback if we reached the backoff limit

        });

    });

    request.on('error', function(e){
        self.conditional_console_log( "Request Error: ", e );
        if(self.config.retry_errors && !retry){
            var delay = self.config.error_retry_delay || 10000;
            self.conditional_console_log( "retrying once in " + delay + " milliseconds" );
            setTimeout(function() {
                self.makeRequest(endpoint, method, data, callback, true);
            }, delay );
        } else{
            callback(e);
        }
    });

    if (options.method === 'post' || options.method === 'put' || options.method === 'delete') {
        request.write(dataString);
    }

    request.end();

};

ShopifyAPI.prototype.get = function(endpoint, data, callback) {
    if (typeof data === 'function' && arguments.length < 3) {
        callback = data;
        data = null;
    }
    this.makeRequest(endpoint,'GET', data, callback);
};

ShopifyAPI.prototype.post = function(endpoint, data, callback) {
    this.makeRequest(endpoint,'POST', data, callback);
};

ShopifyAPI.prototype.put = function(endpoint, data, callback) {
    this.makeRequest(endpoint, 'PUT', data, callback);
};

ShopifyAPI.prototype.delete = function(endpoint, data, callback) {
    if (arguments.length < 3) {
        if (typeof data === 'function') {
            callback = data;
            data = null;
        } else {
            callback = new Function;
            data = typeof data === 'undefined' ? null : data;
        }
    }
    this.makeRequest(endpoint, 'DELETE', data, callback);
};

ShopifyAPI.prototype.has_header = function(response, header) {
    return response.headers.hasOwnProperty(header) ? true : false;
};

module.exports = ShopifyAPI;
