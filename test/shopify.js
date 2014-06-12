var should = require('chai').should(),
    expect = require('chai').expect,
    shopifyAPI = require('../lib/shopify.js');

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
                redirect_uri: 'http://localhost:3000/finish_auth'
            });


    it('builds correct string', function(){
        var auth_url = Shopify.buildAuthURL(),
            correct_auth_url = 'https://MYSHOP.myshopify.com/admin/oauth/authorize?client_id=abc123&scope=write_products&redirect_uri=http://localhost:3000/finish_auth';
        auth_url.should.equal(correct_auth_url);
    });

});

describe('#set_access_token', function(){
    var Shopify = new shopifyAPI({});

    it('should not have access_token property initially', function(){
        Shopify.config.should.not.have.property('access_token');
    });

    it('adds correct access token to config object', function(){
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
    it('calculates correct signature', function(){

        // Values used below were pre-calculated and not part
        // of an actual shop.

        var Shopify = shopifyAPI({}),
            params = {
                code: 'di389so32hwh28923823dh3289329hdd',
                shop: 'testy-tester.myshopify.com',
                timestamp: '1402539839',
                signature: '0132e77d7fb358ecd4645d86cfc39d27'
            };

        expect(Shopify.is_valid_signature(params)).to.equal(true);
    });
});