var TEST_RESPONDER_ROUTE = "/test_responder";

var respond = function(req, res) {

  if (req.url === "/slow") {
    setTimeout(function() {
      res.statusCode = 200;
      res.end("A SLOW RESPONSE");
    }, 5000);
    return;
  } else if (req.url === "/fail") {
    res.statusCode = 500;
    res.end("SOME SORT OF SERVER ERROR");
    return;
  } else if (req.url === "/redirect") {
    res.statusCode = 301;
    // XXX shouldn't be redirecting to a relative URL, per HTTP spec,
    // but browsers etc. seem to tolerate it.
    res.setHeader("Location", TEST_RESPONDER_ROUTE+"/foo");
    res.end("REDIRECT TO FOO");
    return;
  } else if (req.url.slice(0,6) === "/login") {
    var connect = __meteor_bootstrap__.require('connect');
    // get password from query string
    var checker = connect.basicAuth('meteor', req.url.slice(7));
    var success = false;
    checker(req, res, function() {
      success = true;
    });
    if (! success)
      return;
  }

  var chunks = [];
  req.setEncoding("utf8");
  req.on("data", function(chunk) {
    chunks.push(chunk); });
  req.on("end", function() {
    var body = chunks.join('');

    if (body.charAt(0) === '{') {
      body = JSON.parse(body);
    }

    var response_data = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body
    };
    var response_string = JSON.stringify(response_data);

    res.statusCode = 200;
    res.end(response_string);
  });

};

var run_responder = function() {

  var app = __meteor_bootstrap__.app;
  app.stack.unshift({ route: TEST_RESPONDER_ROUTE, handle: respond });
};

run_responder();
