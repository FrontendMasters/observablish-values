# An Observable-ish Value

Publish changes to subscriber functions when values change.

```javascript
const fn = function(current, previous) {}

const obsValue = ov('initial');
obsValue.subscribe(fn);      // subscribe to changes
obsValue();                  // 'initial'
obsValue('initial');         // identical value, no change
obsValue('new');             // fn('new', 'initial')
obsValue.value = 'silent';   // silent update
```

Modifying arrays and objects will not publish, but replacing them will.

```javascript
const obsArray = ov([1, 2, 3]);
obsarray().subscribe(fn);
obsArray().push(4);          // silent update
obsArray.publish();          // fn([1, 2, 3, 4]);
obsArray([4, 5]);            // fn([4, 5], [1, 2, 3]);
```

Passing a function caches the result as the value. Any extra arguments will
be passed to the function. Any observables called within the function will
be subscribed to, and updates to those observables will recompute the value.
Child observables must be called, mere references are ignored. If the
function returns a Promise, the value is assigned async after resolution.

```javascript
const a = ov(1);
const b = ov(2);
const computed = ov(arg => { a() + b() + arg }, 3);
computed.subscribe(fn);
computed();                  // fn(6)
a(2);                        // fn(7, 6)
```
