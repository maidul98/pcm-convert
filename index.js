/**
 * @module pcm-convert
 */
'use strict'

var assert = require('assert')
var isBuffer = require('is-buffer')
var format = require('audio-format')
var extend = require('object-assign')
var isAudioBuffer = require('is-audio-buffer')

module.exports = convert

function convert (buffer, from, to, target) {
	assert(buffer, 'First argument should be data')
	assert(from, 'Second argument should be format string or object')

	//quick ignore
	if (from === to) {
		return buffer
	}

	//2-containers case
	if (isContainer(from)) {
		target = from
		to = format.detect(target)
		from = format.detect(buffer)
	}
	//if no source format defined, just target format
	else if (to === undefined) {
		to = getFormat(from)
		from = format.detect(buffer)
	}
	//if no source format but container is passed with from as target format
	else if (isContainer(to)) {
		target = to
		to = getFormat(from)
		from = format.detect(buffer)
	}
	//all arguments
	else {
		from = getFormat(from)
		if (from.type) from.dtype = from.type
		extend(from, format.detect(buffer))

		to = getFormat(to)
		if (to.type) to.dtype = to.type
		if (target) extend(to, format.detect(target))
	}

	if (to.channels == null && from.channels != null) {
		to.channels = from.channels
	}

	if (to.type == null) {
		to.type = from.type
	}

	if (to.interleaved != null && from.channels == null) {
		from.channels = 2
	}

	//ignore same format
	if (from.type === to.type &&
		from.interleaved === to.interleaved &&
		from.endianness === to.endianness) return buffer

	normalize(from)
	normalize(to)

	//convert buffer/alike to arrayBuffer
	var src
	if (isAudioBuffer(buffer)) {
		if (buffer._data) src = buffer._data
		else {
			src = new Float32Array(buffer.length * buffer.numberOfChannels)
			for (var c = 0, l = buffer.numberOfChannels; c < l; c++) {
				src.set(buffer.getChannelData(c), buffer.length * c)
			}
		}
	}
	else if (buffer instanceof ArrayBuffer) {
		src = new (dtypes[from.dtype])(buffer)
	}
	else if (isBuffer(buffer)) {
		if (buffer.byteOffset != null) src = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
		else src = buffer.buffer;

		src = new (dtypes[from.dtype])(src)
	}
	//typed arrays are unchanged as is
	else {
		src = buffer
	}

	//dst is automatically filled with mapped values
	//but in some cases mapped badly, e. g. float → int(round + rotate)
	var dst = to.type === 'array' ? Array.from(src) : new (dtypes[to.dtype])(src)

	//if range differ, we should apply more thoughtful mapping
	if (from.max !== to.max) {
		var fromRange = from.max - from.min, toRange = to.max - to.min
		for (var i = 0, l = src.length; i < l; i++) {
			var value = src[i]

			//ignore not changed range
			//bring to 0..1
			var normalValue = (value - from.min) / fromRange

			//bring to new format ranges
			value = normalValue * toRange + to.min

			//clamp (buffers do not like values outside of bounds)
			dst[i] = Math.max(to.min, Math.min(to.max, value))
		}
	}

	//reinterleave, if required
	if (from.interleaved != to.interleaved) {
		var channels = from.channels
		var len = Math.floor(src.length / channels)

		//deinterleave
		if (from.interleaved && !to.interleaved) {
			dst = dst.map(function (value, idx, data) {
				var offset = idx % len
				var channel = ~~(idx / len)

				return data[offset * channels + channel]
			})
		}
		//interleave
		else if (!from.interleaved && to.interleaved) {
			dst = dst.map(function (value, idx, data) {
				var offset = ~~(idx / channels)
				var channel = idx % channels

				return data[channel * len + offset]
			})
		}
	}

	//ensure endianness
	if (to.dtype != 'array' && to.dtype != 'int8' && to.dtype != 'uint8' && from.endianness && to.endianness && from.endianness !== to.endianness) {
		var le = to.endianness === 'le'
		var view = new DataView(dst.buffer)
		var step = dst.BYTES_PER_ELEMENT
		var methodName = 'set' + to.dtype[0].toUpperCase() + to.dtype.slice(1)
		for (var i = 0, l = dst.length; i < l; i++) {
			view[methodName](i*step, dst[i], le)
		}
	}

	if (to.type === 'arraybuffer' || to.type === 'buffer') dst = dst.buffer

	if (target) {
		if (Array.isArray(target)) {
			for (var i = 0; i < dst.length; i++) {
				target[i] = dst[i]
			}
		}
		else {
			target.set(dst)
		}
		dst = target
	}

	return dst
}

function getFormat (arg) {
	return typeof arg === 'string' ? format.parse(arg) : format.detect(arg)
}

function isContainer (arg) {
	return typeof arg != 'string' && (Array.isArray(arg) || ArrayBuffer.isView(arg) || arg instanceof ArrayBuffer)
}


var dtypes = {
	'uint8': Uint8Array,
	'uint8_clamped': Uint8ClampedArray,
	'uint16': Uint16Array,
	'uint32': Uint32Array,
	'int8': Int8Array,
	'int16': Int16Array,
	'int32': Int32Array,
	'float32': Float32Array,
	'float64': Float64Array,
	'array': Array,
	'arraybuffer': Uint8Array,
	'buffer': Uint8Array,
}

//make sure all format properties are present
function normalize (obj) {
	if (!obj.dtype) {
		//ensure dtype
		switch (obj.type) {
			case 'float32':
			case 'audiobuffer':
			case 'ndsamples':
			case 'ndarray':
				obj.dtype = 'float32'
				break;
			case 'float64':
				obj.dtype = 'float64'
				break;
			case 'buffer':
			case 'arraybuffer':
			case 'uint8':
			case 'uint8_clamped':
				obj.dtype = 'uint8'
				break;
			case 'uint16':
				obj.dtype = 'uint16'
				break;
			case 'uint32':
				obj.dtype = 'uint32'
				break;
			case 'int8':
				obj.dtype = 'int8'
				break;
			case 'int16':
				obj.dtype = 'int16'
				break;
			case 'int32':
				obj.dtype = 'int32'
				break;
			default:
				obj.dtype = 'array'
				break;
		}
	}

	//provide limits
	switch (obj.dtype) {
		case 'float32':
		case 'float64':
		case 'audiobuffer':
		case 'ndsamples':
		case 'ndarray':
			obj.min = -1
			obj.max = 1
			break;
		case 'uint8':
			obj.min = 0
			obj.max = 255
			break;
		case 'uint16':
			obj.min = 0
			obj.max = 65535
			break;
		case 'uint32':
			obj.min = 0
			obj.max = 4294967295
			break;
		case 'int8':
			obj.min = -128
			obj.max = 127
			break;
		case 'int16':
			obj.min = -32768
			obj.max = 32767
			break;
		case 'int32':
			obj.min = -2147483648
			obj.max = 2147483647
			break;
		default:
			obj.min = -1
			obj.max = 1
			break;
	}

	return obj
}
