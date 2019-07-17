/**
 * Shopify OAuth2 node.js API
 *
 *
 *
 */

var crypto = require('crypto');
var BigJSON = require('json-bigint');
var querystring = require('querystring');
var zlib = require('zlib');

function ShopifyAPI(config) {

    if (!(this instanceof ShopifyAPI)) return new ShopifyAPI(config);

    if (config == null) { // == checks for null and undefined
        var msg = "ShopifyAPI module expects a config object\nPlease see documentation at: https://github.com/sinechris/shopify-node-api\n";
        throw new Error(msg);
    }

    this.config = config;

    if(this.config.backoff_level){
        this.config.backoff_level = parseFloat(this.config.backoff_level);
    }

    if (this.config.verbose !== false){
        this.config.verbose = true;
    }

    // If any condition below is true assume the user does not want all logging
    if (this.config.verbose_status === true){
        this.config.verbose = false;
    }
    if (this.config.verbose_headers === true){
        this.config.verbose = false;
    }
    if (this.config.verbose_api_limit === true){
        this.config.verbose = false;
    }
    if (this.config.verbose_body === true){
        this.config.verbose = false;
    }
}

ShopifyAPI.prototype.buildAuthURL = function(){
    var auth_url = 'https://' + this.config.shop.split(".")[0];
    auth_url += ".myshopify.com/admin/oauth/authorize?";
    auth_url += "client_id=" + this.config.shopify_api_key;
    auth_url += "&scope=" + this.config.shopify_scope;
    auth_url += "&redirect_uri=" + this.config.redirect_uri;
    auth_url += "&state=" + this.config.nonce;
    return auth_url;
};

ShopifyAPI.prototype.set_access_token = function(token) {
    this.config.access_token = token;
};

ShopifyAPI.prototype.conditional_console_log = function(msg) {
    if (this.config.verbose) {
        console.log( msg );
    }
   // If any message type condition below is met show that message
   else {
       if (this.config.verbose_status === true && /^STATUS:/.test(msg) ){
           console.log( msg );
       }
       if (this.config.verbose_headers === true && /^HEADERS:/.test(msg)){
           console.log( msg );
       }
       if (this.config.verbose_api_limit === true && /^API_LIMIT:/.test(msg)){
           console.log( msg );
       }
       if (this.config.verbose_body === true && /^BODY:/.test(msg)){
           console.log( msg );
       }
   }
};

ShopifyAPI.prototype.is_valid_signature = function(params, non_state) {
    if(!non_state && this.config.nonce !== params['state']){
        return false;
    }

    var hmac = params['hmac'],
        theHash = params['hmac'] || params['signature'],
        secret = this.config.shopify_shared_secret,
        parameters = [],
        digest,
        message;

    for (var key in params) {
        if (key !== "hmac" && key !== "signature") {
            parameters.push(key + '=' + params[key]);
        }
    }

    message = parameters.sort().join(hmac ? '&' : '');

    digest = crypto
                .createHmac('SHA256', secret)
                .update(message)
                .digest('hex');

    return ( digest === theHash );
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

        if (err) {
          // err is either already an Error or it is a JSON object with an
          // error field.
          if (err.error) return callback(new Error(err.error));
          return callback(err);
        }

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
            agent: this.config.agent,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate'
            }
        },
        self = this;

    if (this.config.access_token) {
      options.headers['X-Shopify-Access-Token'] = this.config.access_token;
    }

    if (options.method === 'post' || options.method === 'put' || options.method === 'delete' || options.method === 'patch') {
        options.headers['Content-Length'] = new Buffer(dataString).length;
    }

    var request = https.request(options, function(response){
        self.conditional_console_log( 'STATUS: ' + response.statusCode );
        self.conditional_console_log( 'HEADERS: ' + JSON.stringify(response.headers) );

        if (response.headers && response.headers.http_x_shopify_shop_api_call_limit) {
            self.conditional_console_log( 'API_LIMIT: ' + response.headers.http_x_shopify_shop_api_call_limit);
        }

        var contentEncoding = response.headers['content-encoding'];
        var shouldUnzip = ['gzip', 'deflate'].indexOf(contentEncoding) !== -1;
        var encoding = shouldUnzip && 'binary' || 'utf8';
        var body = '';

        response.setEncoding(encoding);

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
            if ((response.statusCode >= 200 || response.statusCode <= 299) && self.has_header(response, 'http_x_shopify_shop_api_call_limit')) {
                var api_limit_parts = response.headers['http_x_shopify_shop_api_call_limit'].split('/');

                var api_limit = parseInt(api_limit_parts[0], 10);
                var api_max = parseInt(api_limit_parts[1], 10); // 40 on standard shopify accounts
                var limit_rate = false;
                if(self.config.backoff_level){
                    var used_api = api_limit / api_max;
                    limit_rate = (used_api > self.config.backoff_level);
                    self.conditional_console_log('FRACTION_USED: '+ used_api +' of '+ self.config.backoff_level);
                }else limit_rate = (api_limit >= (self.config.backoff || 35));

                if(limit_rate){
                    self.conditional_console_log('RATE DELAY: '+ api_limit +' of '+ api_max);
                    delay = self.config.backoff_delay || 1000; // in ms
                } 
            }

            setTimeout(function(){

                var   json = {}
                    , error;

                function parseResponse(body) {
                try {
                    if (body.trim() != '') { //on some requests, Shopify retuns an empty body (several spaces)
                        json = BigJSON.parse(body);
                    }
                } catch(e) {
                    error = e;
                }

                if (response.statusCode >= 400) {
                    if (json && (json.hasOwnProperty('error_description') || json.hasOwnProperty('error') || json.hasOwnProperty('errors'))) {
                        var jsonError = (json.error_description || json.error || json.errors);
                    }
                    error = {
                        code: response.statusCode
                      , error: jsonError || response.statusMessage
                    };
                }

                  return callback(error, json, response.headers, options);
                }

                // Use GZIP decompression if required
                if (shouldUnzip) {
                  var unzip = contentEncoding === 'deflate' && zlib.deflate || zlib.gunzip;
                  return unzip(new Buffer(body, 'binary'), function(err, data) {
                    if (err) {
                      return callback(err, null, response.headers, options);
                    }
                    return parseResponse(data.toString('utf8'));
                  });
                }

                return parseResponse(body);
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

    if (options.method === 'post' || options.method === 'put' || options.method === 'delete' || options.method === 'patch') {
        request.write(dataString);
    }

    request.end();

};

ShopifyAPI.prototype.get = function(endpoint, data, callback) {
    if (typeof data === 'function' && arguments.length < 3) {
        callback = data;
        data = null;
    } else {
        if(data){
            endpoint += ((endpoint.indexOf('?') == -1) ? '?' : '&') + querystring.stringify(data);
        }
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

ShopifyAPI.prototype.patch = function(endpoint, data, callback) {
    this.makeRequest(endpoint, 'PATCH', data, callback);
};

ShopifyAPI.prototype.has_header = function(response, header) {
    return response.headers.hasOwnProperty(header) ? true : false;
};

ShopifyAPI.prototype.graphql = function(data, callback) {
  this.makeRequest('/admin/api/graphql.json','POST', data, callback);
};

module.exports = ShopifyAPI;
