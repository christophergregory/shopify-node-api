var should = require('chai').should(),
    expect = require('chai').expect,
    nock = require('nock'),
    shopifyAPI = require('../lib/shopify.js'),
    zlib = require('zlib');

describe('Constructor Function: #shopifyAPI', function(){

    it('throws error if no config object is passed in', function(){
        var msg = "ShopifyAPI module expects a config object\nPlease see documentation at: https://github.com/sinechris/shopify-node-api\n";
        expect(function(){
            var Shopify = new shopifyAPI();
        }).to.throw(msg);
    });

    it('returns instanceof shopifyAPI with "new" keyword', function(){
        var Shopify = new shopifyAPI({});
        expect(Shopify).to.be.a.instanceof(shopifyAPI);
    });

    it('returns instanceof shopifyAPI without "new" keyword', function(){
        var Shopify = shopifyAPI({});
        expect(Shopify).to.be.a.instanceof(shopifyAPI);
    });

});

describe('#buildAuthURL', function(){

    var Shopify = new shopifyAPI({
                shop: 'MYSHOP',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'asdf1234',
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth',
                nonce: 'abc123'
            });


    it('builds correct string', function(){
        var auth_url = Shopify.buildAuthURL(),
            correct_auth_url = 'https://MYSHOP.myshopify.com/admin/oauth/authorize?client_id=abc123&scope=write_products&redirect_uri=http://localhost:3000/finish_auth&state=abc123';
        auth_url.should.equal(correct_auth_url);
    });

});

describe('#set_access_token', function(){
    var Shopify = new shopifyAPI({});

    it('should not have access_token property initially', function(){
        Shopify.config.should.not.have.property('access_token');
    });

    it('should add correct access token to config object', function(){
        Shopify.config.should.not.have.property('access_token');
        var fake_token = '123456789';
        Shopify.set_access_token(fake_token);
        Shopify
            .config
            .should
            .have
            .property('access_token')
            .with
            .length(fake_token.length);
        Shopify
            .config
            .access_token
            .should
            .equal(fake_token);
    });

});

describe('#is_valid_signature', function(){
    it('should return correct signature', function(){

        // Values used below were pre-calculated and not part
        // of an actual shop.

        var Shopify = shopifyAPI({
                shopify_shared_secret: 'hush',
                nonce: 'abc123'
            }),
            params = {
                'shop': 'some-shop.myshopify.com',
                'code': 'a94a110d86d2452eb3e2af4cfb8a3828',
                'timestamp': '1337178173',
                'signature': '6e39a2ea9e497af6cb806720da1f1bf3',
                'hmac': '62c96e47cdef32a33c6fa78d761e049b3578b8fc115188a9ffcd774937ab7c78',
                'state': 'abc123'
            };

        expect(Shopify.is_valid_signature(params)).to.equal(true);
    });

    it('should ignore the state/nonce when non_state is true', function(){

        // Values used below were pre-calculated and not part
        // of an actual shop.

        var Shopify = shopifyAPI({
                shopify_shared_secret: 'hush',
            }),
            params = {
                'shop': 'some-shop.myshopify.com',
                'code': 'a94a110d86d2452eb3e2af4cfb8a3828',
                'timestamp': '1337178173',
                'signature': '6e39a2ea9e497af6cb806720da1f1bf3',
                'hmac': '2cb1a277650a659f1b11e92a4a64275b128e037f2c3390e3c8fd2d8721dac9e2',
            };

        expect(Shopify.is_valid_signature(params, true)).to.equal(true);
    });
});

describe('#exchange_temporary_token', function(){
    it('should exchange a temporary token', function(done){

        // Values used below were pre-calculated and not part
        // of an actual shop.

        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'hush',
                verbose: false,
                nonce: 'abc123'
            }),
            params = {
                'shop': 'some-shop.myshopify.com',
                'code': 'a94a110d86d2452eb3e2af4cfb8a3828',
                'timestamp': '1337178173',
                'signature': '6e39a2ea9e497af6cb806720da1f1bf3',
                'hmac': '62c96e47cdef32a33c6fa78d761e049b3578b8fc115188a9ffcd774937ab7c78',
                'state': 'abc123'
            };

        var shopifyTokenFetch = nock('https://myshop.myshopify.com')
            .post('/admin/oauth/access_token')
            .reply(200, {
                "access_token": "abcd"
            });

        Shopify.exchange_temporary_token(params, function(err, res) {
          if (err) {
            return done(err);
          }
          shopifyTokenFetch.done();
          done();
        });
    });

    it('should return an error object with a legible message', function(done) {
        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'hush',
                verbose: false,
                nonce: 'abc123'
            }),
            params = {
                'shop': 'some-shop.myshopify.com',
                'code': 'a94a110d86d2452eb3e2af4cfb8a3828',
                'timestamp': '1337178173',
                'signature': '6e39a2ea9e497af6cb806720da1f1bf3',
                'hmac': '62c96e47cdef32a33c6fa78d761e049b3578b8fc115188a9ffcd774937ab7c78',
                'state': 'abc123'
            };

        // Shopify will return an invalid request in some cases, e.g. if a code
        // is not valid for exchanging to a permanent token.
        var shopifyTokenFetch = nock('https://myshop.myshopify.com')
            .post('/admin/oauth/access_token')
            .reply(400, {
                error: "invalid_request"
            });

        Shopify.exchange_temporary_token(params, function(err, res) {
          shopifyTokenFetch.done();
          expect(err).to.be.instanceof(Error);
          expect(err.message).to.equal("invalid_request");
          done();
        });
    });
});

describe('#get', function(){
   it('should return correct response', function(done){

        var shopify_get = nock('https://myshop.myshopify.com')
                            .get('/admin/products/count.json')
                            .reply(200, {
                                "count": 2
                            });

        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'asdf1234',
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth',
                verbose: false
            });

        Shopify.get('/admin/products/count.json', function(err, data, headers){
            expect(data).to.deep.equal({"count": 2});
            done();
        });

   });

   it('should parse a gzip response', function(done){
        var buf = new Buffer(JSON.stringify({ count: 2 }));
        zlib.gzip(buf, function(err, res) {
          if (err) {
            return done(err);
          }
          var shopify_get = nock('https://myshop.myshopify.com')
            .get('/admin/products/count.json')
            .reply(200, res, {
              'X-Transfer-Length': String(res.length),
              'Content-Length': undefined,
              'Content-Encoding': 'gzip',
              'Content-Type': 'application/json'
            });
  
          var Shopify = shopifyAPI({
              shop: 'myshop',
              shopify_api_key: 'abc123',
              shopify_shared_secret: 'asdf1234',
              shopify_scope: 'write_products',
              redirect_uri: 'http://localhost:3000/finish_auth',
              verbose: false
          });
  
          Shopify.get('/admin/products/count.json', function(err, data, headers){
              expect(data).to.deep.equal({"count": 2});
              done();
          });
        });
   });

   it('should parse a number too large for javascript into a string', function(done) {
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/admin/orders.json')
                         .reply(200, '{"id": 9223372036854775807}');

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false
     });


     Shopify.get('/admin/orders.json', function(err, data, headers){
       expect(data.id.toString()).to.equal('9223372036854775807');
       done();
     });
   });

   it('should accept an agent for https', function(done) {
     var Agent = require('https').Agent;
     var agent = new Agent({
       keepAlive: true,
       keepAliveMsecs: 1000 * 10,
       maxSockets: 10,
       maxFreeSockets: 10
     });
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/admin/orders.json')
                         .reply(200, '{"id": 1}');

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false,
       agent: agent
     });

     Shopify.get('/admin/orders.json', function(err, data, headers, opts) {
       expect(err).to.not.exist();
       expect(opts.agent).to.equal(agent);
       return done();
     });
   });

   it('should parse data argument into a querystring and append it to endpoint', function(done) {
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/admin/products.json')
                         .query(true)
                         .reply(200, function(uri, reqBody) {
                           return {uri: uri};
                         });

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false
     });


     Shopify.get('/admin/products.json', {page: 2, limit: 15}, function(err, data, headers){
       expect(data.uri).to.equal('/admin/products.json?page=2&limit=15');
       done();
     });
   });

   it('should use error_description when available', function(done) {
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/')
                         .reply(400, function(uri, reqBody) {
                           return {'error':'abc','error_description':'xyz'};
                         });

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false
     });

     Shopify.get('/', function(err, data, headers){
       expect(err).to.deep.equal({ error: 'xyz', code: 400 });
       done();
     });
   });

   it('should use error when error_description is not available', function(done) {
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/')
                         .reply(400, function(uri, reqBody) {
                           return {'error':'abc'};
                         });

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false
     });

     Shopify.get('/', function(err, data, headers){
       expect(err).to.deep.equal({ error: 'abc', code: 400 });
       done();
     });
   });

   it('should use errors when error_description and error is not available', function(done) {
     var shopify_get = nock('https://myshop.myshopify.com')
                         .get('/')
                         .reply(400, function(uri, reqBody) {
                           return {'errors':'abc'};
                         });

     var Shopify = shopifyAPI({
       shop: 'myshop',
       shopify_api_key: 'abc123',
       shopify_shared_secret: 'asdf1234',
       shopify_scope: 'write_products',
       redirect_uri: 'http://localhost:3000/finish_auth',
       verbose: false
     });

     Shopify.get('/', function(err, data, headers){
       expect(err).to.deep.equal({ error: 'abc', code: 400 });
       done();
     });
   });
});

describe('#post', function(){
    it('should return correct response', function(done){

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
            },
            response = {
              "product": {
                "body_html": "<strong>Good snowboard!</strong>",
                "created_at": "2014-05-23T14:18:12-04:00",
                "handle": "burton-custom-freestlye-151",
                "id": 1071559674,
                "product_type": "Snowboard",
                "published_at": "2014-05-23T14:18:12-04:00",
                "published_scope": "global",
                "template_suffix": null,
                "title": "Burton Custom Freestlye 151",
                "updated_at": "2014-05-23T14:18:12-04:00",
                "vendor": "Burton",
                "tags": "",
                "variants": [
                  {
                    "barcode": null,
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:18:12-04:00",
                    "fulfillment_service": "manual",
                    "grams": 0,
                    "id": 1044399349,
                    "inventory_management": null,
                    "inventory_policy": "deny",
                    "option1": "First",
                    "option2": null,
                    "option3": null,
                    "position": 1,
                    "price": "10.00",
                    "product_id": 1071559674,
                    "requires_shipping": true,
                    "sku": "123",
                    "taxable": true,
                    "title": "First",
                    "updated_at": "2014-05-23T14:18:12-04:00",
                    "inventory_quantity": 1,
                    "old_inventory_quantity": 1
                  },
                  {
                    "barcode": null,
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:18:12-04:00",
                    "fulfillment_service": "manual",
                    "grams": 0,
                    "id": 1044399350,
                    "inventory_management": null,
                    "inventory_policy": "deny",
                    "option1": "Second",
                    "option2": null,
                    "option3": null,
                    "position": 2,
                    "price": "20.00",
                    "product_id": 1071559674,
                    "requires_shipping": true,
                    "sku": "123",
                    "taxable": true,
                    "title": "Second",
                    "updated_at": "2014-05-23T14:18:12-04:00",
                    "inventory_quantity": 1,
                    "old_inventory_quantity": 1
                  }
                ],
                "options": [
                  {
                    "id": 1020890454,
                    "name": "Title",
                    "position": 1,
                    "product_id": 1071559674
                  }
                ],
                "images": [

                ]
              }
            };

        var shopify_get = nock('https://myshop.myshopify.com')
                            .post('/admin/products.json')
                            .reply(200, response);

        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'asdf1234',
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth',
                verbose: false
            });

        Shopify.post('/admin/products.json', post_data, function(err, data, headers){
            expect(data).to.deep.equal(response);
            done();
        });

    });
});

describe('#put', function(){
    it('should return correct response', function(done){

        var put_data = {
              "product": {
                "id": 632910392,
                "title": "New product title"
              }
            },
            response = {
              "product": {
                "body_html": "<p>It's the small iPod with one very big idea: Video. Now the world's most popular music player, available in 4GB and 8GB models, lets you enjoy TV shows, movies, video podcasts, and more. The larger, brighter display means amazing picture quality. In six eye-catching colors, iPod nano is stunning all around. And with models starting at just $149, little speaks volumes.</p>",
                "created_at": "2014-05-23T14:17:55-04:00",
                "handle": "ipod-nano",
                "id": 632910392,
                "product_type": "Cult Products",
                "published_at": "2007-12-31T19:00:00-05:00",
                "published_scope": "global",
                "template_suffix": null,
                "title": "New product title",
                "updated_at": "2014-05-23T14:18:15-04:00",
                "vendor": "Apple",
                "tags": "Emotive, Flash Memory, MP3, Music",
                "variants": [
                  {
                    "barcode": "1234_pink",
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "fulfillment_service": "manual",
                    "grams": 200,
                    "id": 808950810,
                    "inventory_management": "shopify",
                    "inventory_policy": "continue",
                    "option1": "Pink",
                    "option2": null,
                    "option3": null,
                    "position": 1,
                    "price": "199.00",
                    "product_id": 632910392,
                    "requires_shipping": true,
                    "sku": "IPOD2008PINK",
                    "taxable": true,
                    "title": "Pink",
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "inventory_quantity": 10,
                    "old_inventory_quantity": 10
                  },
                  {
                    "barcode": "1234_red",
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "fulfillment_service": "manual",
                    "grams": 200,
                    "id": 49148385,
                    "inventory_management": "shopify",
                    "inventory_policy": "continue",
                    "option1": "Red",
                    "option2": null,
                    "option3": null,
                    "position": 2,
                    "price": "199.00",
                    "product_id": 632910392,
                    "requires_shipping": true,
                    "sku": "IPOD2008RED",
                    "taxable": true,
                    "title": "Red",
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "inventory_quantity": 20,
                    "old_inventory_quantity": 20
                  },
                  {
                    "barcode": "1234_green",
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "fulfillment_service": "manual",
                    "grams": 200,
                    "id": 39072856,
                    "inventory_management": "shopify",
                    "inventory_policy": "continue",
                    "option1": "Green",
                    "option2": null,
                    "option3": null,
                    "position": 3,
                    "price": "199.00",
                    "product_id": 632910392,
                    "requires_shipping": true,
                    "sku": "IPOD2008GREEN",
                    "taxable": true,
                    "title": "Green",
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "inventory_quantity": 30,
                    "old_inventory_quantity": 30
                  },
                  {
                    "barcode": "1234_black",
                    "compare_at_price": null,
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "fulfillment_service": "manual",
                    "grams": 200,
                    "id": 457924702,
                    "inventory_management": "shopify",
                    "inventory_policy": "continue",
                    "option1": "Black",
                    "option2": null,
                    "option3": null,
                    "position": 4,
                    "price": "199.00",
                    "product_id": 632910392,
                    "requires_shipping": true,
                    "sku": "IPOD2008BLACK",
                    "taxable": true,
                    "title": "Black",
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "inventory_quantity": 40,
                    "old_inventory_quantity": 40
                  }
                ],
                "options": [
                  {
                    "id": 594680422,
                    "name": "Title",
                    "position": 1,
                    "product_id": 632910392
                  }
                ],
                "images": [
                  {
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "id": 850703190,
                    "position": 1,
                    "product_id": 632910392,
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "src": "http://cdn.shopify.com/s/files/1/0006/9093/3842/products/ipod-nano.png?v=1400869075"
                  },
                  {
                    "created_at": "2014-05-23T14:17:55-04:00",
                    "id": 562641783,
                    "position": 2,
                    "product_id": 632910392,
                    "updated_at": "2014-05-23T14:17:55-04:00",
                    "src": "http://cdn.shopify.com/s/files/1/0006/9093/3842/products/ipod-nano-2.png?v=1400869075"
                  }
                ],
                "image": {
                  "created_at": "2014-05-23T14:17:55-04:00",
                  "id": 850703190,
                  "position": 1,
                  "product_id": 632910392,
                  "updated_at": "2014-05-23T14:17:55-04:00",
                  "src": "http://cdn.shopify.com/s/files/1/0006/9093/3842/products/ipod-nano.png?v=1400869075"
                }
              }
            };

        var shopify_get = nock('https://myshop.myshopify.com')
                            .put('/admin/products/12345.json')
                            .reply(200, response);

        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'asdf1234',
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth',
                verbose: false
            });

        Shopify.put('/admin/products/12345.json', put_data, function(err, data, headers){
            expect(data).to.deep.equal(response);
            done();
        });

    });
});

describe('#delete', function(){
    it('should return correct response', function(done){

        var shopify_get = nock('https://myshop.myshopify.com')
                            .delete('/admin/products/12345.json')
                            .reply(200, {});

        var Shopify = shopifyAPI({
                shop: 'myshop',
                shopify_api_key: 'abc123',
                shopify_shared_secret: 'asdf1234',
                shopify_scope: 'write_products',
                redirect_uri: 'http://localhost:3000/finish_auth',
                verbose: false
            });

        Shopify.delete('/admin/products/12345.json', function(err, data, headers){
            expect(data).to.deep.equal({});
            done();
        });

    });
});

describe('#graphql', function(){
  it('should return correct response', function(done){

      var graphql_data = {
            query: '{shop{id}}',
            variables: {}
          }
          response = {
            data: {
              shop: {
                id: 'gid:\/\/shopify\/Shop\/1234567'
              }
            },
            extensions: {
              cost: {
                requestedQueryCost: 1,
                actualQueryCost: 1,
                throttleStatus: {
                  maximumAvailable: 1000.0,
                  currentlyAvailable: 999,
                  restoreRate: 50.0
                }
              }
            }
          };

      var shopify_get = nock('https://myshop.myshopify.com')
                          .post('/admin/api/graphql.json')
                          .reply(200, response);

      var Shopify = shopifyAPI({
              shop: 'myshop',
              shopify_api_key: 'abc123',
              shopify_shared_secret: 'asdf1234',
              shopify_scope: 'write_products',
              redirect_uri: 'http://localhost:3000/finish_auth',
              verbose: false
          });

      Shopify.graphql(graphql_data, function(err, data, headers){
          expect(data).to.deep.equal(response);
          done();
      });
  });
});
