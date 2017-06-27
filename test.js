'use strict'

var test = require('tape')
var convert = require('./')

test('floatLE to int16BE', function (t) {
	var buf = new Buffer(8);
	buf.writeFloatLE(1.0, 0);
	buf.writeFloatLE(-0.5, 4);

	var newBuf = convert(buf, 'float32 le', 'int16 be');
	newBuf = Buffer.from(newBuf.buffer)
	var val1 = newBuf.readInt16BE(0);
	var val2 = newBuf.readInt16BE(2);

	t.equal(Math.pow(2, 15) - 1, val1);
	t.equal(-Math.pow(2, 14), val2);
	t.end()
});

test('endianness', t => {
	var buf = new Float32Array([1, -0.5])

	var newBuf = convert(buf, 'float32 le', 'be');
	newBuf = Buffer.from(newBuf.buffer)
	var val1 = newBuf.readFloatBE(0);
	var val2 = newBuf.readFloatBE(4);

	t.equal(val1, 1.0);
	t.equal(val2, -0.5);
	t.end()
})

test('markers', function (t) {
	let arr = convert(new Uint8Array([0, 255, 255, 0, 0, 255]), 'interleaved', 'float32 planar')

	t.deepEqual(arr, [-1, 1, -1, 1, -1, 1])

	t.end()
})


test('bad markers', function (t) {
	t.throws(() => {
		convert([0,0,0,0], 'float32 xx')
	})
	t.end()
})


test('float to whatever', t => {
	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'int16'),
		[32767, 32767, -32768, -32768])

	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'int8'),
		[127, 127, -128, -128])

	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'uint16'),
		[65535, 65535, 0, 0])

	t.end()
})

test('interleave', t => {
	let arr = new Uint8Array([0,2,4,6,1,3,5,7])

	t.deepEqual(convert(arr, 'planar', 'interleaved'), [0,1,2,3,4,5,6,7])
	t.end()
})

test('deinterleave', t => {
	let arr = new Uint8Array([0,1,2,3,4,5,6,7])
	let arr2 = convert(arr, {interleaved: true}, {interleaved: false})
	t.deepEqual(arr2, [0,2,4,6,1,3,5,7])
	t.notEqual(arr, arr2)
	t.ok(arr2 instanceof Uint8Array)
	t.end()
})


test('array dst', t => {
	let arr = new Uint8Array([0,255,0,255,0,255,0,255])
	let arr2 = convert(arr, {interleaved: true}, 'array planar')
	t.deepEqual(arr2, [-1,-1,-1,-1,1,1,1,1])
	t.ok(Array.isArray(arr2))
	t.end()
})


test('arraybuffer dst', t => {
	let arr = new Uint8Array([0,255,0,255,0,255,0,255])
	let arr2 = convert(arr, {interleaved: true}, 'arraybuffer planar')
	t.ok(arr2 instanceof ArrayBuffer)
	t.end()
})


test('speaker test', t => {
	t.deepEqual(convert(new Float32Array([-1, 0, 1, 0]), {
          type: 'float32',
          interleaved: false,
          channels: 2
        }, {
          type: 'int16',
          interleaved: true
    }), [-32768, 32767, 0, 0])

    t.deepEqual(convert(new Float32Array([-1, 0, 1, 0]), {
          dtype: 'float32',
          interleaved: false,
          channels: 2
        }, {
          dtype: 'int16',
          interleaved: true
    }), [-32768, 32767, 0, 0])

    t.end()
})

test('no srcFormat', t => {
	t.deepEqual(convert(new Float32Array([-1, 0, 1, 0]), {
          type: 'int16',
          interleaved: true
    }), [-32768, 32767, 0, 0])

    t.end()
})

//delegated to audio-buffer-from
test.skip('audiobuffer output', t => {
	let buf1 = convert([0,0,1,1], 'audiobuffer')
	t.ok(isAudioBuffer(buf1))
	t.equal(buf1.numberOfChannels, 1)
	t.equal(buf1.length, 4)


	let buf2 = convert([0,0,1,1], 'stereo audiobuffer')
	t.ok(isAudioBuffer(buf2))
	t.equal(buf2.numberOfChannels, 2)
	t.equal(buf2.length, 2)

	t.end()
})
