shopify-node-api
================

OAuth2 Module for Shopify API

## Installation

### [Node.js](http://nodejs.org/):

```
npm install shopify-node-api
```

## Setup

~~~
var shopifyAPI = require('shopify-node-api');

var Shopify = new shopifyAPI({
                shop: 'MYSHOP', // MYSHOP.myshopify.com
                shopify_api_key: '', // Your API key
                shopify_shared_secret: '', // Your Shared Secret
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth'
            });

~~~

### CAUTION!!!

If no config object is passed into the module upon initialization, an error will be thrown!

~~~
var Shopify = new shopifyAPI(); // No config object passed in
~~~

will throw an error like:

~~~
> Error: ShopifyAPI module expects a config object
> Please see documentation at: https://github.com/sinechris/shopify-node-api
~~~

## Usage

~~~

// Building the authentication url

var auth_url = Shopify.buildAuthURL();

// Assuming you are using the express framework
// you can redirect the user automatically like so
res.redirect(auth_url);

~~~


## Exchanging the temporary token for a permanent one

After the user visits the authenticaion url they will be redirected to the location you specified in the configuration redirect_url parameter.

Shopify will send along some query parameters including: code (your temporary token), signature, shop and timestamp. This module will verify the authenticity of the request from shopify as outlined here in the [Shopify OAuth Docs](http://docs.shopify.com/api/tutorials/oauth)

~~~

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

~~~


## Making requests

This module supports GET, POST, PUT and DELETE rest verbs. Each request will return any errors, the data in JSON formation and any headers returned by the request.

An important header to take note of is **'http_x_shopify_shop_api_call_limit'**. This will let you know if you are getting close to reaching [Shopify's API call limit](http://docs.shopify.com/api/tutorials/learning-to-respect-the-api-call-limit).

### API limits

~~~
function callback(err, data, headers) {
  var api_limit = headers['http_x_shopify_shop_api_call_limit'];
  console.log( api_limit ); // "1/40"
}
~~~

### GET

~~~
Shopify.get('/admin/products.json', function(err, data, headers){
    console.log(data); // Data contains product json information
    console.log(headers); // Headers returned from request
});

~~~

### POST

~~~
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

Shopify.post('/admin/products/1234567.json', post_data, function(err, data, headers){
  console.log(data);
});
~~~

### PUT

~~~
var put_data = {
  "product": {
    "body_html": "<strong>Updated!</strong>"
  }
}

Shopify.put('/admin/products/1234567.json', put_data, function(err, data, headers){
  console.log(data);
});
~~~

### DELETE

~~~
Shopify.delete('/admin/products/1234567.json', function(err, data, headers){
    console.log(data);
});
~~~

## OPTIONS


### Verbose Mode

By default, shopify-node-api will automatically console.log all headers and responses. To suppress these messages, simply set verbose to false.

~~~
var config = {
  ...
  verbose: false
}
~~~


# Testing

~~~
npm test
~~~


# Contributing

Shopify has been kind enough to list this module on their [Official Documentation](http://docs.shopify.com/api/libraries/node). As such it is important that this module remain as bug free and up to date as possible in order to make the experience with node.js/Shopify as seamless as possible.

Sinelabs will continue to make updates as often as possible but we are more than happy to review any feature requests and will be accepting pull requests as well.
