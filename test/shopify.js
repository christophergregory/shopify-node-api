var should = require('chai').should(),
    expect = require('chai').expect,
    shopifyAPI = require('../lib/shopify.js');

describe('Intial Setup: ShopifyAPI', function(){

    it('throws error if no config object is passed in', function(){
        var msg = "ShopifyAPI module expects a config object\nPlease see documentation at: https://github.com/sinechris/shopify-node-api\n";
        expect(function(){
            var Shopify = new shopifyAPI();
        }).to.throw(msg);
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

    it('returns a string', function(){
        Shopify.buildAuthURL().should.be.a('string');
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

    it('should be a string', function(){
        Shopify.config.access_token.should.be.a('string');
    });

});