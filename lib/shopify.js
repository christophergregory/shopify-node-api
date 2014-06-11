/**
 * Shopify OAuth2 node.js API
 *
 *
 *
 */

function ShopifyAPI(config) {

    if (typeof config === "undefined") {
        var msg = "ShopifyAPI module expects a config object\nPlease see documentation at: https://github.com/sinechris/shopify-node-api\n";
        throw new Error(msg);
    }

    var $this = this;

    $this.config = config;

    if ($this.config.verbose !== false) {
        $this.config.verbose = true;
    }

    function conditional_console_log(msg) {
        if ($this.config.verbose) {
            console.log( msg );
        }
    }

    $this.buildAuthURL = function() {
        var auth_url = 'https://' + $this.config.shop.split(".")[0];
        auth_url += ".myshopify.com/admin/oauth/authorize?";
        auth_url += "client_id=" + $this.config.shopify_api_key;
        auth_url += "&scope=" + $this.config.shopify_scope;
        auth_url += "&redirect_uri=" + $this.config.redirect_uri;
        return auth_url;
    };

    function is_valid_signature(params) {
        var md5 = require('MD5'),
            signature = params['signature'],
            calculated_signature = [];

        delete params['signature']; // Not needed to build hash

        for (var key in params){
            calculated_signature.push(key + '=' + params[key]);
        }

        var hash = md5($this.config.shopify_shared_secret + calculated_signature.sort().join(""));

        return (hash === signature) ? true : false;

    }

    $this.set_access_token = function(token) {
        $this.config.access_token = token;
    };

    $this.exchange_temporary_token = function(query_params, callback) {
        var data = {
            client_id: $this.config.shopify_api_key,
            client_secret: $this.config.shopify_shared_secret,
            code: query_params['code']
        };
        $this.makeRequest('/admin/oauth/access_token', 'POST', data, function(err, body){

            if (err) { callback(new Error(err)); }

            if (is_valid_signature(query_params)) {
                $this.set_access_token(body['access_token']);
                callback(null, body);
            } else {
                callback(new Error("Signature is not authentic!"));
            }

        });
    };

    $this.makeRequest = function(endpoint, method, data, callback) {

        var https = require('https'),
            dataString = JSON.stringify(data);

        var options = {
            hostname: $this.config.shop.split(".")[0] + '.myshopify.com',
            path: endpoint,
            method: method.toLowerCase() || 'get',
            port: 443,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': $this.config.access_token
            }
        };

        if (options.method === 'post' || options.method === 'put' || options.method === 'delete') {
            options.headers['Content-Length'] = dataString.length;
        }

        var request = https.request(options, function(response){
            conditional_console_log( 'STATUS: ' + response.statusCode );
            conditional_console_log( 'HEADERS: ' + JSON.stringify(response.headers) );

            if (response.headers.hasOwnProperty('http_x_shopify_shop_api_call_limit')) {
                console.log( response.headers['http_x_shopify_shop_api_call_limit'] );
            }

            response.setEncoding('utf8');

            var body = '';

            response.on('data', function(chunk){
                conditional_console_log( 'BODY: ' + chunk );
                body += chunk;
            });

            response.on('end', function(){
                try {
                    var json = JSON.parse(body);
                    callback(null, json, response.headers);
                } catch(e) {
                    callback(e);
                }
            });

        });

        request.on('error', function(e){
            callback(e);
        });

        if (options.method === 'post' || options.method === 'put' || options.method === 'delete') {
            request.write(JSON.stringify(data));
        }

        request.end();

    };

    $this.get = function(endpoint, data, callback) {
        if (typeof data === 'function' && arguments.length < 3) {
            callback = data;
            data = null;
        }
        $this.makeRequest(endpoint,'GET', data, callback);
    };

    $this.post = function(endpoint, data, callback) {
        $this.makeRequest(endpoint,'POST', data, callback);
    };

    $this.put = function(endpoint, data, callback) {
        $this.makeRequest(endpoint, 'PUT', data, callback);
    };

    $this.delete = function(endpoint, data, callback) {
        if (typeof data === 'function' && arguments.length < 3) {
            callback = data;
            data = null;
        }
        $this.makeRequest(endpoint, 'DELETE', data, callback);
    };

    return $this;

}

module.exports = ShopifyAPI;
