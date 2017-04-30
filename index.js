var fno = function() {
	var t = this;
	t.debug = 0;
	t.steps = [];
	t.last = null;
	t.next = function(cb) {
		if(!Array.isArray(t.steps)) t.steps = [];
		if(arguments.length>0 && typeof cb === 'function') {
			if(t.debug) console.log(t.debug, 'promise: add new fn', t.steps.length);
			t.steps.push(cb);
		} else if(t.steps.length>0) {
			if(t.debug) console.log(t.debug, 'promise trigger fn', t.steps.length);
			var fn = t.steps.shift();
			if(typeof fn === 'function') fn.apply(null, arguments[0]||[]);
		} else {
			t.finally();
		}
		return t;
	};
	t.trigger = function() { t.next.call(null, [].slice.call(arguments)); };
	t.start = () => { t.next(); };
	t.finally = function(cb) {
		if(arguments.length==0
			&& typeof t.last === 'function') {
			if(t.debug) console.log(t.debug, 'promise trigger finally', typeof t.last);
			var fn = t.last;
			t.last = null;
			fn();
		} else if(typeof cb === 'function') {
			if(t.debug) console.log(t.debug, 'promise add finally', typeof t.last);
			t.last = cb;
		}
		return t;
	};
	t.reset = function() {
		t.steps = [];
		t.last = null;
	};
	return t;
};

module.exports = {
	new: () => new fno(),
	extend: fnExtend,
	compare: fnDeepCompare,
	round: fnRound,
	getValue: fnGetValue,
	addPropGS: fnAddPropGetSet,
	stopwatch: fnStopwatch,
	debug: false
};

function fnExtend(){
	var retval = {};
	if(arguments.length>0) retval = arguments[0];
	for(var i=1;i<arguments.length;i++){
		var arg = arguments[i];
		if(typeof arg!='object' || arg==null) continue;
		var argKeys = Object.keys(arg);
		for(var j=0;j<argKeys.length;j++){
			var key = argKeys[j];
			var val = arg[key];
			var descr = Object.getOwnPropertyDescriptor(arg,key);
			// allow getter/setter to be inherited
			if(typeof descr.get!='undefined' || typeof descr.set!='undefined'){
				// don't inherit if there is already a getter/setter
				var retDescr = Object.getOwnPropertyDescriptor(retval,key);
				if(module.exports.debug) console.log('rd', retDescr);
				if(typeof retDescr=='undefined' ||
					(typeof retDescr.get=='undefined' && typeof retDescr.set=='undefined'))
					fnAddPropGetSet(retval, key, descr.get, descr.set);
			} // recurse for objects (but not arrays)
			else if(typeof val == 'object' && !Array.isArray(val)) {
				if(typeof retval[key]=='undefined') retval[key] = {};
				if(typeof retval[key]!='object') retval[key] = { value: retval[key] };
				fnExtend(retval[key], val);
			} // for arrays, make a copy of the whole array and use it 
			else if(Array.isArray(val)) {
				retval[key] = fnExtend([], val);
			} else retval[key] = val;
		}
	}
	return retval;
}

function fnDeepCompare(a,b,existsOnly,n) {
	if(typeof existsOnly=='undefined') existsOnly = 0;
	if(typeof n=='undefined') n = '';
	else n+='.';
	var iso = a=> typeof a=='object' && a!=null;
	var isf = a=> typeof a=='function';
	var notofu = a=> typeof a!='object' && typeof a!='function' && typeof a!='undefined';
	var retval = true;
	if(notofu(a) && notofu(b)) {
		if(a!==b) {
			if(module.exports.debug) console.log(n, a, b, a!==b);
			retval = false;
		}
	} else if(iso(a) && iso(b)) {
		var keys = Object.keys(a);
		keys = keys.concat(Object.keys(b));
		keys = keys.filter((x,i)=> i==keys.indexOf(x));
		for(var i=0;i<keys.length;i++) {
			var key = keys[i];
			var val = fnDeepCompare(a[key], b[key], existsOnly, n+key);
			if(!val) {
				retval = false;
				if(!module.exports.debug) break;
			}
		}
	} else if(isf(a) && isf(b)) {
	} else if(!existsOnly) {
		if(module.exports.debug) console.log(n, typeof a, typeof b);
		retval = false;
	}
	return retval;
}


function fnAddPropGetSet(obj, key, fnGet, fnSet){
	var val = {enumerable:true,configurable:true};
	if(typeof fnGet=='function') val.get = fnGet;
	if(typeof fnSet=='function') val.set = fnSet;
	Object.defineProperty(obj, key, val);
}


function fnRound(x, n) {
	var f = Math.pow(10,n)
	var r = x*f;
	var r2 = Math.round(r);
	var r3 = r2/f;
	return r3;
}

function fnGetValue(obj, key, def) {
	if(typeof obj!=='object') return def;
	var retval = def;
	if(typeof key == 'string') key = key.split('.');
	if(Array.isArray(key)) {
		var nxtObj = obj;
		var fail = false;
		for(var i=0;i<key.length;i++){
			var iKey = key[i];
			if(typeof nxtObj[iKey]!='undefined')
				nxtObj = nxtObj[iKey];
			else {
				fail = true;
				break;
			}
		}
		if(!fail) retval = nxtObj;
	} else if(typeof obj[key]!== 'undefined')
		retval = obj[key];
	return retval;
}

function fnStopwatch() {
	var t = this;
	t.cname = '';
	t.pnames = [];
	t.ctime = 0;
	t.timers = {};
	t.start = function(name, add) {
		if(typeof add!='number') add=1;
		//console.log('sw', name, add, t.cname, t.pnames); 
		if(add===1 && t.cname!='') {
			//console.log('push', t.cname, t.pnames); 
			t.pnames.push(t.cname);
		}
		t.stop();
		t.cname = name;
		t.ctime = Date.now();
	};
	t.revert = function() {
		var name = '';
		if(t.pnames.length>0) name = t.pnames.pop();
		t.start(name, 0);
	};
	t.stop = function() {
		if(t.ctime>0) {
			if(typeof t.timers[t.cname]!='number') t.timers[t.cname] = 0;
			t.timers[t.cname] += Date.now() - t.ctime;
			t.ctime = 0;
			t.cname = '';
		}
	};
	t.print = function() {
		return JSON.stringify(t.timers);
	};
	t.reset = function() {
		t.stop();
		t.timers = {};
	}
}
