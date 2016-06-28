# ozeki
a logger that sends json logs to sumologic and allows for adding contextual fields to those json messages.
written in typescript and includes typescript definitions.

## installation

```bash
npm install ozeki
```

## usage

To log to sumo (and still console) and include contextual fields on json log messages:
```node
var ozeki = require('ozeki');

function userId() {
  return /* current userId, probably from continuation-local-storage */;
}

function txnId() {
  return /* current transaction id, probably from continuation-local-storage */;
}

ozeki.initLogging('https://endpoint1.collection.us2.sumologic.com/receiver/v1/http/[YOUR SUMO RECEIVER CODE HERE]', 'prod', () => ({
        _u: userId(),
        _x: txnId()
    }))

console.log('testing 123');
console.warn({foo: 'bar', baz: 'blah'});
console.error(new Error('sad trombone'));

```

And you will get output like:
```
replacing console.log (+context +sumo)
{"_t":"2016-06-28T17:22:22.513Z","_l":"INFO","userId":1, "txnId":"fjoauhg3" ,"msg":"replaced console log fns"}
{"_t":"2016-06-28T17:22:32.936Z","_l":"INFO","userId":1, "txnId":"fjoauhg3" ,"msg":"testing 123"}
{"_t":"2016-06-28T17:23:31.755Z","_l":"WARN","userId":1, "txnId":"fjoauhg3" ,"foo":"bar","baz":"blah"}
{ Error: sad trombone
    at repl:1:15
    at REPLServer.defaultEval (repl.js:272:27)
    at bound (domain.js:280:14)
    at REPLServer.runBound [as eval] (domain.js:293:12)
    at REPLServer.<anonymous> (repl.js:441:10)
    at emitOne (events.js:101:20)
    at REPLServer.emit (events.js:188:7)
    at REPLServer.Interface._onLine (readline.js:224:10)
    at REPLServer.Interface._line (readline.js:566:8)
    at REPLServer.Interface._ttyWrite (readline.js:843:14) _t: '2016-06-28T17:27:02.972Z', _l: 'ERROR', x: 1 }
```
