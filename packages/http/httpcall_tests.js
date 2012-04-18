
// URL prefix for tests to talk to
var _XHR_URL_PREFIX = "/test_responder";
var url_prefix = function () {
  if (Meteor.is_server && _XHR_URL_PREFIX.indexOf("http") !== 0) {
    var address = __meteor_bootstrap__.app.address();
    _XHR_URL_PREFIX = "http://127.0.0.1:" + address.port + _XHR_URL_PREFIX;
  }
  return _XHR_URL_PREFIX;
};
// Are we in IE?
var IN_OLD_MSIE = Meteor.is_client && $.browser.msie && $.browser.version.substr(0,1) <= 8;

testAsyncMulti("httpcall - basic", [
  function(test, expect) {
    var basic_get = function(url, options, expected_url) {

      var callback = function(error, result) {
        test.isFalse(error);
        if (! error) {
          test.equal(typeof result, "object");
          test.equal(result.statusCode, 200);

          var data = result.data();
          test.equal(data.url, expected_url);
          test.equal(data.method, "GET");
        }
      };


      Meteor.http.call("GET", url_prefix()+url, options, expect(callback));

      if (Meteor.is_server) {
        // test sync version
        var result = Meteor.http.call("GET", url_prefix()+url, options);
        callback(result.error, result);
      }
    };

    basic_get("/foo", null, "/foo");
    basic_get("/foo?", null, "/foo?");
    basic_get("/foo?a=b", null, "/foo?a=b");
    basic_get("/foo", {params: {fruit: "apple"}},
              "/foo?fruit=apple");
    basic_get("/foo", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo?", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"}},
              "/foo?bar&fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"},
                           query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo", {params: {fruit: "apple", dog: "Spot the dog"},
                       query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo?", {params: {fruit: "apple", dog: "Spot the dog"},
                       query: "baz"},
              "/foo?baz&fruit=apple&dog=Spot%20the%20dog");
    basic_get("/foo?bar", {query: ""}, "/foo?");
    basic_get("/foo?bar", {params: {fruit: "apple", dog: "Spot the dog"},
                           query: ""},
              "/foo?fruit=apple&dog=Spot%20the%20dog");
  }]);

testAsyncMulti("httpcall - failure", [

  function(test, expect) {

    // Accessing unknown server (should fail to make any connection)
    Meteor.http.call("GET", "http://asfd.asfd/", expect(
      function(error, result) {
        test.isTrue(error);
        test.isTrue(result);
        test.equal(error, result.error);
      }));

    // Server serves 500
    Meteor.http.call("GET", url_prefix()+"/fail", expect(
      function(error, result) {
        test.isTrue(error);
        test.isTrue(result);
        test.equal(error, result.error);

        test.equal(result.statusCode, 500);
      }));

    // Timeout
    Meteor.http.call(
      "GET", url_prefix()+"/slow",
      { timeout: 200 },
      expect(function(error, result) {
        test.isTrue(error);
        test.equal(error, result.error);
      }));
    Meteor.http.call(
      "GET", url_prefix()+"/foo",
      { timeout: 2000 },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.url, "/foo");
        test.equal(data.method, "GET");

      }));
  }]);

testAsyncMulti("httpcall - redirect", [

  function(test, expect) {
    // Test that we follow redirects by default
    Meteor.http.call("GET", url_prefix()+"/redirect", expect(
      function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        // should be redirected transparently to /foo
        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.url, "/foo");
        test.equal(data.method, "GET");
      }));

    // followRedirect option; can't be false on client
    _.each([false, true], function(followRedirects) {
      var do_it = function(should_work) {
        var maybe_expect = should_work ? expect : _.identity;
        Meteor.http.call(
          "GET", url_prefix()+"/redirect",
          {followRedirects: followRedirects},
          maybe_expect(function(error, result) {
            test.isFalse(error);
            test.isTrue(result);

            if (followRedirects) {
              // should be redirected transparently to /foo
              test.equal(result.statusCode, 200);
              var data = result.data();
              test.equal(data.url, "/foo");
              test.equal(data.method, "GET");
            } else {
              // should see redirect
              test.equal(result.statusCode, 301);
            }
          }));
      };
      if (Meteor.is_client && ! followRedirects) {
        // not supported, should fail
        test.throws(do_it);
      } else {
        do_it(true);
      }
    });
  }

]);

testAsyncMulti("httpcall - methods", [

  function(test, expect) {
    // non-get methods
    var test_method = function(meth, should_throw) {
      var maybe_expect = (should_throw ? _.identity : expect);
      var func = function() {
        Meteor.http.call(
          meth, url_prefix()+"/foo",
          maybe_expect(function(error, result) {
            test.isFalse(error);
            test.isTrue(result);
            test.equal(result.statusCode, 200);
            var data = result.data();
            test.equal(data.url, "/foo");
            // IE <= 8 turns seems to turn POSTs with no body into
            // GETs, inexplicably.
            test.equal(data.method, IN_OLD_MSIE ? "GET" : meth);
          }));
      };
      if (should_throw)
        test.throws(func);
      else
        func();
    };

    test_method("POST");
    test_method("PUT");
    test_method("DELETE");
  },

  function(test, expect) {
    // contents and data
    Meteor.http.call(
      "POST", url_prefix()+"/foo",
      { content: "Hello World!" },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.body, "Hello World!");
      }));

    Meteor.http.call(
      "POST", url_prefix()+"/data-test",
      { data: {greeting: "Hello World!"} },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.body, {greeting: "Hello World!"});
      }));
  }
]);

testAsyncMulti("httpcall - http auth", [
  function(test, expect) {
    // Test basic auth

    // Unfortunately, any failed auth will result in a browser
    // password prompt.  So we don't test auth failure, only
    // success.

    var password = Meteor.uuid().replace(/[^0-9a-zA-Z]/g, '');
    Meteor.http.call(
      "GET", url_prefix()+"/login?"+password,
      { auth: "meteor:"+password },
      expect(function(error, result) {
        // should succeed
        test.isFalse(error);
        test.isTrue(result);
        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.url, "/login?"+password);
      }));

    // test fail on malformed username:password
    test.throws(function() {
      Meteor.http.call(
        "GET", url_prefix()+"/login?"+password,
        { auth: "fooooo" },
        function() { throw new Error("can't get here"); });
    });
  }
]);

testAsyncMulti("httpcall - headers", [
  function(test, expect) {
    Meteor.http.call(
      "GET", url_prefix()+"/foo",
      {headers: { "Test-header": "Value",
                  "another": "Value2" } },
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        test.equal(result.statusCode, 200);
        var data = result.data();
        test.equal(data.url, "/foo");
        test.equal(data.method, "GET");
        test.equal(data.headers['test-header'], "Value");
        test.equal(data.headers['another'], "Value2");
      }));

    Meteor.http.call(
      "GET", url_prefix()+"/headers",
      expect(function(error, result) {
        test.isFalse(error);
        test.isTrue(result);

        test.equal(result.statusCode, 201);
        test.equal(result.headers()['a-silly-header'], "Tis a");
        test.equal(result.headers()['another-silly-header'], "Silly place.");
      }));
  }
]);


// TO TEST:
// - form-encoding params
// - https
// - headers
// - cookies?
// - human-readable error reason/cause?
// - data parse error
