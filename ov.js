//
// An observable-ish value
//
// Publish changes to subscriber functions when values change.
//
// const fn = function(current, previous) {}
//
// const obsValue = ov('initial');
// obsValue.subscribe(fn);      // subscribe to changes
// obsValue();                  // 'initial'
// obsValue('initial');         // identical value, no change
// obsValue('new');             // fn('new', 'initial')
// obsValue.value = 'silent';   // silent update
//
// Modifying arrays and objects will not publish, but replacing them will.
//
// const obsArray = ov([1, 2, 3]);
// obsarray().subscribe(fn);
// obsArray().push(4);          // silent update
// obsArray.publish();          // fn([1, 2, 3, 4]);
// obsArray([4, 5]);            // fn([4, 5], [1, 2, 3]);
//
// Passing a function caches the result as the value. Any extra arguments will
// be passed to the function. Any observables called within the function will
// be subscribed to, and updates to those observables will recompute the value.
// Child observables must be called, mere references are ignored. If the
// function returns a Promise, the value is assigned async after resolution.
//
// const a = ov(1);
// const b = ov(2);
// const computed = ov(arg => { a() + b() + arg }, 3);
// computed.subscribe(fn);
// computed();                  // fn(6)
// a(2);                        // fn(7, 6)
//

export default function ov(...args) {
  // JS functions can't inherit custom prototypes, so we use prop() as a
  // proxy to the real ObservableValue instead.
  const observable = new ObservableValue();

  function prop(...args) {
    return observable.accessor.apply(prop, args);
  }

  for (const key in observable) {
    if (typeof observable[key] === "function") {
      prop[key] = observable[key];
    } else {
      Object.defineProperty(prop, key, {
        get: () => observable[key],
        set: (value) => {
          observable[key] = value;
        },
      });
    }
  }

  prop(...args);
  return prop;
}

function ObservableValue() {
  this.previousValue = null;
  this.value = null;
  this.subscribers = [];
}

ObservableValue._computeActive = false;
ObservableValue._computeChildren = [];

ObservableValue.prototype.accessor = function accessor(newValue) {
  // If no arguments, return the value. If called inside a computed observable
  // value function, track child observables.
  if (!arguments.length) {
    if (
      ObservableValue._computeActive &&
      ObservableValue._computeChildren.indexOf(this) === -1
    ) {
      ObservableValue._computeChildren.push(this);
    }
    return this.value;
  }

  // If new value is same as previous, skip.
  else if (newValue !== this.value) {
    // If new value is not a function, save and publish.
    if (typeof newValue !== "function") {
      this.previousValue = this.value;
      this.value = newValue;
      this.publish();
    }

    // If new value is a function, call the function and save its result.
    // Function can return a promise for async assignment. All additional
    // arguments are passed to the value function.
    else {
      const args = [];
      for (let i = 1; i < arguments.length; i++) {
        const arg = arguments[i];
        args.push(arg);
      }
      this.valueFunction = newValue;
      this.valueFunctionArgs = args;

      // Subscribe to child observables
      ObservableValue._computeActive = true;
      this.compute();
      ObservableValue._computeActive = false;
      ObservableValue._computeChildren.forEach((child) => {
        child.subscribe(() => this.compute());
      });
      ObservableValue._computeChildren.length = 0;
    }
  }
};

ObservableValue.prototype.publish = function publish() {
  this.subscribers.slice().forEach((handler) => {
    if (!handler) return;
    handler.call(this, this.value, this.previousValue);
  });
};

ObservableValue.prototype.subscribe = function subscribe(handler, immediate) {
  this.subscribers.push(handler);
  if (immediate) {
    handler.call(this, this.value, this.previousValue);
  }
};

ObservableValue.prototype.unsubscribe = function unsubscribe(handler) {
  const index = this.subscribers.indexOf(handler);
  this.subscribers.splice(index, 1);
};

// Note, currently there's no shortcut to cleanup a computed value.
ObservableValue.prototype.compute = function compute() {
  const result = this.valueFunction.apply(this, this.valueFunctionArgs);
  if (typeof result !== "undefined") {
    if (typeof result.then === "function") {
      result.then((asyncResult) => this(asyncResult));
    } else {
      this(result);
    }
  }
};
