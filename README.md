shopify-node-api [![Build Status](https://travis-ci.org/christophergregory/shopify-node-api.svg?branch=master)](https://travis-ci.org/christophergregory/shopify-node-api)
================

OAuth2 Module for Shopify API

[![NPM](https://nodei.co/npm/shopify-node-api.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/shopify-node-api/)

## Install
```
npm install -S shopify-node-api
```

## Configure Public App

Public apps are apps intended to appear in the [Shopify App Store](https://apps.shopify.com?ref=grenadeapps) and require OAuth2 to access shop data.

```js
var shopifyAPI = require('shopify-node-api');


var Shopify = new shopifyAPI({
  shop: 'MYSHOP', // MYSHOP.myshopify.com
  shopify_api_key: '', // Your API key
  shopify_shared_secret: '', // Your Shared Secret
  shopify_scope: 'write_products',
  redirect_uri: 'http://localhost:3000/finish_auth',
  nonce: '' // you must provide a randomly selected value unique for each authorization request
});

```


## Configure Private App

Private apps are created for a single shop and do not appear in the shopify app store. [More info here.](https://docs.shopify.com/api/guides/introduction/creating-a-private-app)

```js
var shopifyAPI = require('shopify-node-api');


var Shopify = new shopifyAPI({
  shop: 'MYSHOP', // MYSHOP.myshopify.com
  shopify_api_key: '', // Your API key
  access_token: '' // Your API password
});
```

Note: If you are building a [private Shopify app](https://docs.shopify.com/api/authentication/creating-a-private-app?ref=grenadeapps), then you don't need to go through the OAuth authentication process. You can skip ahead to the Making Requests section.


### CAUTION!!!

If no config object is passed into the module upon initialization, an error will be thrown!
```js
var Shopify = new shopifyAPI(); // No config object passed in
```

will throw an error like:

~~~
> Error: ShopifyAPI module expects a config object
> Please see documentation at: https://github.com/sinechris/shopify-node-api
~~~

## Usage

```js

// Building the authentication url

var auth_url = Shopify.buildAuthURL();

// Assuming you are using the express framework
// you can redirect the user automatically like so
res.redirect(auth_url);
```


## Exchanging the temporary token for a permanent one

After the user visits the authenticaion url they will be redirected to the location you specified in the configuration redirect_url parameter.

Shopify will send along some query parameters including: code (your temporary token), signature, shop, state and timestamp. This module will verify the authenticity of the request from shopify as outlined here in the [Shopify OAuth Docs](http://docs.shopify.com/api/tutorials/oauth?ref=grenadeapps)

```js

// Again assuming you are using the express framework

app.get('/finish_auth', function(req, res){

  var Shopify = new shopifyAPI(config), // You need to pass in your config here
    query_params = req.query;

  Shopify.exchange_temporary_token(query_params, function(err, data){
    // This will return successful if the request was authentic from Shopify
    // Otherwise err will be non-null.
    // The module will automatically update your config with the new access token
    // It is also available here as data['access_token']
  });

});

```

### Note:

Once you have initially received your access token you can instantiate a new instance at a later date like so:

```js
var Shopify = new shopifyAPI({
  shop: 'MYSHOP', // MYSHOP.myshopify.com
  shopify_api_key: '', // Your API key
  shopify_shared_secret: '', // Your Shared Secret
  access_token: 'token', //permanent token
});

```



## Making requests

This module supports GET, POST, PUT and DELETE rest verbs. Each request will return any errors, the data in JSON formation and any headers returned by the request.

An important header to take note of is **'http_x_shopify_shop_api_call_limit'**. This will let you know if you are getting close to reaching [Shopify's API call limit](http://docs.shopify.com/api/tutorials/learning-to-respect-the-api-call-limit).

### API limits

```js
function callback(err, data, headers) {
  var api_limit = headers['http_x_shopify_shop_api_call_limit'];
  console.log( api_limit ); // "1/40"
}
```

### GET

```js
Shopify.get('/admin/products.json', query_data, function(err, data, headers){
  console.log(data); // Data contains product json information
  console.log(headers); // Headers returned from request
});
```
The argument `query_data` is optional. If included it will be converted to a querystring and appended to the uri.

### POST

```js
var post_data = {
  "product": {
    "title": "Burton Custom Freestlye 151",
    "body_html": "<strong>Good snowboard!</strong>",
    "vendor": "Burton",
    "product_type": "Snowboard",
    "variants": [
      {
        "option1": "First",
        "price": "10.00",
        "sku": 123
      },
      {
        "option1": "Second",
        "price": "20.00",
        "sku": "123"
      }
    ]
  }
}

Shopify.post('/admin/products.json', post_data, function(err, data, headers){
  console.log(data);
});
```

### PUT

```js
var put_data = {
  "product": {
    "body_html": "<strong>Updated!</strong>"
  }
}

Shopify.put('/admin/products/1234567.json', put_data, function(err, data, headers){
  console.log(data);
});
```

### DELETE

```js
Shopify.delete('/admin/products/1234567.json', function(err, data, headers){
  console.log(data);
});
```

## Errors

Every response from Shopify's API is parsed and checked if it looks like an error. Three keys are used to determine an error response: 'error_description', 'error', and 'errors'. If any of these keys are found in the response, an error object will be made with the first found key's value as the error message and the response's status code as the error's code. This error object will be passed as the first parameter in the callback, along with the response JSON and response headers.

If an error occurs while making a request, the callback will be passed an error object provided from `https` as the only parameter.

## OPTIONS


### Verbose Mode

By default, shopify-node-api will automatically console.log all headers and responses. To suppress these messages, simply set verbose to false.

```js
var config = {
  ...
  verbose: false
}
```

##### Additional Verbose Options

If only a particular message type(s) is desired it may be specifically requested
to override the standard verbose console logging.

Available logging options:
    * verbose_status
    * verbose_headers
    * verbose_api_limit
    * verbose_body

```js
var config = {
  ...
  verbose_headers: true,
  verbose_api_limit: true
}
```

The above config results in only messages beginning as type __HEADER:__ and
__API_LIMIT:__ to be logged.

This is a more ideal use case for a production server, where excessive
body content logging may obstruct developers from isolating meaningful server
data.

### Verify Shopify Request

**Note**: *This module has been updated to use HMAC parameter instead of the deprecated "signature"*.

From the [shopify docs](http://docs.shopify.com/api/tutorials/oauth?ref=grenadeapps):

"Every request or redirect from Shopify to the client server includes a signature and hmac parameters that can be used to ensure that it came from Shopify. **The signature attribute is deprecated due to vulnerabilities in how the signature is generated.**"

The module utilizes the *is_valid_signature* function to verify that requests coming from shopify are authentic. You can use this method in your code to verify requests from Shopify. Here is an example of its use in the this module:

```js
ShopifyAPI.prototype.exchange_temporary_token = function(query_params, callback) {

  // Return an error if signature is not valid
  if (!self.is_valid_signature(query_params)) {
    return callback(new Error("Signature is not authentic!"));
  }

  // do more things...
}
```

You can call it from an initialized Shopify object like so

```js
Shopify.is_valid_signature(query_params);
```

To verify a Shopify signature that does not contain a state parameter, just pass true as the second argument of `is_valid_signature`:

```js
Shopify.is_valid_signature(query_params, true);
```
*This is required when checking a non-authorization query string, for example the query string passed when the app is clicked in the user's app store*

### API Call Limit Options

By default, shopify-node-api will automatically wait if you approach Shopify's API call limit. The default setting for backoff delay time is 1 second if you reach 35 out of 40 calls. If you hit the limit, Shopify will return a 429 error, and by default, this module will have a rate limit delay time of 10 seconds. You can modify these options using the following parameters:

```js
var config = {
  //...
  rate_limit_delay: 10000, // 10 seconds (in ms) => if Shopify returns 429 response code
  backoff: 35, // limit X of 40 API calls => default is 35 of 40 API calls
  backoff_delay: 1000 // 1 second (in ms) => wait 1 second if backoff option is exceeded
}
```

Alternatively if you are working on a Shopify Plus or Gold project or if you get increased API limits from your Shopify rep you can use 'backoff_level' to specify at what fraction of bucket capacity your app should start backing off.

```js
var config = {
  //...
  rate_limit_delay: 10000, // 10 seconds (in ms) => if Shopify returns 429 response code
  backoff_level: 0.85, // limit X/bucket size API calls => no default since 'backoff' is the default behaviour
  backoff_delay: 1000 // 1 second (in ms) => wait 1 second if backoff option is exceeded
}
```
# Become a Shopify App Developer

[Join the Shopify Partner Program](https://app.shopify.com/services/partners/signup?ref=grenadeapps)

# Testing

~~~
npm install
npm test
~~~


# Contributing

Shopify has been kind enough to list this module on their [Official Documentation](http://docs.shopify.com/api/libraries/node?ref=grenadeapps). As such it is important that this module remain as bug free and up to date as possible in order to make the experience with node.js/Shopify as seamless as possible.

I will continue to make updates as often as possible but we are more than happy to review any feature requests and will be accepting pull requests as well.
